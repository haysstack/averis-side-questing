import re
from db import supabase

BLANK_TOKENS = {
    "???", "_______", "____", "TBA", "TBC", "N/A", "NA", "____MT",
    "UNSPECIFIED", "UNKNOWN", "NONE", "NULL", "", "PENDING"
}

REQUIRED_FIELDS = [
    "shipper",
    "consignee",
    "notify_party",
    "port_of_loading",
    "port_of_discharge",
    "container_count",
    "gross_weight_kg",
]

WRONG_DOC_PATTERNS = [
    r"COMMERCIAL\s+INVOICE",
    r"PACKING\s+LIST",
    r"CERTIFICATE\s+OF\s+ORIGIN",
    r"NOT\s+A\s+SHIPPING\s+INSTRUCTION",
    r"NOT\s+AN?\s+SI\s+OR\s+BL",
    r"INVOICE\s+NO\.",
    r"PAYMENT\s+TERMS:",
    r"CARTON\s+NO\.",
    r"HS\s+CODE:",
    r"ISSUING\s+AUTHORITY",
]


def create_review_record(email_id: str, reason: str, confidence: float = 1.0):
    """Writes a record to `reviews` and updates `emails.status = 'NEEDS_REVIEW'`."""
    # 1. Update emails status & review_reason
    supabase.table("emails").update({
        "status": "NEEDS_REVIEW",
        "review_reason": reason
    }).eq("email_id", email_id).execute()

    # 2. Insert into reviews table
    review_data = {
        "email_id": email_id,
        "reason": reason,
        "confidence": confidence,
        "resolved": False
    }
    res = supabase.table("reviews").insert(review_data).execute()
    return res.data


def check_wrong_doc_type(doc_text: str, filename: str = "") -> bool:
    """Detects if an attached document is a non-SI/BL document (e.g. Invoice, Packing List, COO)."""
    text_upper = (doc_text or "").upper()
    filename_upper = (filename or "").upper()

    for pattern in WRONG_DOC_PATTERNS:
        if re.search(pattern, text_upper):
            return True

    if "INVOICE" in filename_upper or "PACKING" in filename_upper or "COO" in filename_upper:
        return True

    return False


def check_missing_attachment(email_data: dict) -> bool:
    """Detects if a BL_COMPARISON email has 0 or only 1 attachment (requires 2 for comparison)."""
    if not email_data:
        return True
    attachments = email_data.get("attachments", [])
    if isinstance(attachments, list):
        return len(attachments) < 2
    return True


def check_unreadable(file_bytes: bytes, file_text: str = "", filename: str = "") -> bool:
    """Detects 0-byte files, corrupted bytes, or PDFs with no extractable text layer (scanned)."""
    # 1. 0-byte file check
    if not file_bytes or len(file_bytes) == 0:
        return True

    # 2. PDF specific checks
    is_pdf = filename.lower().endswith(".pdf") or file_bytes.startswith(b"%PDF-")
    if is_pdf:
        # Check corrupted PDF header
        if not file_bytes.startswith(b"%PDF-"):
            return True
        # Check missing EOF marker
        if b"%%EOF" not in file_bytes[-1024:]:
            return True
        # If PDF has no extractable text layer (scanned PDF)
        if not file_text or len(file_text.strip()) == 0:
            return True
        if "SCANNED COPY" in file_text.upper() or "NO OCR TEXT LAYER" in file_text.upper():
            return True

    # 3. Plain text empty check
    if not file_text and (not filename or filename.lower().endswith(".txt")):
        return True

    return False


def check_missing_value(extracted_fields: dict) -> tuple[bool, list[str]]:
    """Detects if required fields in extracted SI/BL are missing or contain placeholder tokens."""
    if not extracted_fields:
        return True, REQUIRED_FIELDS

    missing_fields = []
    for field in REQUIRED_FIELDS:
        val = extracted_fields.get(field)
        if val is None:
            missing_fields.append(field)
            continue
        val_str = str(val).strip()
        if val_str in BLANK_TOKENS or val_str.upper() in BLANK_TOKENS:
            missing_fields.append(field)

    return len(missing_fields) > 0, missing_fields


def evaluate_and_flag_reliability(
    email_id: str,
    email_data: dict = None,
    attachments_text: list[dict] = None,
    attachments_bytes: list[dict] = None,
    extractions: list[dict] = None,
) -> tuple[bool, str | None]:
    """Runs all 4 edge-case detectors.

    If an edge case is found, calls `create_review_record` and returns (True, reason).
    Otherwise returns (False, None).
    """
    # 1. Check missing attachment
    if email_data and email_data.get("category") == "BL_COMPARISON":
        if check_missing_attachment(email_data):
            reason = "missing_attachment"
            create_review_record(email_id, reason)
            return True, reason

    # 2. Check unreadable & wrong doc type on attachments
    if attachments_bytes or attachments_text:
        att_map_bytes = {a.get("path", ""): a.get("bytes", b"") for a in (attachments_bytes or [])}
        att_map_text = {a.get("path", ""): a.get("text", "") for a in (attachments_text or [])}
        all_paths = set(att_map_bytes.keys()).union(att_map_text.keys())

        for path in all_paths:
            b_data = att_map_bytes.get(path, b"")
            t_data = att_map_text.get(path, "")

            # Unreadable check
            if check_unreadable(b_data, t_data, filename=path):
                reason = "unreadable"
                create_review_record(email_id, reason)
                return True, reason

            # Wrong doc type check
            if check_wrong_doc_type(t_data, filename=path):
                reason = "wrong_doc_type"
                create_review_record(email_id, reason)
                return True, reason

    # 3. Check missing value in extractions
    if extractions:
        for ext in extractions:
            has_missing, missing_list = check_missing_value(ext)
            if has_missing:
                reason = "missing_value"
                create_review_record(email_id, reason)
                return True, reason

    return False, None
