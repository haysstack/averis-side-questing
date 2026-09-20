from fastapi import APIRouter
from db import supabase

router = APIRouter()

@router.post("/review/{email_id}/resolve")
def resolve_review(email_id: str):
    """Handle human review resolution for an email."""
    return {"status": "ok", "email_id": email_id, "resolved": True}
