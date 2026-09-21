# backend/routers/compare.py

import re
from typing import Optional

from fastapi import APIRouter, HTTPException

from db import supabase
from data_source import get_email  # not required by the logic below, kept for parity with other routers

router = APIRouter(tags=["Comparison"])


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

COMPARE_FIELDS = [
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
    "container_count",
    "gross_weight_kg",
]

TEXT_FIELDS = {"shipper", "consignee", "notify_party", "port_of_loading", "port_of_discharge"}
NUMERIC_FIELDS = {"container_count", "gross_weight_kg"}

# Below this, extraction is considered too unreliable to trust for comparison.
# Lines up with extract.py's PARSE_METHOD_FACTOR: "vision_fallback" scores 0.75,
# "scanned_no_text" / "empty" / "unsupported_format" score 0.0. Anything under
# 0.4 means either the document was effectively unreadable, or so few of the 7
# fields were recognized that a diff would not be trustworthy.
LOW_CONFIDENCE_THRESHOLD = 0.4


@router.get("/comparison/health")
async def comparison_health():
    return {"status": "comparison router is working"}


# ---------------------------------------------------------------------------
# NORMALIZATION (values only — extract.py already normalizes field LABELS,
# e.g. "Load Port" -> "port_of_loading". This only normalizes the VALUES so
# formatting differences like "22,000 KG" vs "22000" don't look like defects.)
# ---------------------------------------------------------------------------

def normalize_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = str(value).strip().lower()
    # Different extractors join multi-line addresses differently: the SI
    # parser tends to produce "line one | line two; line three" while the
    # BL parser keeps real newlines. Treat all of these as the same
    # separator so an address split differently on each side doesn't read
    # as a mismatch.
    v = re.sub(r"[|;\n]+", " ", v)
    v = re.sub(r"\s+", " ", v)      # collapse whitespace
    v = re.sub(r"[.,]", "", v)      # "Co., Ltd." vs "Co Ltd"
    return v.strip()


def normalize_number(value) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().lower().replace(",", "")
    s = re.sub(r"[a-z]+", "", s).strip()   # strip trailing units like "kg"
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def values_match(field: str, si_value, bl_value) -> bool:
    if field in NUMERIC_FIELDS:
        a, b = normalize_number(si_value), normalize_number(bl_value)
        if a is None or b is None:
            return False
        return abs(a - b) < 1e-6
    a, b = normalize_text(si_value), normalize_text(bl_value)
    if a is None or b is None:
        return False
    return a == b


# ---------------------------------------------------------------------------
# COMPARISON
# ---------------------------------------------------------------------------

def compare_extractions(si_row: dict, bl_row: dict) -> dict:
    """
    Diffs the 7 canonical fields between an SI and BL extraction row.

    A field that's missing (None/"") on either side is reported separately
    as `missing_value_fields` rather than silently counted as either a
    match or a mismatch — the caller decides whether that should push the
    whole email to NEEDS_REVIEW (it does, below).
    """
    defect_fields = []
    missing_value_fields = []
    field_details = {}

    for field in COMPARE_FIELDS:
        si_val = si_row.get(field)
        bl_val = bl_row.get(field)

        if si_val in (None, "") or bl_val in (None, ""):
            missing_value_fields.append(field)
            field_details[field] = {"si": si_val, "bl": bl_val, "match": None}
            continue

        match = values_match(field, si_val, bl_val)
        field_details[field] = {"si": si_val, "bl": bl_val, "match": match}
        if not match:
            defect_fields.append(field)

    return {
        "defect_fields": defect_fields,
        "missing_value_fields": missing_value_fields,
        "has_defect": len(defect_fields) > 0,
        "field_details": field_details,
    }


# ---------------------------------------------------------------------------
# SINGLE-EMAIL ENDPOINT
# ---------------------------------------------------------------------------

@router.post("/compare/{email_id}")
async def compare_email(email_id: str):
    """
    Compares the SI and BL extraction rows for one email and writes:
      - comparisons: defect_fields, has_defect
      - emails: status (OK / MISMATCH / NEEDS_REVIEW), review_reason

    Never guesses when confidence is low or extraction is incomplete —
    routes to NEEDS_REVIEW with a reason instead, matching the shared
    review_reason enum: missing_attachment | unreadable | missing_value |
    wrong_doc_type.
    """

    result = (
        supabase.table("extractions")
        .select("*")
        .eq("email_id", email_id)
        .execute()
    )
    rows = result.data or []

    si_row = next((r for r in rows if r.get("doc_type") == "SI"), None)
    bl_row = next((r for r in rows if r.get("doc_type") == "BL"), None)

    # -----------------------------------------------------------------
    # Case 1: one or both extractions never happened.
    # extract.py skips silently (no extraction row written) when an
    # email has fewer than 2 attachments, or it can't tell SI from BL
    # by filename — so this is the only place those cases get flagged.
    # -----------------------------------------------------------------
    if not si_row or not bl_row:
        _write_review(email_id, reason="missing_attachment")
        raise HTTPException(
            status_code=422,
            detail=(
                f"Missing extraction for "
                f"{'SI' if not si_row else ''}{' and ' if not si_row and not bl_row else ''}"
                f"{'BL' if not bl_row else ''}. Run /extract/{email_id} first."
            ),
        )

    # -----------------------------------------------------------------
    # Case 2: extraction ran but confidence is too low to trust
    # (covers scanned/unreadable documents that still produced a row).
    # -----------------------------------------------------------------
    si_conf = si_row.get("confidence") or 0.0
    bl_conf = bl_row.get("confidence") or 0.0

    if si_conf < LOW_CONFIDENCE_THRESHOLD or bl_conf < LOW_CONFIDENCE_THRESHOLD:
        _write_review(email_id, reason="unreadable")
        return {
            "email_id": email_id,
            "status": "NEEDS_REVIEW",
            "review_reason": "unreadable",
            "si_confidence": si_conf,
            "bl_confidence": bl_conf,
        }

    # -----------------------------------------------------------------
    # Case 3: normal diff
    # -----------------------------------------------------------------
    diff = compare_extractions(si_row, bl_row)

    supabase.table("comparisons").upsert(
        {
            "email_id": email_id,
            "defect_fields": diff["defect_fields"],
            "has_defect": diff["has_defect"],
        },
        on_conflict="email_id",
    ).execute()

    # Case 3a: some fields couldn't be compared at all (missing on either
    # side). Report what WAS found, but don't confidently call it OK/MISMATCH.
    if diff["missing_value_fields"]:
        _write_review(email_id, reason="missing_value")
        return {
            "email_id": email_id,
            "status": "NEEDS_REVIEW",
            "review_reason": "missing_value",
            "defect_fields": diff["defect_fields"],
            "missing_value_fields": diff["missing_value_fields"],
            "field_details": diff["field_details"],
        }

    # Case 3b: clean comparison — OK or MISMATCH
    new_status = "MISMATCH" if diff["has_defect"] else "OK"
    supabase.table("emails").update(
        {"status": new_status, "review_reason": None}
    ).eq("email_id", email_id).execute()

    return {
        "email_id": email_id,
        "status": new_status,
        "has_defect": diff["has_defect"],
        "defect_fields": diff["defect_fields"],
        "field_details": diff["field_details"],
    }


def _write_review(email_id: str, reason: str) -> None:
    supabase.table("emails").update(
        {"status": "NEEDS_REVIEW", "review_reason": reason}
    ).eq("email_id", email_id).execute()


# ---------------------------------------------------------------------------
# BATCH COMPARISON
# ---------------------------------------------------------------------------

@router.post("/compare-batch")
async def compare_batch(limit: int = 50):
    """
    Runs /compare/{email_id} for every classified BL_COMPARISON email that
    hasn't been compared yet.

    Candidates are sourced from `emails` (category=BL_COMPARISON,
    status=CLASSIFIED) rather than from `extractions` — this matters
    because extract.py can skip an email entirely (no attachments found,
    or SI/BL couldn't be told apart) without ever writing an extraction
    row. compare_email() already knows how to route that case to
    NEEDS_REVIEW, so sourcing candidates this way ensures those emails
    still get a final status instead of being silently left out.

    Processes emails independently — one failure doesn't stop the batch.
    """

    candidates_result = (
        supabase.table("emails")
        .select("email_id")
        .eq("category", "BL_COMPARISON")
        .eq("status", "CLASSIFIED")
        .range(0, limit - 1)
        .execute()
    )
    candidates = [row["email_id"] for row in (candidates_result.data or [])]

    processed = []
    failed = []

    for email_id in candidates:
        try:
            result = await compare_email(email_id)
            processed.append(result)
        except HTTPException as error:
            failed.append({"email_id": email_id, "error": error.detail})
        except Exception as error:
            failed.append({"email_id": email_id, "error": str(error)})

    return {
        "requested": limit,
        "candidates_found": len(candidates),
        "processed_count": len(processed),
        "failed_count": len(failed),
        "processed": processed,
        "failed": failed,
    }


# ---------------------------------------------------------------------------
# LIST COMPARISONS
# ---------------------------------------------------------------------------

@router.get("/comparisons")
async def list_comparisons(email_ids: Optional[str] = None):
    """
    Return comparison rows, optionally filtered to a comma-separated list
    of email ids. Mirrors extract.py's GET /extractions for consistency.
    """
    query = supabase.table("comparisons").select("*")
    if email_ids:
        query = query.in_("email_id", [e for e in email_ids.split(",") if e])
    return query.execute().data or []