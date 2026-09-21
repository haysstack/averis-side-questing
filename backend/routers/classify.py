import os
from collections import Counter
from pathlib import Path
from typing import Literal, Optional

import httpx
from google import genai
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from supabase import Client, create_client


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DOCKER_INBOX_URL = os.getenv("DOCKER_INBOX_URL", "http://localhost:8080")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

if not GEMINI_API_KEY:
    raise RuntimeError("Missing GEMINI_API_KEY in backend/.env")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise RuntimeError(
        "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in backend/.env"
    )

supabase: Client = create_client(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
)

router = APIRouter(tags=["Classification & Priority"])


class ClassificationResult(BaseModel):
    category: Literal[
        "BL_COMPARISON",
        "SI_REQUEST",
        "INVOICE_QUERY",
        "GENERAL",
        "SPAM",
    ]
    priority: Literal["Low", "Medium", "High"]
    summary: str


@router.get("/classification/health")
async def classification_health():
    return {"status": "classification router is working"}


@router.post("/seed-emails")
async def seed_emails():
    """Import all supplied hackathon emails into Supabase."""

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{DOCKER_INBOX_URL}/emails")
            response.raise_for_status()
            docker_emails = response.json()

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach Docker inbox server: {error}",
        )

    rows = [
        {
            "email_id": email["email_id"],
            "from_addr": email.get("from"),
            "subject": email.get("subject"),
            "body": email.get("body"),
        }
        for email in docker_emails
    ]

    try:
        supabase.table("emails").upsert(
            rows,
            on_conflict="email_id",
        ).execute()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not save emails to Supabase: {error}",
        )

    return {
        "message": "Emails imported successfully",
        "count": len(rows),
    }

@router.post("/classify/{email_id}")
async def classify_email(
    email_id: str,
    force: bool = Query(default=False),
):
    """Classify one email and save its initial priority and summary.

    A previously classified email returns its saved result unless force=true.
    This keeps the inbox from spending another Gemini request when users reopen an email.
    """

    existing = (
        supabase.table("emails")
        .select("email_id,category,priority,ai_summary,status")
        .eq("email_id", email_id)
        .maybe_single()
        .execute()
    )

    if existing.data and existing.data.get("status") == "CLASSIFIED" and not force:
        return {
            "email_id": email_id,
            "category": existing.data.get("category"),
            "priority": existing.data.get("priority"),
            "summary": existing.data.get("ai_summary"),
            "cached": True,
        }

    try:
        async with httpx.AsyncClient(timeout=30) as http_client:
            response = await http_client.get(
                f"{DOCKER_INBOX_URL}/emails/{email_id}"
            )
            response.raise_for_status()
            email = response.json()

    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=503,
            detail=f"Could not fetch email from Docker inbox: {error}",
        )

    # Email signatures and forwarded threads can be long. This keeps the
    # on-demand classification request fast while preserving the original body
    # in Supabase for the detail view.
    body = email.get("body", "")[:2500]
    prompt = f"""
You are classifying an email for a shipping-operations team.

Return only JSON matching the required schema.

Choose exactly one category:
- BL_COMPARISON: request to compare/check a Shipping Instruction against a draft Bill of Lading
- SI_REQUEST: request to create, provide, amend, or prepare Shipping Instructions
- INVOICE_QUERY: invoice, billing, charges, payment, cancellation, or freight-cost query
- GENERAL: operational update, reminder, report, announcement, or other normal message
- SPAM: phishing, scam, unsolicited prize/fee, mailbox warning, or irrelevant message

Set initial priority using ONLY urgency words and dates visible in the email:
- High: urgent/asap language or an imminent shipping/vessel deadline
- Medium: normal operational request or time-sensitive request
- Low: non-urgent update, announcement, or spam

Write a single concise plain-English summary.

Subject: {email.get("subject", "")}

Body:
{body}
"""

    try:
        interaction = gemini_client.interactions.create(
            model=GEMINI_MODEL,
            input=prompt,
            response_format={
                "type": "text",
                "mime_type": "application/json",
                "schema": ClassificationResult.model_json_schema(),
            },
        )

        result = ClassificationResult.model_validate_json(
            interaction.output_text
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Gemini classification failed: {error}",
        )

    row = {
        "email_id": email["email_id"],
        "from_addr": email.get("from"),
        "subject": email.get("subject"),
        "body": email.get("body"),
        "category": result.category,
        "priority": result.priority,
        "ai_summary": result.summary,
        "status": "CLASSIFIED",
    }

    try:
        supabase.table("emails").upsert(
            row,
            on_conflict="email_id",
        ).execute()

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not save classification to Supabase: {error}",
        )

    return {
        "email_id": email_id,
        "category": result.category,
        "priority": result.priority,
        "summary": result.summary,
        "cached": False,
    }


@router.get("/emails")
async def get_emails(
    category: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    sort: Optional[str] = Query(default=None),  # "priority" or "subject"
    search: Optional[str] = Query(default=None, max_length=200),
    search_field: str = Query(default="all"),
    sender_domain: Optional[str] = Query(default=None),
    attachments_only: bool = Query(default=False),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
):
    query = supabase.table("emails").select("*").order("email_id")

    if category:
        query = query.eq("category", category)

    if priority:
        query = query.eq("priority", priority)

    if status:
        query = query.eq("status", status)

    if attachments_only:
        try:
            async with httpx.AsyncClient(timeout=30) as http_client:
                inbox_response = await http_client.get(f"{DOCKER_INBOX_URL}/emails")
                inbox_response.raise_for_status()
                attachment_ids = [
                    email["email_id"]
                    for email in inbox_response.json()
                    if email.get("attachments")
                ]
        except httpx.HTTPError as error:
            raise HTTPException(
                status_code=503,
                detail=f"Could not filter attachment emails: {error}",
            )
        query = query.in_("email_id", attachment_ids)

    searchable_fields = {
        "id": "email_id",
        "sender": "from_addr",
        "subject": "subject",
        "content": "body",
        "category": "category",
        "priority": "priority",
        "summary": "ai_summary",
    }

    if search:
        term = search.replace("%", "\\%").replace(",", "\\,").replace(".", "\\.")
        if search_field == "all":
            query = query.or_(
                f"email_id.ilike.%{term}%,from_addr.ilike.%{term}%,"
                f"subject.ilike.%{term}%,body.ilike.%{term}%,"
                f"category.ilike.%{term}%,priority.ilike.%{term}%,"
                f"ai_summary.ilike.%{term}%"
            )
        elif search_field in searchable_fields:
            query = query.ilike(searchable_fields[search_field], f"%{term}%")
        else:
            raise HTTPException(status_code=422, detail="Unsupported search field")

    if sender_domain:
       query = query.ilike("from_addr", f"%@{sender_domain}%")
       
    if sort in ("priority", "subject"):
        rank = {"High": 0, "Medium": 1, "Low": 2}
        rows = query.execute().data or []
        rows.sort(key=lambda r: (
            rank.get(r.get("priority"), 3) if sort == "priority" else 0,
            (r.get("subject") or "").lower(),
        ))
        return rows[offset : offset + limit]

    result = query.range(offset, offset + limit - 1).execute()

    return result.data


@router.get("/emails/{email_id}")
async def get_email(email_id: str):
    result = (
        supabase.table("emails")
        .select("*")
        .eq("email_id", email_id)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Email not found")

    # Attachment paths live in the supplied Docker inbox, not the emails table.
    try:
        async with httpx.AsyncClient(timeout=15) as http_client:
            source_response = await http_client.get(
                f"{DOCKER_INBOX_URL}/emails/{email_id}"
            )
            source_response.raise_for_status()
            source_email = source_response.json()
    except httpx.HTTPError as error:
        raise HTTPException(
            status_code=503,
            detail=f"Could not fetch attachments from Docker inbox: {error}",
        )

    return {**result.data, "attachments": source_email.get("attachments", [])}


@router.get("/classification/stats")
async def classification_stats():
    """Return lightweight counts for testing the efficient-classification flow."""
    result = supabase.table("emails").select(
        "category,priority,status"
    ).execute()
    emails = result.data or []

    return {
        "total": len(emails),
        "by_status": dict(Counter(email.get("status") or "UNKNOWN" for email in emails)),
        "by_category": dict(
            Counter(email.get("category") or "UNCLASSIFIED" for email in emails)
        ),
        "by_priority": dict(
            Counter(email.get("priority") or "UNASSIGNED" for email in emails)
        ),
    }


@router.post("/classify-pending")
async def classify_pending(
    limit: int = Query(default=5, ge=1, le=50),
):
    """Classify a limited number of pending emails."""

    pending_result = (
        supabase.table("emails")
        .select("email_id")
        .eq("status", "PENDING")
        .limit(limit)
        .execute()
    )

    pending_emails = pending_result.data or []

    processed = []
    failed = []

    for email in pending_emails:
        email_id = email["email_id"]

        try:
            result = await classify_email(email_id)
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
        "processed_count": len(processed),
        "failed_count": len(failed),
        "processed": processed,
        "failed": failed,
    }



import re

# ---------------------------------------------------------------------------
# RECURRING SENDERS
# ---------------------------------------------------------------------------

def _sender_domain(from_addr: Optional[str]) -> Optional[str]:
    match = re.search(r"@([A-Za-z0-9.-]+\.[A-Za-z]{2,})", from_addr or "")
    return match.group(1).lower() if match else None


@router.get("/senders")
async def list_senders(
    min_count: int = Query(default=2, ge=1),
    limit: int = Query(default=8, ge=1, le=1000),
):
    """Sender domains, ordered by how many emails each one sent."""
    rows = supabase.table("emails").select("from_addr").execute().data or []
    counts = Counter(
        domain
        for domain in (_sender_domain(row.get("from_addr")) for row in rows)
        if domain
    )
    return [
        {"domain": domain, "count": count}
        for domain, count in counts.most_common()
        if count >= min_count
    ][:limit]


# ---------------------------------------------------------------------------
# DRAFT REPLY
# Templates first (for repetitive questions), Gemini only when no template fits.
# Edit REPLY_TEMPLATES to change wording or add cases.
# ---------------------------------------------------------------------------

SIGNATURE = "Best regards,\nShipping Documentation Team"

REPLY_TEMPLATES = [
    {
        "name": "Invoice query",
        "category": "INVOICE_QUERY",
        "keywords": ["invoice", "payment", "charge", "freight", "billing", "cancel"],
        "body": (
            'Thank you for your query regarding "{subject}".\n\n'
            "Our accounts team is reviewing it and we will come back to you within "
            "1 business day. To speed things up, please reply with the invoice number "
            "and the booking or shipment reference.\n\n"
        ),
    },
    {
        "name": "SI request",
        "category": "SI_REQUEST",
        "keywords": [],
        "body": (
            "Thank you for your Shipping Instruction request.\n\n"
            "We are preparing the shipping instruction and will confirm once it has "
            "been lodged with the carrier. If any details are missing we will contact you.\n\n"
        ),
    },
    {
        "name": "General acknowledgement",
        "category": "GENERAL",
        "keywords": ["update", "reminder", "noted", "fyi", "schedule", "announcement"],
        "body": (
            "Thank you for the update. We have noted it and will get back to you "
            "if anything further is needed.\n\n"
        ),
    },
]

REPLY_FIELD_LABELS = {
    "shipper": "Shipper",
    "consignee": "Consignee",
    "notify_party": "Notify party",
    "port_of_loading": "Port of loading",
    "port_of_discharge": "Port of discharge",
    "container_count": "Container count",
    "gross_weight_kg": "Gross weight (kg)",
}


class ReplyDraft(BaseModel):
    to: Optional[str] = None
    subject: str
    body: str
    source: Literal["template", "ai"]
    template: Optional[str] = None


def _recipient_email(from_addr: Optional[str]) -> Optional[str]:
    match = re.search(r"[\w.+-]+@[\w.-]+\.\w+", from_addr or "")
    return match.group() if match else None


def _recipient_name(from_addr: Optional[str]) -> str:
    address = _recipient_email(from_addr)
    if not address:
        return "Sir or Madam"
    name = re.sub(r"[._-]+", " ", address.split("@")[0]).strip().title()
    return name if name and not any(ch.isdigit() for ch in name) else "Sir or Madam"


def _pick_template(category: Optional[str], text: str) -> Optional[dict]:
    lowered = text.lower()
    for template in REPLY_TEMPLATES:
        if template["category"] != category:
            continue
        if not template["keywords"] or any(word in lowered for word in template["keywords"]):
            return template
    return None


def _bl_reply(email_id: str) -> tuple[str, str]:
    """Uses the comparison result if one exists, otherwise a plain acknowledgement."""
    try:
        rows = (
            supabase.table("comparisons").select("*").eq("email_id", email_id).limit(1).execute().data
            or []
        )
        if rows:
            defects = rows[0].get("defect_fields") or []
            if not rows[0].get("has_defect") or not defects:
                return (
                    "SI/BL check result",
                    "We have compared the draft Bill of Lading with the Shipping Instruction. "
                    "No mismatch detected.\n\n",
                )
            extracted = (
                supabase.table("extractions").select("*").eq("email_id", email_id).execute().data
                or []
            )
            si = next((r for r in extracted if r.get("doc_type") == "SI"), {})
            bl = next((r for r in extracted if r.get("doc_type") == "BL"), {})
            lines = "\n".join(
                f"- {REPLY_FIELD_LABELS.get(f, f)}: SI {si.get(f)} / BL {bl.get(f)}" for f in defects
            )
            return (
                "SI/BL check result",
                "We have compared the draft Bill of Lading with the Shipping Instruction "
                f"and found the following mismatches:\n\n{lines}\n\n"
                "Please confirm the correct details so we can amend the draft.\n\n",
            )
    except Exception:
        pass  # no comparison data yet: fall through to the acknowledgement

    return (
        "SI/BL check acknowledgement",
        "Thank you for your request to check the draft Bill of Lading against the "
        "Shipping Instruction. We have received both documents and will send you "
        "the result of the check shortly.\n\n",
    )


@router.post("/reply/{email_id}", response_model=ReplyDraft)
async def draft_reply(email_id: str, force_ai: bool = Query(default=False)):
    """Draft a reply. force_ai=true skips the templates and asks Gemini."""
    rows = supabase.table("emails").select("*").eq("email_id", email_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Email not found")

    email = rows[0]
    category = email.get("category")
    if category == "SPAM":
        raise HTTPException(status_code=400, detail="Spam emails do not get a reply.")

    subject = email.get("subject") or ""
    body_text = (email.get("body") or "")[:2500]
    from_addr = email.get("from_addr")
    name = _recipient_name(from_addr)
    reply_subject = subject if subject.lower().startswith("re:") else f"Re: {subject}"
    greeting = f"Dear {name},\n\n"

    if not force_ai:
        if category == "BL_COMPARISON":
            template_name, middle = _bl_reply(email_id)
        else:
            template = _pick_template(category, f"{subject} {body_text}")
            template_name = template["name"] if template else None
            middle = template["body"].replace("{subject}", subject) if template else None

        if middle:
            return ReplyDraft(
                to=_recipient_email(from_addr),
                subject=reply_subject,
                body=f"{greeting}{middle}{SIGNATURE}",
                source="template",
                template=template_name,
            )

    prompt = f"""You write replies for a shipping-operations team.
Write a short, polite reply to the email below. Do not invent facts, dates, prices
or booking numbers; ask for anything that is missing. Return only the email body,
starting with "Dear {name}," and ending with "Best regards, Shipping Documentation Team".

Category: {category}
Subject: {subject}

{body_text}
"""
    try:
        response = gemini_client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
        reply_body = (response.text or "").strip()
    except Exception as error:
        raise HTTPException(status_code=502, detail=f"Gemini reply failed: {error}")

    if not reply_body:
        raise HTTPException(status_code=502, detail="Gemini returned an empty reply.")

    return ReplyDraft(
        to=_recipient_email(from_addr),
        subject=reply_subject,
        body=reply_body,
        source="ai",
    )
