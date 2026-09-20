# backend/routers/extract.py
import os
import re
import io
import httpx

from pathlib import Path
from typing import Optional, Literal
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from supabase import Client, create_client
from google import genai

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DOCKER_INBOX_URL = os.getenv("DOCKER_INBOX_URL", "http://localhost:8080")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env")
if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in backend/.env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
gemini_client = genai.Client(api_key=GEMINI_API_KEY)

router = APIRouter(tags=["Extraction"])

# ---------------------------------------------------------------------------
# Copied from data_v2/pools.py's LABELS dict — the dataset's actual closed
# set of label synonyms for the 7 compare fields.
# ---------------------------------------------------------------------------
FIELD_LABELS = {
    "shipper": ["Shipper", "Shipper/Exporter", "Shipper (Principal or Seller)", "SHIPPER"],
    "consignee": ["Consignee", "Consignee (Non-Negotiable)", "CONSIGNEE", "To the Order of"],
    "notify_party": ["Notify Party", "Notify", "Notify Party/Intermediate Consignee", "NOTIFY PARTY"],
    "port_of_loading": ["Port of Loading", "Port of Loading (POL)", "Load Port", "POL", "PORT OF LOADING"],
    "port_of_discharge": ["Port of Discharge", "Port of Discharge (POD)", "Discharge Port", "POD", "PORT OF DISCHARGE"],
    "container_count": ["No. of Containers", "Total Containers", "No. of Containers or Packages", "Container Count"],
    "gross_weight_kg": ["Gross Weight (KG)", "Gross Wt (kgs)", "Gross Weight毛重(KGS)", "GROSS WEIGHT"],
}

LABEL_TO_FIELD = {}
for field, labels in FIELD_LABELS.items():
    for label in labels:
        cleaned = re.sub(r"\(.*?\)", "", label)
        cleaned = re.sub(r"[^\x00-\x7F]+", "", cleaned)
        LABEL_TO_FIELD[cleaned.lower().strip()] = field

CANONICAL_FIELDS = list(FIELD_LABELS.keys())


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
    return {"status": "extraction router is working"}


# ---------------------------------------------------------------------------
# Parsers — one per attachment format.
# ---------------------------------------------------------------------------
def parse_txt(raw_bytes: bytes) -> dict:
    text = raw_bytes.decode("utf-8", errors="replace")
    pairs = {}
    for line in text.splitlines():
        if ":" in line:
            label, _, value = line.partition(":")
            pairs[label.strip()] = value.strip()
    return pairs


def parse_pdf(raw_bytes: bytes) -> dict:
    import fitz
    pairs = {}
    with fitz.open(stream=raw_bytes, filetype="pdf") as doc:
        text = "\n".join(page.get_text() for page in doc)
    for line in text.splitlines():
        if ":" in line:
            label, _, value = line.partition(":")
            pairs[label.strip()] = value.strip()
    return pairs


def parse_docx(raw_bytes: bytes) -> dict:
    from docx import Document
    pairs = {}
    doc = Document(io.BytesIO(raw_bytes))
    for table in doc.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if len(cells) >= 2 and cells[0]:
                pairs[cells[0]] = cells[1]
    return pairs


def parse_xlsx(raw_bytes: bytes) -> dict:
    import openpyxl
    pairs = {}
    wb = openpyxl.load_workbook(io.BytesIO(raw_bytes), data_only=True)
    ws = wb.active
    for row in ws.iter_rows(values_only=True):
        if row and len(row) >= 2 and row[0]:
            pairs[str(row[0]).strip()] = str(row[1]).strip() if row[1] is not None else ""
    return pairs


def parse_attachment(raw_bytes: bytes, filename: str) -> dict:
    ext = filename.lower().rsplit(".", 1)[-1]
    if ext == "txt":
        return parse_txt(raw_bytes)
    if ext == "pdf":
        return parse_pdf(raw_bytes)
    if ext == "docx":
        return parse_docx(raw_bytes)
    if ext == "xlsx":
        return parse_xlsx(raw_bytes)
    return {}


# ---------------------------------------------------------------------------
# Normalize: dictionary first, AI fallback for anything the dictionary misses.
# ---------------------------------------------------------------------------
async def ai_match_label(raw_label: str) -> Optional[str]:
    prompt = f"""
You are matching a shipping-document field label to a canonical field name.

Canonical fields: {CANONICAL_FIELDS}

Label to match: "{raw_label}"

If this label clearly refers to one of the canonical fields (even if worded
differently, e.g. "Load Port" means "port_of_loading"), return that field
name exactly. If it does NOT match any of them (e.g. it's a vessel name,
HS code, freight term, or booking number), return "none".

Return ONLY the field name or "none" — no explanation, no punctuation.
"""
    try:
        response = gemini_client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        answer = response.text.strip().lower()
        return answer if answer in CANONICAL_FIELDS else None
    except Exception:
        return None


async def normalize_fields(raw_pairs: dict) -> tuple[dict, bool]:
    result = {}
    used_fallback = False

    for raw_label, value in raw_pairs.items():
        cleaned = re.sub(r"\(.*?\)", "", raw_label)
        cleaned = re.sub(r"[^\x00-\x7F]+", "", cleaned).lower().strip()

        field = LABEL_TO_FIELD.get(cleaned)

        if not field and cleaned:
            field = await ai_match_label(raw_label)
            if field:
                used_fallback = True

        if field and field not in result:
            result[field] = value

    if "container_count" in result:
        m = re.search(r"\d+", str(result["container_count"]))
        result["container_count"] = int(m.group()) if m else None

    if "gross_weight_kg" in result:
        m = re.search(r"[\d,]+", str(result["gross_weight_kg"]))
        result["gross_weight_kg"] = float(m.group().replace(",", "")) if m else None

    return result, used_fallback


def compute_confidence(fields: dict, used_fallback: bool) -> float:
    required = list(FIELD_LABELS.keys())
    found = sum(1 for f in required if fields.get(f) not in (None, ""))
    base = round(found / len(required), 2)
    return round(base * 0.9, 2) if used_fallback else base


async def extract_one_document(http_client, att_path, doc_type, email_id):
    response = await http_client.get(f"{DOCKER_INBOX_URL}/{att_path}")
    response.raise_for_status()
    raw_pairs = parse_attachment(response.content, att_path)
    fields, used_fallback = await normalize_fields(raw_pairs)
    confidence = compute_confidence(fields, used_fallback)

    row = {
        "email_id": email_id,
        "doc_type": doc_type,
        "confidence": confidence,
        **{k: fields.get(k) for k in FIELD_LABELS.keys()},
    }
    return row


@router.post("/extract/{email_id}")
async def extract_email(
    email_id: str,
    force: bool = Query(    
        default=False,
        description=(
            "TEMPORARY, for standalone testing while Person A is still building. "
            "If True, skip the Supabase category check and attempt extraction "
            "on ANY email with >=2 attachments, regardless of classification."
        ),
    ),
    dry_run: bool = Query(default=False, description="If True, return results without writing to Supabase."),
):
    async with httpx.AsyncClient(timeout=30) as http_client:
        try:
            resp = await http_client.get(f"{DOCKER_INBOX_URL}/emails/{email_id}")
            resp.raise_for_status()
            email = resp.json()
        except httpx.HTTPError as error:
            raise HTTPException(503, f"Could not fetch email from Docker inbox: {error}")

        attachments = email.get("attachments", [])

        if not force:
            existing = (
                supabase.table("emails")
                .select("category")
                .eq("email_id", email_id)
                .maybe_single()
                .execute()
            )
            category = existing.data["category"] if existing.data else None
            if category != "BL_COMPARISON":
                return {
                    "email_id": email_id,
                    "skipped": True,
                    "reason": f"category is '{category}', not BL_COMPARISON (pass ?force=true to test anyway)",
                }

        if len(attachments) < 2:
            return {
                "email_id": email_id,
                "skipped": True,
                "reason": f"expected 2 attachments (SI + BL), found {len(attachments)}",
            }

        si_path = next((a for a in attachments if "_SI" in a), None)
        bl_path = next((a for a in attachments if "_BL" in a), None)

        if not si_path or not bl_path:
            return {"email_id": email_id, "skipped": True, "reason": "could not identify SI/BL by filename"}

        try:
            si_row = await extract_one_document(http_client, si_path, "SI", email_id)
            bl_row = await extract_one_document(http_client, bl_path, "BL", email_id)
        except Exception as error:
            raise HTTPException(502, f"Extraction failed: {error}")

    if dry_run:
        return {"email_id": email_id, "SI": si_row, "BL": bl_row, "dry_run": True, "note": "not saved to database"}

    try:
        supabase.table("extractions").delete().eq("email_id", email_id).execute()
        supabase.table("extractions").insert([si_row, bl_row]).execute()
    except Exception as error:
        raise HTTPException(500, f"Could not save extraction to Supabase: {error}")

    return {"email_id": email_id, "SI": si_row, "BL": bl_row}


@router.post("/extract-batch")
async def extract_batch(
    limit: int = Query(default=10, ge=1, le=100),
    force: bool = Query(default=True),
    dry_run: bool = Query(default=False),
):
    async with httpx.AsyncClient(timeout=30) as http_client:
        resp = await http_client.get(f"{DOCKER_INBOX_URL}/emails")
        resp.raise_for_status()
        all_emails = resp.json()

    candidates = [e for e in all_emails if len(e.get("attachments", [])) >= 2][:limit]

    processed, skipped, failed = [], [], []
    for email in candidates:
        try:
            result = await extract_email(email["email_id"], force=force, dry_run=dry_run)
            (skipped if result.get("skipped") else processed).append(result)
        except HTTPException as error:
            failed.append({"email_id": email["email_id"], "error": error.detail})

    return {
        "requested": limit,
        "processed_count": len(processed),
        "skipped_count": len(skipped),
        "failed_count": len(failed),
        "processed": processed,
        "skipped": skipped,
        "failed": failed,
    }