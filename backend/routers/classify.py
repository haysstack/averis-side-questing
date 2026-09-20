import os
import httpx

from pathlib import Path
from typing import Optional
from typing import Literal
from google import genai
from db import supabase           # still works — Python looks from where you run uvicorn (backend/), not from the file's own folder
from data_source import get_email, get_attachment_text
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from supabase import Client, create_client


ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
DOCKER_INBOX_URL = os.getenv("DOCKER_INBOX_URL", "http://localhost:8080")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

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
async def classify_email(email_id: str):
    """Classify one email and save its initial priority and summary."""

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
    }


@router.get("/emails")
async def get_emails(
    category: Optional[str] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
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

    return result.data

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