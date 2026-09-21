# backend/routers/extract.py

import os
import re
import io
import json
import httpx

from pathlib import Path
from collections import defaultdict
from typing import Optional, Literal

from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from supabase import Client, create_client
from google import genai
from google.genai import types


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DOCKER_INBOX_URL = os.getenv(
    "DOCKER_INBOX_URL",
    "http://localhost:8080"
)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env"
    )

if not GEMINI_API_KEY:
    raise RuntimeError(
        "Missing GEMINI_API_KEY in backend/.env"
    )


supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY
)

gemini_client = genai.Client(
    api_key=GEMINI_API_KEY
)

router = APIRouter(tags=["Extraction"])


# ---------------------------------------------------------------------------
# CANONICAL FIELDS + LABEL SYNONYMS
# ---------------------------------------------------------------------------

FIELD_LABELS = {
    "shipper": [
        "Shipper",
        "Shipper/Exporter",
        "Shipper (Principal or Seller)",
        "SHIPPER",
        "Shipper Name",
        "Export/Shipper",
    ],

    "consignee": [
        "Consignee",
        "Consignee (Non-Negotiable)",
        "CONSIGNEE",
        "To the Order of",
        "Consignee Name",
    ],

    "notify_party": [
        "Notify Party",
        "Notify",
        "Notify Party/Intermediate Consignee",
        "NOTIFY PARTY",
    ],

    "port_of_loading": [
        "Port of Loading",
        "Port of Loading (POL)",
        "Load Port",
        "POL",
        "PORT OF LOADING",
        "Loading Port",
    ],

    "port_of_discharge": [
        "Port of Discharge",
        "Port of Discharge (POD)",
        "Discharge Port",
        "POD",
        "PORT OF DISCHARGE",
        "Destination Port",
    ],

    "container_count": [
        "No. of Containers",
        "Total Containers",
        "No. of Containers or Packages",
        "Container Count",
        "No. of Cntrs",
        "Qty of Containers",
    ],

    "gross_weight_kg": [
        "Gross Weight (KG)",
        "Gross Wt (kgs)",
        "Gross Weight毛重(KGS)",
        "GROSS WEIGHT",
        "Total Gross Weight",
        "Gross Wt",
        "G.W.",
    ],
}


CANONICAL_FIELDS = list(FIELD_LABELS.keys())


def clean_label(label: str) -> str:
    """
    Normalize a document label so that different formatting variations
    can still be matched against the canonical label dictionary.
    """

    cleaned = re.sub(r"\(.*?\)", "", label)
    cleaned = re.sub(r"[^\x00-\x7F]+", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned)

    return cleaned.lower().strip()


LABEL_TO_FIELD = {}

for field, labels in FIELD_LABELS.items():
    for label in labels:
        LABEL_TO_FIELD[clean_label(label)] = field


# ---------------------------------------------------------------------------
# VALIDATION BOUNDS
# ---------------------------------------------------------------------------

CONTAINER_COUNT_RANGE = (1, 999)
GROSS_WEIGHT_KG_RANGE = (1, 5_000_000)

# If structured parsing recognizes fewer than this number of canonical
# fields, try the Gemini vision fallback for PDFs.
MIN_FIELDS_BEFORE_VISION_FALLBACK = 2


_ai_label_cache: dict[str, Optional[str]] = {}


class ExtractedFields(BaseModel):
    email_id: str
    doc_type: Literal["SI", "BL"]

    shipper: Optional[str] = None
    consignee: Optional[str] = None
    notify_party: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None

    container_count: Optional[int] = None
    gross_weight_kg: Optional[float] = None

    confidence: float


@router.get("/extraction/health")
async def extraction_health():
    return {
        "status": "extraction router is working"
    }


# ---------------------------------------------------------------------------
# PARSERS
#
# Each parser returns:
#
#     (pairs, parse_method)
#
# pairs is a LIST of:
#
#     (raw_label, value)
#
# rather than a dictionary so duplicate/conflicting labels are not silently
# overwritten.
# ---------------------------------------------------------------------------

def _lines_to_pairs(text: str) -> list[tuple[str, str]]:
    pairs = []

    for line in text.splitlines():

        if ":" not in line:
            continue

        label, _, value = line.partition(":")

        label = label.strip()
        value = value.strip()

        if label and value:
            pairs.append((label, value))

    return pairs


def parse_txt(raw_bytes: bytes) -> tuple[list[tuple[str, str]], str]:

    text = raw_bytes.decode(
        "utf-8",
        errors="replace"
    )

    return _lines_to_pairs(text), "structured"


def _pdf_table_heuristic(
    text: str
) -> list[tuple[str, str]]:

    """
    Best-effort parser for PDFs where fields are arranged as simple
    two-column table-like rows rather than 'Label: Value'.
    """

    pairs = []

    for line in text.splitlines():

        cells = re.split(
            r"\t| {2,}",
            line
        )

        cells = [
            cell.strip()
            for cell in cells
            if cell.strip()
        ]

        if len(cells) >= 2 and 1 <= len(cells[0].split()) <= 5:

            pairs.append(
                (
                    cells[0],
                    " ".join(cells[1:])
                )
            )

    return pairs


def parse_pdf(
    raw_bytes: bytes
) -> tuple[list[tuple[str, str]], str]:

    import fitz

    with fitz.open(
        stream=raw_bytes,
        filetype="pdf"
    ) as doc:

        text = "\n".join(
            page.get_text()
            for page in doc
        )

    # Scanned/image-only PDF.
    if len(text.strip()) < 20:
        return [], "scanned_no_text"

    pairs = _lines_to_pairs(text)

    if len(pairs) >= MIN_FIELDS_BEFORE_VISION_FALLBACK:
        return pairs, "structured"

    table_pairs = _pdf_table_heuristic(text)

    if len(table_pairs) >= len(pairs):
        return table_pairs, "table_heuristic"

    return pairs, "structured"


def parse_docx(
    raw_bytes: bytes
) -> tuple[list[tuple[str, str]], str]:

    from docx import Document

    pairs = []

    doc = Document(
        io.BytesIO(raw_bytes)
    )

    # DOCX tables
    for table in doc.tables:

        for row in table.rows:

            cells = [
                cell.text.strip()
                for cell in row.cells
            ]

            if (
                len(cells) >= 2
                and cells[0]
                and cells[1]
            ):
                pairs.append(
                    (
                        cells[0],
                        cells[1]
                    )
                )

    # DOCX paragraphs
    for paragraph in doc.paragraphs:

        pairs.extend(
            _lines_to_pairs(
                paragraph.text
            )
        )

    return (
        pairs,
        "structured" if pairs else "empty"
    )


def parse_xlsx(
    raw_bytes: bytes
) -> tuple[list[tuple[str, str]], str]:

    import openpyxl

    pairs = []

    workbook = openpyxl.load_workbook(
        io.BytesIO(raw_bytes),
        data_only=True
    )

    worksheet = workbook.active

    all_known_labels = set(
        LABEL_TO_FIELD.keys()
    )

    for row in worksheet.iter_rows(
        values_only=True
    ):

        if not row:
            continue

        cells = [
            str(cell).strip()
            if cell is not None
            else ""
            for cell in row
        ]

        # ---------------------------------------------------------------
        # Pass 1:
        # Find a known label anywhere in the row.
        # ---------------------------------------------------------------

        matched_at = None

        for index, cell in enumerate(cells):

            if (
                cell
                and clean_label(cell) in all_known_labels
            ):
                matched_at = index
                break

        if matched_at is not None:

            for value_index in range(
                matched_at + 1,
                len(cells)
            ):

                if cells[value_index]:

                    pairs.append(
                        (
                            cells[matched_at],
                            cells[value_index]
                        )
                    )

                    break

            continue

        # ---------------------------------------------------------------
        # Pass 2:
        # Original column A / B fallback.
        # ---------------------------------------------------------------

        if (
            len(cells) >= 2
            and cells[0]
            and cells[1]
        ):
            pairs.append(
                (
                    cells[0],
                    cells[1]
                )
            )

    return (
        pairs,
        "structured" if pairs else "empty"
    )


def parse_attachment(
    raw_bytes: bytes,
    filename: str
) -> tuple[list[tuple[str, str]], str]:

    ext = filename.lower().rsplit(
        ".",
        1
    )[-1]

    if ext == "txt":
        return parse_txt(raw_bytes)

    if ext == "pdf":
        return parse_pdf(raw_bytes)

    if ext == "docx":
        return parse_docx(raw_bytes)

    if ext == "xlsx":
        return parse_xlsx(raw_bytes)

    return [], "unsupported_format"


# ---------------------------------------------------------------------------
# VISION FALLBACK
#
# Used for:
#
# - scanned/image-only PDFs
# - PDFs where structured parsing recognizes too few useful fields
# ---------------------------------------------------------------------------

async def vision_extract_fields(
    raw_bytes: bytes
) -> dict:

    import fitz

    prompt = f"""
Extract these 7 fields from this shipping document image, if present:

{CANONICAL_FIELDS}

Return ONLY a JSON object with these exact keys.

Use null for any field that is not visible or not present.

container_count should be an integer.

gross_weight_kg should be a number in kilograms only.
Strip units and commas.

Do not include explanations.
Do not use markdown.
Return raw JSON only.
"""

    parts = [prompt]

    try:

        with fitz.open(
            stream=raw_bytes,
            filetype="pdf"
        ) as doc:

            # Only inspect the first three pages.
            # This limits Gemini cost and latency.

            page_count = min(
                3,
                len(doc)
            )

            for page_index in range(page_count):

                page = doc[page_index]

                pix = page.get_pixmap(
                    dpi=150
                )

                png_bytes = pix.tobytes(
                    "png"
                )

                parts.append(
                    types.Part.from_bytes(
                        data=png_bytes,
                        mime_type="image/png"
                    )
                )

    except Exception:
        return {}

    try:

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=parts
        )

        raw_text = response.text.strip()

        raw_text = re.sub(
            r"^```json\s*|\s*```$",
            "",
            raw_text.strip()
        )

        data = json.loads(raw_text)

        return {
            key: data.get(key)
            for key in CANONICAL_FIELDS
            if data.get(key) not in (None, "")
        }

    except Exception:
        return {}


# ---------------------------------------------------------------------------
# AI LABEL MATCHING FALLBACK
# ---------------------------------------------------------------------------

async def ai_match_label(
    raw_label: str
) -> Optional[str]:

    cache_key = clean_label(
        raw_label
    )

    if cache_key in _ai_label_cache:
        return _ai_label_cache[cache_key]

    prompt = f"""
You are matching a shipping-document field label to a canonical field name.

Canonical fields:
{CANONICAL_FIELDS}

Label to match:
"{raw_label}"

If this label clearly refers to one of the canonical fields, return that
field name exactly.

For example:
"Load Port" means "port_of_loading".

If it does NOT match any canonical field, return "none".

Examples of labels that should return "none":
- vessel name
- HS code
- freight term
- booking number

Return ONLY the field name or "none".
No explanation.
No punctuation.
"""

    try:

        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt
        )

        answer = response.text.strip().lower()

        result = (
            answer
            if answer in CANONICAL_FIELDS
            else None
        )

    except Exception:

        result = None

    _ai_label_cache[cache_key] = result

    return result


# ---------------------------------------------------------------------------
# NUMERIC PARSING
# ---------------------------------------------------------------------------

def parse_container_count(
    raw_value: str
) -> Optional[int]:

    match = re.search(
        r"\d+",
        raw_value
    )

    if not match:
        return None

    return int(
        match.group()
    )


def parse_gross_weight(
    raw_value: str
) -> Optional[float]:

    match = re.search(
        r"[\d,]+(?:\.\d+)?",
        raw_value
    )

    if not match:
        return None

    return float(
        match.group().replace(",", "")
    )


# ---------------------------------------------------------------------------
# NUMERIC VALIDATION
# ---------------------------------------------------------------------------

def validate_numeric_fields(
    fields: dict,
    warnings: dict
) -> tuple[dict, dict]:

    if fields.get("container_count") is not None:

        lo, hi = CONTAINER_COUNT_RANGE

        if not (
            lo
            <= fields["container_count"]
            <= hi
        ):

            warnings["container_count"] = (
                f"out-of-range value "
                f"({fields['container_count']}) discarded"
            )

            fields["container_count"] = None

    if fields.get("gross_weight_kg") is not None:

        lo, hi = GROSS_WEIGHT_KG_RANGE

        if not (
            lo
            <= fields["gross_weight_kg"]
            <= hi
        ):

            warnings["gross_weight_kg"] = (
                f"out-of-range value "
                f"({fields['gross_weight_kg']}) discarded"
            )

            fields["gross_weight_kg"] = None

    return fields, warnings


# ---------------------------------------------------------------------------
# NORMALIZATION
# ---------------------------------------------------------------------------

def _dedupe_preserve_order(
    values: list[str]
) -> list[str]:

    seen = set()
    output = []

    for value in values:

        key = value.strip().lower()

        if key not in seen:

            seen.add(key)
            output.append(
                value.strip()
            )

    return output


async def normalize_fields(
    pairs: list[tuple[str, str]]
) -> tuple[dict, dict, bool]:

    """
    Returns:

        fields
        warnings
        used_ai_fallback
    """

    candidates: dict[str, list[str]] = defaultdict(list)

    used_ai_fallback = False

    for raw_label, value in pairs:

        cleaned = clean_label(
            raw_label
        )

        if (
            not cleaned
            or not value.strip()
        ):
            continue

        # First use deterministic dictionary matching.
        field = LABEL_TO_FIELD.get(
            cleaned
        )

        # Only call Gemini when dictionary matching fails.
        if not field:

            field = await ai_match_label(
                raw_label
            )

            if field:
                used_ai_fallback = True

        if field:

            candidates[field].append(
                value.strip()
            )

    fields: dict = {}
    warnings: dict = {}

    for field, raw_values in candidates.items():

        unique_values = _dedupe_preserve_order(
            raw_values
        )

        # ---------------------------------------------------------------
        # Container count
        # ---------------------------------------------------------------

        if field == "container_count":

            parsed = [
                value
                for value in (
                    parse_container_count(x)
                    for x in unique_values
                )
                if value is not None
            ]

            parsed = sorted(
                set(parsed)
            )

            if len(parsed) == 1:

                fields[field] = parsed[0]

            elif len(parsed) > 1:

                warnings[field] = (
                    f"ambiguous: "
                    f"{len(parsed)} differing values found "
                    f"{parsed} — kept first"
                )

                fields[field] = parsed[0]

            continue

        # ---------------------------------------------------------------
        # Gross weight
        # ---------------------------------------------------------------

        if field == "gross_weight_kg":

            parsed = [
                value
                for value in (
                    parse_gross_weight(x)
                    for x in unique_values
                )
                if value is not None
            ]

            parsed = sorted(
                set(parsed)
            )

            if len(parsed) == 1:

                fields[field] = parsed[0]

            elif len(parsed) > 1:

                warnings[field] = (
                    f"ambiguous: "
                    f"{len(parsed)} differing values found "
                    f"{parsed} — kept first"
                )

                fields[field] = parsed[0]

            continue

        # ---------------------------------------------------------------
        # Text fields
        # ---------------------------------------------------------------

        if len(unique_values) == 1:

            fields[field] = unique_values[0]

        else:

            warnings[field] = (
                f"ambiguous: "
                f"{len(unique_values)} differing values found "
                f"— kept longest"
            )

            fields[field] = max(
                unique_values,
                key=len
            )

    fields, warnings = validate_numeric_fields(
        fields,
        warnings
    )

    return (
        fields,
        warnings,
        used_ai_fallback
    )


# ---------------------------------------------------------------------------
# EXTRACTION COMPLETENESS
# ---------------------------------------------------------------------------

PARSE_METHOD_FACTOR = {
    "structured": 1.0,
    "table_heuristic": 0.9,
    "vision_fallback": 0.75,
    "scanned_no_text": 0.0,
    "empty": 0.0,
    "unsupported_format": 0.0,
}


def compute_extraction_completeness(
    fields: dict,
    warnings: dict,
    used_ai_fallback: bool,
    parse_method: str
) -> float:

    found = sum(
        1
        for field in CANONICAL_FIELDS
        if fields.get(field) not in (None, "")
    )

    coverage = (
        found
        / len(CANONICAL_FIELDS)
    )

    method_factor = PARSE_METHOD_FACTOR.get(
        parse_method,
        0.85
    )

    score = (
        coverage
        * method_factor
    )

    if used_ai_fallback:
        score -= 0.05

    if warnings:
        score -= min(
            0.05 * len(warnings),
            0.15
        )

    return round(
        max(
            0.0,
            min(1.0, score)
        ),
        2
    )


# ---------------------------------------------------------------------------
# PER-DOCUMENT EXTRACTION
# ---------------------------------------------------------------------------

async def extract_one_document(
    http_client,
    att_path,
    doc_type,
    email_id
) -> dict:

    # ---------------------------------------------------------------
    # Fetch attachment
    # ---------------------------------------------------------------

    try:

        response = await http_client.get(
            f"{DOCKER_INBOX_URL}/{att_path}"
        )

        response.raise_for_status()

        raw_bytes = response.content

    except Exception as error:

        return {
            "email_id": email_id,
            "doc_type": doc_type,
            "confidence": 0.0,

            **{
                key: None
                for key in CANONICAL_FIELDS
            },

            "_parse_method": "fetch_failed",
            "_warnings": {
                "_fetch": str(error)
            },
        }

    # ---------------------------------------------------------------
    # Parse + normalize
    # ---------------------------------------------------------------

    try:

        pairs, parse_method = parse_attachment(
            raw_bytes,
            att_path
        )

        # Normalize first so that we know how many of the ACTUAL
        # seven required fields were found.
        #
        # This is more useful than simply checking len(pairs),
        # because a document can contain many unrelated fields.

        fields, warnings, used_ai_fallback = await normalize_fields(
            pairs
        )

        recognized_count = sum(
            1
            for field in CANONICAL_FIELDS
            if fields.get(field) not in (None, "")
        )

        # -----------------------------------------------------------
        # Vision fallback
        #
        # Trigger when:
        #
        # 1. PDF is scanned/image-only
        # OR
        #
        # 2. PDF contains fewer than the required minimum number
        #    of recognized canonical fields.
        # -----------------------------------------------------------

        should_try_vision = (
            parse_method == "scanned_no_text"
            or (
                att_path.lower().endswith(".pdf")
                and recognized_count
                < MIN_FIELDS_BEFORE_VISION_FALLBACK
            )
        )

        if should_try_vision:

            vision_fields = await vision_extract_fields(
                raw_bytes
            )

            if len(vision_fields) > recognized_count:

                # Start with empty canonical structure.
                vision_result = {
                    key: None
                    for key in CANONICAL_FIELDS
                }

                # Insert Gemini's values.
                vision_result.update(
                    vision_fields
                )

                # ---------------------------------------------------
                # IMPORTANT:
                #
                # Convert Gemini numeric values BEFORE validation.
                #
                # Gemini may return:
                #
                # "40"
                # "40 containers"
                # "12,500 KG"
                #
                # Validation must receive actual int/float values.
                # ---------------------------------------------------

                if vision_result.get(
                    "container_count"
                ) is not None:

                    vision_result["container_count"] = (
                        parse_container_count(
                            str(
                                vision_result[
                                    "container_count"
                                ]
                            )
                        )
                    )

                if vision_result.get(
                    "gross_weight_kg"
                ) is not None:

                    vision_result["gross_weight_kg"] = (
                        parse_gross_weight(
                            str(
                                vision_result[
                                    "gross_weight_kg"
                                ]
                            )
                        )
                    )

                vision_warnings = {}

                vision_result, vision_warnings = (
                    validate_numeric_fields(
                        vision_result,
                        vision_warnings
                    )
                )

                confidence = compute_extraction_completeness(
                    vision_result,
                    vision_warnings,
                    False,
                    "vision_fallback"
                )

                return {
                    "email_id": email_id,
                    "doc_type": doc_type,
                    "confidence": confidence,

                    **{
                        key: vision_result.get(key)
                        for key in CANONICAL_FIELDS
                    },

                    "_parse_method": "vision_fallback",
                    "_warnings": vision_warnings,
                }

        # -----------------------------------------------------------
        # Normal structured extraction result
        # -----------------------------------------------------------

        confidence = compute_extraction_completeness(
            fields,
            warnings,
            used_ai_fallback,
            parse_method
        )

        return {
            "email_id": email_id,
            "doc_type": doc_type,
            "confidence": confidence,

            **{
                key: fields.get(key)
                for key in CANONICAL_FIELDS
            },

            "_parse_method": parse_method,
            "_warnings": warnings,
        }

    # ---------------------------------------------------------------
    # Fault isolation
    # ---------------------------------------------------------------

    except Exception as error:

        return {
            "email_id": email_id,
            "doc_type": doc_type,
            "confidence": 0.0,

            **{
                key: None
                for key in CANONICAL_FIELDS
            },

            "_parse_method": "parse_failed",
            "_warnings": {
                "_error": str(error)
            },
        }


# ---------------------------------------------------------------------------
# DATABASE ROW CLEANING
# ---------------------------------------------------------------------------

def _to_db_row(
    doc_row: dict
) -> dict:

    """
    Remove debug-only keys beginning with "_".

    This allows the Supabase schema to remain unchanged while the
    API response can still expose useful extraction diagnostics.
    """

    return {
        key: value
        for key, value in doc_row.items()
        if not key.startswith("_")
    }


# ---------------------------------------------------------------------------
# EXTRACT SINGLE EMAIL
# ---------------------------------------------------------------------------
PARSE_PROBLEMS = {
    "fetch_failed": "could not be downloaded",
    "parse_failed": "could not be parsed",
    "scanned_no_text": "is a scan with no readable text",
    "empty": "had no readable content",
    "unsupported_format": "has an unsupported file format",
}


def _set_extraction_reason(email_id: str, reason: Optional[str]) -> None:
    """Save why extraction did not fully work, so the page can show it."""
    table = supabase.table("emails")
    try:
        if reason:
            table.update({"review_reason": f"Extraction: {reason}"}).eq("email_id", email_id).execute()
        else:  # clear only reasons this code wrote
            table.update({"review_reason": None}).eq("email_id", email_id).like("review_reason", "Extraction:%").execute()
    except Exception:
        pass  # a missing reason must never break extraction


@router.post("/extract/{email_id}")
async def extract_email(
    email_id: str,

    force: bool = Query(
        default=False,
        description=(
            "If True, skip the classification check and attempt "
            "extraction on any email with >=2 attachments."
        ),
    ),

    dry_run: bool = Query(
        default=False,
        description=(
            "If True, return results without writing to Supabase."
        ),
    ),
):

    async with httpx.AsyncClient(
        timeout=30
    ) as http_client:

        # -----------------------------------------------------------
        # Fetch email
        # -----------------------------------------------------------

        try:

            resp = await http_client.get(
                f"{DOCKER_INBOX_URL}/emails/{email_id}"
            )

            resp.raise_for_status()

            email = resp.json()

        except httpx.HTTPError as error:

            raise HTTPException(
                503,
                f"Could not fetch email from Docker inbox: {error}"
            )

        attachments = email.get(
            "attachments",
            []
        )

        # -----------------------------------------------------------
        # Classification check
        # -----------------------------------------------------------

        if not force:

            existing = (
                supabase
                .table("emails")
                .select("category,status")
                .eq("email_id", email_id)
                .maybe_single()
                .execute()
            )

            row = existing.data or {}

            if row.get("status") != "CLASSIFIED":

                return {
                    "email_id": email_id,
                    "skipped": True,
                    "reason": (
                        "not yet classified "
                        f"(status={row.get('status')!r})"
                    ),
                }

            if row.get("category") != "BL_COMPARISON":

                return {
                    "email_id": email_id,
                    "skipped": True,
                    "reason": (
                        f"category is "
                        f"'{row.get('category')}', "
                        "not BL_COMPARISON"
                    ),
                }

        # -----------------------------------------------------------
        # Attachment validation
        # -----------------------------------------------------------

        if len(attachments) < 2:
            if not dry_run:
                _set_extraction_reason(email_id, f"expected 2 attachments (SI and BL), found {len(attachments)}")
            
            return {
                "email_id": email_id,
                "skipped": True,
                "reason": (
                    "expected 2 attachments "
                    f"(SI + BL), found {len(attachments)}"
                ),
            }

        # Case-insensitive filename matching.
        si_path = next(
            (
                attachment
                for attachment in attachments
                if "_si" in attachment.lower()
            ),
            None
        )

        bl_path = next(
            (
                attachment
                for attachment in attachments
                if "_bl" in attachment.lower()
            ),
            None
        )

        if not si_path or not bl_path:

            if not dry_run:
                _set_extraction_reason(email_id, "could not tell which attachment is the SI and which is the BL from the file names")

            return {
                "email_id": email_id,
                "skipped": True,
                "reason": (
                    "could not identify SI/BL "
                    "by filename"
                ),
            }

        # -----------------------------------------------------------
        # Extract both documents independently.
        #
        # One failed document does not prevent the other from being
        # returned.
        # -----------------------------------------------------------

        si_row = await extract_one_document(
            http_client,
            si_path,
            "SI",
            email_id
        )

        bl_row = await extract_one_document(
            http_client,
            bl_path,
            "BL",
            email_id
        )

    # ---------------------------------------------------------------
    # Dry run
    # ---------------------------------------------------------------

    if dry_run:

        return {
            "email_id": email_id,
            "SI": si_row,
            "BL": bl_row,
            "dry_run": True,
            "note": "not saved to database",
        }

    # ---------------------------------------------------------------
    # Save to Supabase
    # ---------------------------------------------------------------

    try:

        supabase \
            .table("extractions") \
            .delete() \
            .eq("email_id", email_id) \
            .execute()

        supabase \
            .table("extractions") \
            .insert([
                _to_db_row(si_row),
                _to_db_row(bl_row),
            ]) \
            .execute()

    except Exception as error:

        raise HTTPException(
            500,
            f"Could not save extraction to Supabase: {error}"
        )

    problems = [
        f"{name} {PARSE_PROBLEMS[row['_parse_method']]}"
        for name, row in (("SI", si_row), ("BL", bl_row))
        if row.get("_parse_method") in PARSE_PROBLEMS
    ]
    
    _set_extraction_reason(email_id, "; ".join(problems) or None)

    return {
        "email_id": email_id,
        "SI": si_row,
        "BL": bl_row,
    }


# ---------------------------------------------------------------------------
# BATCH EXTRACTION
# ---------------------------------------------------------------------------

@router.post("/extract-batch")
async def extract_batch(
    limit: int = Query(
        default=10,
        ge=1,
        le=100
    ),

    force: bool = Query(
        default=False
    ),

    dry_run: bool = Query(
        default=False
    ),
):

    # ---------------------------------------------------------------
    # Debugging path:
    # Pull candidate emails directly from Docker.
    # ---------------------------------------------------------------

    if force:

        async with httpx.AsyncClient(
            timeout=30
        ) as http_client:

            resp = await http_client.get(
                f"{DOCKER_INBOX_URL}/emails"
            )

            resp.raise_for_status()

            all_emails = resp.json()

        candidates = [
            email["email_id"]
            for email in all_emails
            if len(
                email.get(
                    "attachments",
                    []
                )
            ) >= 2
        ][:limit]

    # ---------------------------------------------------------------
    # Normal path:
    # Only process emails already classified as BL_COMPARISON.
    # ---------------------------------------------------------------

    else:

        result = (
            supabase.table("emails")
            .select("email_id")
            .eq("category", "BL_COMPARISON")
            .eq("status", "CLASSIFIED")
            .range(0, limit - 1)
            .execute()
        )

        candidates = [
            row["email_id"]
            for row in (
                result.data or []
            )
        ]

    processed = []
    skipped = []
    failed = []

    # ---------------------------------------------------------------
    # Process emails independently.
    # ---------------------------------------------------------------

    for email_id in candidates:

        try:

            result = await extract_email(
                email_id,
                force=force,
                dry_run=dry_run
            )

            if result.get("skipped"):
                skipped.append(result)
            else:
                processed.append(result)

        except HTTPException as error:

            failed.append(
                {
                    "email_id": email_id,
                    "error": error.detail,
                }
            )

    return {
        "requested": limit,

        "processed_count": len(
            processed
        ),

        "skipped_count": len(
            skipped
        ),

        "failed_count": len(
            failed
        ),

        "processed": processed,
        "skipped": skipped,
        "failed": failed,
    }

@router.get("/extractions")
async def list_extractions(email_ids: Optional[str] = Query(default=None)):
    """Return extraction rows, optionally only for a comma-separated list of email ids."""
    query = supabase.table("extractions").select("*")
    if email_ids:
        query = query.in_("email_id", [e for e in email_ids.split(",") if e])
    return query.execute().data or []