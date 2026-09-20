from fastapi import APIRouter
from db import supabase

router = APIRouter()

@router.get("/review-queue")
def get_review_queue():
    """Fetch emails requiring human review from `reviews` and `emails` tables."""
    # 1. Fetch unresolved review records from `reviews` table
    try:
        reviews_res = supabase.table("reviews").select("*").eq("resolved", False).execute()
        review_records = reviews_res.data or []
    except Exception:
        review_records = []

    # 2. Fetch emails with status = 'NEEDS_REVIEW' from `emails` table
    try:
        emails_res = supabase.table("emails").select("*").eq("status", "NEEDS_REVIEW").execute()
        need_review_emails = {e["email_id"]: e for e in (emails_res.data or [])}
    except Exception:
        need_review_emails = {}

    queue_map = {}

    # Combine review_records with email details
    for r in review_records:
        eid = r.get("email_id")
        if not eid:
            continue
        email_info = need_review_emails.get(eid, {})
        if not email_info:
            try:
                e_res = supabase.table("emails").select("subject, category, status, review_reason").eq("email_id", eid).execute()
                if e_res.data:
                    email_info = e_res.data[0]
            except Exception:
                email_info = {}

        queue_map[eid] = {
            "email_id": eid,
            "review_reason": r.get("reason") or email_info.get("review_reason"),
            "confidence": r.get("confidence"),
            "status": email_info.get("status", "NEEDS_REVIEW"),
            "subject": email_info.get("subject"),
            "category": email_info.get("category"),
            "resolved": r.get("resolved", False),
        }

    # Add any emails flagged NEEDS_REVIEW in emails table not yet in queue_map
    for eid, e_info in need_review_emails.items():
        if eid not in queue_map:
            queue_map[eid] = {
                "email_id": eid,
                "review_reason": e_info.get("review_reason"),
                "confidence": None,
                "status": e_info.get("status", "NEEDS_REVIEW"),
                "subject": e_info.get("subject"),
                "category": e_info.get("category"),
                "resolved": False,
            }

    return {"status": "ok", "items": list(queue_map.values())}
