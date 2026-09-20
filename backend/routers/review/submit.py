import requests
from fastapi import APIRouter, HTTPException
from db import supabase
from data_source import get_all_emails

router = APIRouter()

DOCKER_SUBMIT_URL = "http://localhost:8080/submit"

VALID_CATEGORIES = {"BL_COMPARISON", "SI_REQUEST", "INVOICE_QUERY", "GENERAL", "SPAM"}
VALID_STATUSES = {"OK", "MISMATCH", "NEEDS_REVIEW"}
VALID_REVIEW_REASONS = {"wrong_doc_type", "missing_attachment", "unreadable", "missing_value"}


def build_submission_payload() -> tuple[dict, list[str]]:
    """Gathers data across `emails`, `comparisons`, and `reviews` tables for all 520 email IDs.

    Returns:
        (payload_dict, missing_or_invalid_errors)
    """
    errors = []

    # 1. Fetch expected 520 email IDs from data source
    try:
        all_raw_emails = get_all_emails()
        expected_email_ids = [e["email_id"] for e in all_raw_emails]
    except Exception as err:
        return {}, [f"Failed to fetch master email list from Docker server: {err}"]

    # 2. Query DB tables
    try:
        emails_db = {e["email_id"]: e for e in (supabase.table("emails").select("*").execute().data or [])}
    except Exception:
        emails_db = {}

    try:
        comparisons_db = {c["email_id"]: c for c in (supabase.table("comparisons").select("*").execute().data or [])}
    except Exception:
        comparisons_db = {}

    try:
        reviews_db = {r["email_id"]: r for r in (supabase.table("reviews").select("*").execute().data or [])}
    except Exception:
        reviews_db = {}

    payload = {}

    # 3. Consolidate prediction for each of the 520 email IDs
    for eid in expected_email_ids:
        e_row = emails_db.get(eid, {})
        c_row = comparisons_db.get(eid, {})
        r_row = reviews_db.get(eid, {})

        # Category from Person A
        category = e_row.get("category", "GENERAL")
        if category not in VALID_CATEGORIES:
            errors.append(f"Email {eid}: invalid category '{category}'")

        status = e_row.get("status", "OK")
        review_reason = r_row.get("reason") or e_row.get("review_reason")
        has_defect = False
        defect_fields = []

        # Rule 1: Check if email is NEEDS_REVIEW or has an unresolved review
        if status == "NEEDS_REVIEW" or (r_row and not r_row.get("resolved", False)):
            status = "NEEDS_REVIEW"
            if review_reason not in VALID_REVIEW_REASONS:
                errors.append(f"Email {eid}: status is NEEDS_REVIEW but review_reason '{review_reason}' is invalid")
            has_defect = False
            defect_fields = []
            review_reason = review_reason

        # Rule 2: BL_COMPARISON category logic
        elif category == "BL_COMPARISON":
            if c_row:
                has_defect = bool(c_row.get("has_defect", False))
                defect_fields = c_row.get("defect_fields") or []
                status = "MISMATCH" if has_defect else "OK"
                review_reason = None
            else:
                # Unprocessed BL_COMPARISON: NO comparison row and NO unresolved review
                errors.append(f"Email {eid}: category is BL_COMPARISON but no comparison row exists (Person B/C incomplete)")
                status = "NEEDS_REVIEW"
                review_reason = "missing_value"
                has_defect = False
                defect_fields = []

        # Rule 3: Non-BL categories (GENERAL, SPAM, SI_REQUEST, INVOICE_QUERY)
        else:
            status = "OK"
            review_reason = None
            has_defect = False
            defect_fields = []

        # Validate status enum
        if status not in VALID_STATUSES:
            errors.append(f"Email {eid}: invalid status '{status}'")

        # Validate defect_fields type
        if not isinstance(defect_fields, list):
            errors.append(f"Email {eid}: defect_fields must be a list")

        payload[eid] = {
            "category": category,
            "status": status,
            "review_reason": review_reason if status == "NEEDS_REVIEW" else None,
            "has_defect": has_defect,
            "defect_fields": defect_fields,
        }

    # Verify all expected IDs present
    missing_ids = set(expected_email_ids) - set(payload.keys())
    if missing_ids:
        errors.append(f"Submission missing {len(missing_ids)} email IDs: {sorted(list(missing_ids))[:5]}...")

    return payload, errors


@router.post("/submit-check")
def submit_check():
    """Builds final submission payload for all 520 emails, validates it, and POSTs to http://localhost:8080/submit."""
    payload, errors = build_submission_payload()

    if errors:
        return {
            "status": "validation_error",
            "message": "Submission payload validation failed",
            "errors": errors,
            "payload_sample_size": len(payload),
        }

    # Send payload to Docker server
    try:
        response = requests.post(DOCKER_SUBMIT_URL, json=payload, timeout=10)
        if response.status_code != 200:
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Docker submission server returned HTTP {response.status_code}: {response.text}",
            )
        return {
            "status": "ok",
            "submitted_emails": len(payload),
            "scoring": response.json(),
        }
    except requests.RequestException as err:
        raise HTTPException(
            status_code=503,
            detail=f"Failed to connect to Docker submission server at {DOCKER_SUBMIT_URL}: {err}",
        )
