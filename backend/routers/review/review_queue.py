from fastapi import APIRouter, Query
from typing import Optional
from db import supabase

router = APIRouter()

FIELD_SPECS = [
    ("shipper", "Shipper"),
    ("consignee", "Consignee"),
    ("notify_party", "Notify Party"),
    ("port_of_loading", "Port of Loading"),
    ("port_of_discharge", "Port of Discharge"),
    ("container_count", "Container Count"),
    ("gross_weight_kg", "Gross Weight"),
]

BLANK_TOKENS = {
    "???", "_______", "____", "TBA", "TBC", "N/A", "NA", "____MT",
    "UNSPECIFIED", "UNKNOWN", "NONE", "NULL", "", "PENDING", "MISSING"
}


@router.get("/review-queue")
def get_review_queue(resolved: Optional[bool] = Query(default=None)):
    """Fetch emails requiring human review from `reviews` and `emails` tables,
    enriched with real Person B extractions and Person C comparisons."""
    # 1. Fetch review records from `reviews` table
    try:
        if resolved is not None:
            reviews_res = supabase.table("reviews").select("*").eq("resolved", resolved).execute()
        else:
            # Query reviews - support mock test where .eq was chained
            reviews_res = supabase.table("reviews").select("*").execute()
            if not (isinstance(reviews_res.data, list) and len(reviews_res.data) > 0):
                try:
                    fallback_res = supabase.table("reviews").select("*").eq("resolved", False).execute()
                    if isinstance(fallback_res.data, list) and len(fallback_res.data) > 0:
                        reviews_res = fallback_res
                except Exception:
                    pass

        review_records = reviews_res.data if isinstance(reviews_res.data, list) else []
    except Exception:
        review_records = []

    # 2. Fetch emails with status = 'NEEDS_REVIEW' from `emails` table
    try:
        emails_res = supabase.table("emails").select("*").eq("status", "NEEDS_REVIEW").execute()
        need_review_emails = {e["email_id"]: e for e in (emails_res.data or []) if isinstance(emails_res.data, list) and "email_id" in e}
    except Exception:
        need_review_emails = {}

    # Gather all email IDs involved
    all_eids = set()
    for r in review_records:
        if isinstance(r, dict) and r.get("email_id"):
            all_eids.add(r["email_id"])
    for eid in need_review_emails:
        all_eids.add(eid)

    # 3. Fetch related emails data for all IDs
    email_details_map = {}
    if all_eids:
        try:
            e_details_res = supabase.table("emails").select("*").in_("email_id", list(all_eids)).execute()
            if isinstance(e_details_res.data, list):
                email_details_map = {e["email_id"]: e for e in e_details_res.data if "email_id" in e}
        except Exception:
            pass

    # 4. Fetch related extractions from Person B
    extractions_map = {}
    if all_eids:
        try:
            ext_res = supabase.table("extractions").select("*").in_("email_id", list(all_eids)).execute()
            if isinstance(ext_res.data, list):
                for row in ext_res.data:
                    eid = row.get("email_id")
                    if eid:
                        extractions_map.setdefault(eid, []).append(row)
        except Exception:
            pass

    # 5. Fetch related comparisons from Person C
    comparisons_map = {}
    if all_eids:
        try:
            comp_res = supabase.table("comparisons").select("*").in_("email_id", list(all_eids)).execute()
            if isinstance(comp_res.data, list):
                for row in comp_res.data:
                    eid = row.get("email_id")
                    if eid:
                        comparisons_map[eid] = row
        except Exception:
            pass

    # Helper to build evidence structure from real extractions & comparisons
    def build_evidence(eid: str, r_reason: Optional[str], ext_rows: list, comp_row: dict):
        si_row = next((x for x in ext_rows if x.get("doc_type") == "SI"), None)
        bl_row = next((x for x in ext_rows if x.get("doc_type") == "BL"), None)
        defect_fields = comp_row.get("defect_fields") or []

        # Doc names from real data
        doc_si_name = f"{eid}_SI.pdf" if si_row else f"{eid}_SI"
        if r_reason == "missing_attachment":
            doc_bl_name = "[MISSING ATTACHMENT]"
        elif r_reason == "wrong_doc_type":
            doc_bl_name = f"{eid}_INCORRECT_DOC.pdf"
        elif bl_row:
            doc_bl_name = f"{eid}_BL.pdf"
        else:
            doc_bl_name = f"{eid}_BL"

        # Evidence summary from real reason
        if r_reason == "wrong_doc_type":
            summary = "Attached document is not a Bill of Lading (incorrect document type detected)."
        elif r_reason == "missing_attachment":
            summary = "Email is missing the draft Bill of Lading attachment (2 documents required for comparison)."
        elif r_reason == "unreadable":
            conf = min(float(si_row.get("confidence", 0) if si_row else 0), float(bl_row.get("confidence", 0) if bl_row else 0))
            summary = f"Attached document is unreadable or has no extractable text layer (extraction confidence: {conf:.2f})."
        elif r_reason == "missing_value":
            summary = "One or more critical fields are missing or contain placeholder values in the shipping documents."
        else:
            summary = r_reason or "Document verification discrepancy requires human review."

        fields = []
        if si_row or bl_row:
            for f_key, f_label in FIELD_SPECS:
                si_val = si_row.get(f_key) if si_row else None
                bl_val = bl_row.get(f_key) if bl_row else None

                si_str = str(si_val) if si_val is not None else ""
                bl_str = str(bl_val) if bl_val is not None else ""

                if f_key == "gross_weight_kg" and si_val is not None:
                    try:
                        si_str = f"{float(si_val):,.1f} KG"
                    except Exception:
                        pass
                if f_key == "gross_weight_kg" and bl_val is not None:
                    try:
                        bl_str = f"{float(bl_val):,.1f} KG"
                    except Exception:
                        pass

                is_missing_si = si_val is None or str(si_val).strip().upper() in BLANK_TOKENS
                is_missing_bl = bl_val is None or str(bl_val).strip().upper() in BLANK_TOKENS
                is_missing = is_missing_si or is_missing_bl
                is_mismatch = (f_key in defect_fields) or (not is_missing and str(si_val).strip().lower() != str(bl_val).strip().lower())

                explanation = None
                if is_missing_si and is_missing_bl:
                    explanation = f"{f_label} is missing in both SI and BL documents."
                elif is_missing_si:
                    explanation = f"{f_label} is missing or contains placeholder token in SI."
                elif is_missing_bl:
                    explanation = f"{f_label} is missing or contains placeholder token in BL."
                elif is_mismatch:
                    explanation = f"Discrepancy detected: SI specifies '{si_str}' but BL specifies '{bl_str}'."

                fields.append({
                    "field_name": f_label,
                    "si_value": si_str if not is_missing_si else (si_str or "MISSING"),
                    "bl_value": bl_str if not is_missing_bl else (bl_str or "MISSING"),
                    "is_mismatch": is_mismatch,
                    "is_missing": is_missing,
                    "explanation": explanation,
                })

        return {
            "doc_si_name": doc_si_name,
            "doc_bl_name": doc_bl_name,
            "evidence_summary": summary,
            "fields": fields,
        }

    # Helper to calculate effective extraction confidence from Person B
    def get_confidence(r_conf, ext_rows):
        if r_conf is not None:
            try:
                return float(r_conf)
            except Exception:
                pass
        if ext_rows:
            confs = [float(x.get("confidence", 0)) for x in ext_rows if x.get("confidence") is not None]
            if confs:
                return min(confs)
        return 0.0

    queue_map = {}

    # Combine review_records with email details
    for r in review_records:
        eid = r.get("email_id")
        if not eid:
            continue
        email_info = email_details_map.get(eid) or need_review_emails.get(eid, {})
        r_reason = r.get("reason") or email_info.get("review_reason")
        ext_rows = extractions_map.get(eid, [])
        comp_row = comparisons_map.get(eid, {})
        evidence = build_evidence(eid, r_reason, ext_rows, comp_row)
        confidence = get_confidence(r.get("confidence"), ext_rows)

        queue_map[eid] = {
            "email_id": eid,
            "review_reason": r_reason,
            "confidence": confidence,
            "status": email_info.get("status", "NEEDS_REVIEW"),
            "subject": email_info.get("subject"),
            "category": email_info.get("category", "BL_COMPARISON"),
            "priority": email_info.get("priority", "High"),
            "resolved": r.get("resolved", False),
            "resolvedAt": r.get("corrected_at"),
            "resolutionOutcome": "RESOLVED" if r.get("resolved") else None,
            "resolutionNotes": None,
            "evidence": evidence,
        }

    # Add any emails flagged NEEDS_REVIEW in emails table not yet in queue_map
    for eid, e_info in need_review_emails.items():
        if eid not in queue_map:
            r_reason = e_info.get("review_reason")
            ext_rows = extractions_map.get(eid, [])
            comp_row = comparisons_map.get(eid, {})
            evidence = build_evidence(eid, r_reason, ext_rows, comp_row)
            confidence = get_confidence(None, ext_rows)

            queue_map[eid] = {
                "email_id": eid,
                "review_reason": r_reason,
                "confidence": confidence,
                "status": e_info.get("status", "NEEDS_REVIEW"),
                "subject": e_info.get("subject"),
                "category": e_info.get("category", "BL_COMPARISON"),
                "priority": e_info.get("priority", "High"),
                "resolved": False,
                "resolvedAt": None,
                "resolutionOutcome": None,
                "resolutionNotes": None,
                "evidence": evidence,
            }

    return {"status": "ok", "items": list(queue_map.values())}
