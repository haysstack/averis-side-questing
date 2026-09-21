from datetime import datetime
from typing import Dict, Optional
from fastapi import APIRouter
from pydantic import BaseModel
from db import supabase

router = APIRouter()


class ResolveRequest(BaseModel):
    outcome: Optional[str] = "RESOLVED"
    notes: Optional[str] = None
    corrections: Optional[Dict[str, str]] = None
    corrected_by: Optional[str] = "human_reviewer"


@router.post("/review/{email_id}/resolve")
async def resolve_review(email_id: str, body: Optional[ResolveRequest] = None):
    """Handle human review resolution for an email.

    If field corrections are provided, updates extractions (BL row) and invokes
    Person C's original compare_email(email_id) to re-compare documents.
    Updates the reviews table and emails status.
    """
    outcome = body.outcome if body else "RESOLVED"
    notes = body.notes if body else None
    corrections = body.corrections if body else None
    corrected_by = body.corrected_by if (body and body.corrected_by) else "human_reviewer"
    now_iso = datetime.utcnow().isoformat()

    # 1. If corrections provided, update extractions (BL row) and re-run Person C comparison
    if corrections:
        update_dict = {}
        for k, v in corrections.items():
            if not v or str(v).strip() in ("", "???", "_______"):
                continue
            if k == "container_count":
                try:
                    update_dict[k] = int(str(v).strip())
                except ValueError:
                    pass
            elif k == "gross_weight_kg":
                try:
                    clean_wt = str(v).replace(",", "").replace("KG", "").replace("kg", "").strip()
                    update_dict[k] = float(clean_wt)
                except ValueError:
                    pass
            else:
                update_dict[k] = str(v).strip()

        if update_dict:
            try:
                # Update BL extraction row in extractions table
                supabase.table("extractions").update(update_dict).eq("email_id", email_id).eq("doc_type", "BL").execute()
            except Exception as err:
                print(f"Warning: Could not update extractions for {email_id}: {err}")

        # Invoke Person C's original compare_email
        try:
            from routers.compare import compare_email
            await compare_email(email_id)
        except Exception as err:
            print(f"Warning: Re-running compare_email for {email_id} failed: {err}")

    # 2. Update reviews table: mark resolved = True
    try:
        supabase.table("reviews").update({
            "resolved": True,
            "corrected_by": corrected_by,
            "corrected_at": now_iso,
        }).eq("email_id", email_id).execute()
    except Exception as err:
        print(f"Warning: Could not update reviews table for {email_id}: {err}")

    # 3. If no corrections provided (or status still NEEDS_REVIEW), update emails status to RESOLVED
    try:
        email_row = supabase.table("emails").select("status").eq("email_id", email_id).maybe_single().execute()
        current_status = email_row.data.get("status") if email_row.data else None
        if current_status == "NEEDS_REVIEW" or not corrections:
            supabase.table("emails").update({
                "status": "RESOLVED",
            }).eq("email_id", email_id).execute()
    except Exception as err:
        print(f"Warning: Could not update emails status for {email_id}: {err}")

    return {
        "status": "ok",
        "email_id": email_id,
        "resolved": True,
        "outcome": outcome,
        "notes": notes,
    }
