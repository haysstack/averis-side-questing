# backend/routers/si_creation.py

import os
import re
import json
from pathlib import Path
from typing import Optional, Literal

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from google import genai

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

DOCKER_INBOX_URL = os.getenv("DOCKER_INBOX_URL", "http://localhost:8080")
LOCAL_BUNDLE_INBOX = Path(__file__).resolve().parent.parent.parent / "sdoc-hackathon-bundle" / "inbox"
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

router = APIRouter(prefix="/si", tags=["SI Creation"])

# Initialize Gemini client if key is available
gemini_client = None
if GEMINI_API_KEY:
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Warning: Could not initialize Gemini client in si_creation: {e}")


# ---------------------------------------------------------------------------
# DATA MODELS
# ---------------------------------------------------------------------------

class CustomField(BaseModel):
    label: str
    value: str


class SIDraftData(BaseModel):
    email_id: str
    template: str = "averis_default"  # e.g., 'averis_default', 'april_fine_paper'
    
    booking_ref: Optional[str] = None
    shipper: Optional[str] = None
    consignee: Optional[str] = None
    notify_party: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    
    container_count: Optional[int] = None
    container_type: Optional[str] = None
    gross_weight_kg: Optional[float] = None
    cargo_description: Optional[str] = None
    hs_code: Optional[str] = None
    
    vessel_name: Optional[str] = None
    voyage_no: Optional[str] = None
    freight_term: Optional[str] = None
    special_instructions: Optional[str] = None
    custom_fields: list[CustomField] = []
    
    sender_email: Optional[str] = None
    email_subject: Optional[str] = None
    raw_email_body: Optional[str] = None
    
    company_header: Optional[str] = None
    document_title: Optional[str] = None
    
    missing_fields: list[str] = []
    draft_email_response: Optional[str] = None
    status: Literal["COMPLETE", "MISSING_INFO"] = "COMPLETE"


class SIExtractionRaw(BaseModel):
    booking_ref: Optional[str] = None
    shipper: Optional[str] = None
    consignee: Optional[str] = None
    notify_party: Optional[str] = None
    port_of_loading: Optional[str] = None
    port_of_discharge: Optional[str] = None
    container_count: Optional[int] = None
    container_type: Optional[str] = None
    gross_weight_kg: Optional[float] = None
    cargo_description: Optional[str] = None
    hs_code: Optional[str] = None
    vessel_name: Optional[str] = None
    voyage_no: Optional[str] = None
    freight_term: Optional[str] = None
    special_instructions: Optional[str] = None


# ---------------------------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------------------------

async def fetch_email_data(email_id: str) -> dict:
    """Fetch email from Docker inbox server, falling back to local bundle files."""
    # 1. Try Docker inbox HTTP endpoint
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{DOCKER_INBOX_URL}/emails/{email_id}")
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass

    # 2. Fallback to local bundle JSON file
    local_file = LOCAL_BUNDLE_INBOX / f"{email_id}.json"
    if local_file.exists():
        try:
            with open(local_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read local email file: {e}")

    raise HTTPException(status_code=404, detail=f"Email {email_id} not found in Docker inbox or local bundle.")


def detect_missing_fields(data: SIExtractionRaw) -> list[str]:
    """Identify operational shipping fields that are missing or required."""
    missing = []
    
    field_checks = [
        ("booking_ref", "Booking Reference / Order Confirmation No."),
        ("shipper", "Shipper Details"),
        ("consignee", "Consignee Details"),
        ("notify_party", "Notify Party"),
        ("port_of_loading", "Port of Loading (POL)"),
        ("port_of_discharge", "Port of Discharge (POD)"),
        ("container_count", "Container Quantity"),
        ("gross_weight_kg", "Gross Weight (KG)"),
        ("cargo_description", "Cargo / Commodity Description"),
        ("vessel_name", "Vessel Name"),
        ("voyage_no", "Voyage Number"),
    ]
    
    for field_name, label in field_checks:
        val = getattr(data, field_name, None)
        if val is None or str(val).strip() in ("", "None", "TBA", "???", "_______"):
            missing.append(label)
            
    return missing


def generate_followup_email(
    sender: str,
    subject: str,
    booking_ref: Optional[str],
    missing_fields: list[str]
) -> str:
    """Draft a courteous, operational follow-up email requesting missing details."""
    recipient_name = sender.split("@")[0].replace(".", " ").replace("_", " ").title() if sender else "Valued Partner"
    ref_mention = f" for Booking Ref: {booking_ref}" if booking_ref else ""
    
    items_list = "\n".join([f"  - {f}" for f in missing_fields])
    
    return (
        f"Dear {recipient_name},\n\n"
        f"Thank you for your Shipping Instruction request{ref_mention}.\n\n"
        f"We have compiled the draft Shipping Instruction based on the details provided. "
        f"However, to finalize the SI and confirm booking with the ocean carrier, "
        f"please provide the following missing information at your earliest convenience:\n\n"
        f"{items_list}\n\n"
        f"Once received, we will promptly finalize the SI and transmit it to the carrier to generate your draft Bill of Lading.\n\n"
        f"Best regards,\n"
        f"Shipping Documentation Team\n"
        f"Averis Global Logistics Services"
    )


def generate_confirmation_email(
    sender: str,
    subject: str,
    booking_ref: Optional[str],
    data: SIExtractionRaw
) -> str:
    """Draft a courteous confirmation email informing the partner that the SI is complete and lodged."""
    recipient_name = sender.split("@")[0].replace(".", " ").replace("_", " ").title() if sender else "Valued Partner"
    ref_mention = f" for Booking Ref: {booking_ref}" if booking_ref else ""
    vessel_str = f"{data.vessel_name or 'TBA by Carrier'} / {data.voyage_no or 'TBA'}"
    cntr_str = f"{data.container_count or 1} x {data.container_type or '20GP'}"
    wt_str = f"{data.gross_weight_kg:,.1f} KG" if data.gross_weight_kg else "As per packing list"
    
    return (
        f"Dear {recipient_name},\n\n"
        f"Thank you for your Shipping Instruction request{ref_mention}.\n\n"
        f"We are pleased to confirm that all required shipping particulars have been verified and found in order. "
        f"The official Shipping Instruction (SI) has been successfully created and lodged with the ocean carrier for Bill of Lading generation.\n\n"
        f"Key Shipment Particulars Confirmed:\n"
        f"  - Booking Reference: {booking_ref or 'N/A'}\n"
        f"  - Ocean Vessel / Voyage: {vessel_str}\n"
        f"  - Port of Loading (POL): {data.port_of_loading or 'N/A'}\n"
        f"  - Port of Discharge (POD): {data.port_of_discharge or 'N/A'}\n"
        f"  - Container Particulars: {cntr_str} ({wt_str})\n"
        f"  - Freight Terms: {data.freight_term or 'CFR TERM'}\n\n"
        f"The carrier will issue the draft Bill of Lading (B/L) in due course. "
        f"We will promptly forward the draft B/L for your final review and approval as soon as it is released.\n\n"
        f"Best regards,\n"
        f"Shipping Documentation Team\n"
        f"Averis Global Logistics Services"
    )


def extract_custom_fields(body: str, subject: str) -> list[CustomField]:
    """Automatically detect unique or additional operational fields in the email."""
    custom: list[CustomField] = []
    full_text = f"{subject}\n{body}"
    
    # 1. PO Number / PO Ref
    po_m = re.search(r"\b(PO[_\-\s]?\d{2}[_\-\s]?\d{3,6})\b", full_text, re.IGNORECASE)
    if po_m:
        custom.append(CustomField(label="PO Reference", value=po_m.group(1).upper()))
        
    # 2. PIN Number (East African Tax PIN, Kenya etc)
    pin_m = re.search(r"PIN\s*NO\.?[:\s\-]+([A-Z0-9]{8,15})", full_text, re.IGNORECASE)
    if pin_m:
        custom.append(CustomField(label="Consignee / Notify PIN No.", value=pin_m.group(1).upper()))
        
    # 3. GST Number (India etc)
    gst_m = re.search(r"GST\s*NO\.?[:\s\-]+([A-Z0-9]{10,20})", full_text, re.IGNORECASE)
    if gst_m:
        custom.append(CustomField(label="GST Tax ID", value=gst_m.group(1).upper()))
        
    # 4. Carrier / Line
    carrier_m = re.search(r"DIRECT\(([^)]+)\)", full_text, re.IGNORECASE)
    if carrier_m:
        custom.append(CustomField(label="Carrier / Shipping Line", value=f"DIRECT ({carrier_m.group(1).upper()})"))
    else:
        sline_m = re.search(r"Shipping line:\s*([^\n\r]+)", body, re.IGNORECASE)
        if sline_m and "TERM" not in sline_m.group(1).upper():
            custom.append(CustomField(label="Shipping Line", value=sline_m.group(1).strip()))

    # 5. BL Type
    bl_type_m = re.search(r"\b(SURR\s*BL|HOUSE\s*BL|ORIGINAL\s*BL|OBL|SEAWAY\s*BILL|SWB|TELEX\s*RELEASE)\b", full_text, re.IGNORECASE)
    if bl_type_m:
        bl_map = {
            "SURR BL": "Surrendered B/L (Express Release)",
            "HOUSE BL": "House Bill of Lading (HBL)",
            "OBL": "Original Bill of Lading (OBL)",
            "ORIGINAL BL": "Original Bill of Lading (OBL)",
            "SWB": "Sea Waybill (SWB)",
            "SEAWAY BILL": "Sea Waybill (SWB)",
            "TELEX RELEASE": "Telex Release B/L",
        }
        val = bl_type_m.group(1).upper()
        custom.append(CustomField(label="Bill of Lading Type", value=bl_map.get(val, val)))

    # 6. Carrier SI Ref / Carrier Booking No (e.g. SIJ1051834, SINF96556981, SIN706562729, OOLU5310033092)
    carrier_ref_m = re.search(r"\b(SIJ\d{6,10}|SINF\d{6,10}|SIN\d{8,12}|OOLU\d{8,12}|YMJAI\d{8,12})\b", full_text)
    if carrier_ref_m:
        custom.append(CustomField(label="Carrier SI / Booking Reference", value=carrier_ref_m.group(1)))

    # 7. Documents Required
    docs_m = re.search(r"Documents Required:\s*([\s\S]*?)(?=(?:Please|Best Regards|Thanks|\Z))", body, re.IGNORECASE)
    if docs_m and docs_m.group(1).strip():
        docs_lines = [line.strip() for line in docs_m.group(1).strip().splitlines() if line.strip()]
        custom.append(CustomField(label="Documents Required for B/L", value=", ".join(docs_lines)))

    return custom


# Heuristic regex extractor if Gemini is unavailable or rate-limited
def heuristic_extract_si(body: str, subject: str) -> SIExtractionRaw:
    def search_pattern(pattern: str, text: str) -> Optional[str]:
        m = re.search(pattern, text, re.IGNORECASE)
        return m.group(1).strip() if m else None

    shipper = search_pattern(r"Shipper(?:/Exporter)?:\s*([\s\S]*?)(?=(?:Consignee|Notify|POL|POD|Port of Loading|\Z))", body)
    consignee = search_pattern(r"Consignee(?:[^\n]*?):\s*([\s\S]*?)(?=(?:Notify|POL|POD|Description of Goods|Kinds of Packages|Gross|\Z))", body)
    notify = search_pattern(r"Notify(?: Party)?(?:[^\n]*?):\s*([\s\S]*?)(?=(?:POL|POD|Port of|Description of Goods|Kinds of Packages|Gross|\Z))", body)
    pol = search_pattern(r"(?:POL|Port of Loading):\s*([^\n\r]+)", body)
    pod = search_pattern(r"(?:POD|Port of Discharge|Discharge Port):\s*([^\n\r]+)", body)
    
    # Weight
    weight_match = re.search(r"(?:GROSS WT|Gross Weight|Weight)[^\d]*([\d,]+(?:\.\d+)?)\s*(?:KG|KGS)?", body, re.IGNORECASE)
    weight = float(weight_match.group(1).replace(",", "")) if weight_match else None
    
    # Container
    cntr_match = re.search(r"(\d+)\s*[xX]\s*([0-9]+'?(?:GP|HC|HQ|RF)?)", body)
    cntr_count = int(cntr_match.group(1)) if cntr_match else None
    cntr_type = f"{cntr_match.group(1)}X{cntr_match.group(2)}" if cntr_match else None
    
    # Cargo & HS Code
    hs_code = search_pattern(r"H\.?S\.?\s*CODE:?\s*([\d\.]+)", body)
    cargo_raw = search_pattern(r"(?:Description of Goods|Kinds of Packages):\s*([\s\S]*?)(?=(?:H\.?S\.?|GROSS|Shipping line|\Z))", body)
    if cargo_raw:
        cargo_cleaned = re.sub(r"^\s*\d+\s*[xX]\s*[0-9]+'?(?:GP|HC|HQ|RF)?\s*", "", cargo_raw).strip()
        cargo = cargo_cleaned if cargo_cleaned else cargo_raw
    else:
        cargo = None
    
    # Vessel & Voyage
    vessel = search_pattern(r"Vessel Name:\s*([^\n\r]+)", body)
    voyage = search_pattern(r"Voy(?:age)?\.?\s*No:?\s*([^\n\r]+)", body)
    
    # Booking Ref (often in subject)
    booking_ref = search_pattern(r"(\b5[A-Z0-9]{3}-\d{5}\b)", subject + " " + body)

    return SIExtractionRaw(
        booking_ref=booking_ref,
        shipper=shipper,
        consignee=consignee,
        notify_party=notify,
        port_of_loading=pol,
        port_of_discharge=pod,
        container_count=cntr_count,
        container_type=cntr_type,
        gross_weight_kg=weight,
        cargo_description=cargo,
        hs_code=hs_code,
        vessel_name=vessel,
        voyage_no=voyage,
        freight_term="PREPAID" if "PREPAID" in body.upper() else "CFR TERM" if "CFR" in body.upper() else None,
        special_instructions=None,
    )


# ---------------------------------------------------------------------------
# API ROUTES
# ---------------------------------------------------------------------------

@router.get("/health")
async def si_health():
    return {"status": "SI creation router is active"}


@router.post("/draft/{email_id}", response_model=SIDraftData)
async def generate_si_draft(email_id: str):
    """
    Extract shipment details from an SI_REQUEST email, detect missing info,
    and generate an editable draft SI with a follow-up inquiry email.
    """
    email = await fetch_email_data(email_id)
    subject = email.get("subject", "")
    body = email.get("body", "")
    from_addr = email.get("from", "")

    extracted_data = None

    # Try Gemini extraction first if available
    if gemini_client:
        prompt = f"""
You are an expert shipping operations documentation specialist.
Extract all Shipping Instruction (SI) details from this email into JSON matching the schema.
If a field is not mentioned or unknown, set it to null.

Subject: {subject}

Email Body:
{body}
"""
        try:
            interaction = gemini_client.interactions.create(
                model=GEMINI_MODEL,
                input=prompt,
                response_format={
                    "type": "text",
                    "mime_type": "application/json",
                    "schema": SIExtractionRaw.model_json_schema(),
                },
            )
            extracted_data = SIExtractionRaw.model_validate_json(interaction.output_text)
        except Exception as e:
            print(f"Gemini SI extraction fallback to heuristic: {e}")
            extracted_data = None

    # Fallback to heuristic parser if Gemini is unavailable or errored
    if not extracted_data:
        extracted_data = heuristic_extract_si(body, subject)

    # Detect missing fields
    missing_fields = detect_missing_fields(extracted_data)
    has_missing = len(missing_fields) > 0

    # Auto-extract unique / additional custom fields
    custom_fields = extract_custom_fields(body, subject)

    # Draft email: follow-up inquiry if missing, or confirmation if complete
    if has_missing:
        draft_email = generate_followup_email(
            sender=from_addr,
            subject=subject,
            booking_ref=extracted_data.booking_ref,
            missing_fields=missing_fields,
        )
    else:
        draft_email = generate_confirmation_email(
            sender=from_addr,
            subject=subject,
            booking_ref=extracted_data.booking_ref,
            data=extracted_data,
        )

    # Determine default template based on shipper
    default_template = "averis_default"
    if extracted_data.shipper and "APRIL" in extracted_data.shipper.upper():
        default_template = "april_fine_paper"

    return SIDraftData(
        email_id=email_id,
        template=default_template,
        booking_ref=extracted_data.booking_ref,
        shipper=extracted_data.shipper,
        consignee=extracted_data.consignee,
        notify_party=extracted_data.notify_party,
        port_of_loading=extracted_data.port_of_loading,
        port_of_discharge=extracted_data.port_of_discharge,
        container_count=extracted_data.container_count,
        container_type=extracted_data.container_type,
        gross_weight_kg=extracted_data.gross_weight_kg,
        cargo_description=extracted_data.cargo_description,
        hs_code=extracted_data.hs_code,
        vessel_name=extracted_data.vessel_name,
        voyage_no=extracted_data.voyage_no,
        freight_term=extracted_data.freight_term,
        special_instructions=extracted_data.special_instructions,
        sender_email=from_addr,
        email_subject=subject,
        raw_email_body=body,
        custom_fields=custom_fields,
        missing_fields=missing_fields,
        draft_email_response=draft_email,
        status="MISSING_INFO" if has_missing else "COMPLETE",
    )


# ---------------------------------------------------------------------------
# PDF GENERATION (PyMuPDF - Black & White Maritime Industry Standard)
# ---------------------------------------------------------------------------

def create_si_pdf(data: SIDraftData) -> bytes:
    """Generate an authentic, professional black-and-white maritime Shipping Instruction PDF."""
    import pymupdf
    from datetime import datetime

    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4: 595 x 842 pt
    
    # Crisp B&W Palette
    black = (0.0, 0.0, 0.0)
    dark_gray = (0.15, 0.15, 0.15)
    light_shading = (0.93, 0.93, 0.93)
    white = (1.0, 1.0, 1.0)
    
    # 1. Company & Document Header
    company_title = data.company_header
    subtitle = data.document_title or "MARITIME SHIPPING INSTRUCTION ADVICE"
    
    if not company_title:
        if data.template == "april_fine_paper":
            company_title = "APRIL FINE PAPER TRADING"
            subtitle = "OFFICIAL MARITIME SHIPPING INSTRUCTION"
        elif data.template == "asia_symbol":
            company_title = "ASIA SYMBOL PULP & PAPER"
            subtitle = "SHIPPING DOCUMENTATION & LOGISTICS SERVICES"
        else:
            company_title = "AVERIS GLOBAL LOGISTICS"
            subtitle = "SHIPPING DOCUMENTATION SERVICES"
            
    # Left: Company Title & Subtitle
    page.insert_text((35, 52), company_title, fontname="helv", fontsize=15, color=black)
    page.insert_text((35, 66), subtitle, fontname="helv", fontsize=8.5, color=dark_gray)
    page.insert_text((35, 77), "GLOBAL SHARED SERVICES - MARITIME OPERATIONS", fontname="helv", fontsize=7, color=(0.4, 0.4, 0.4))
    
    # Right: Standard Reference Table
    ref_box = pymupdf.Rect(355, 36, 560, 80)
    page.draw_rect(ref_box, color=black, width=1.0)
    page.draw_rect(pymupdf.Rect(355, 36, 560, 52), color=black, fill=light_shading, width=0.5)
    page.insert_text((362, 48), "SHIPPING INSTRUCTION (SI)", fontname="helv", fontsize=9, color=black)
    
    # Metadata rows
    ref_val = data.booking_ref or data.email_id.upper()
    page.insert_text((362, 63), f"BKG / SI REF: {ref_val}", fontname="helv", fontsize=8, color=black)
    page.insert_text((362, 74), f"DATE: {datetime.now().strftime('%d-%b-%Y')}  |  PAGE 1 OF 1", fontname="helv", fontsize=7.5, color=dark_gray)
    
    # Dividing rule below header
    page.draw_line((35, 87), (560, 87), color=black, width=1.2)
    
    # Grid Dimensions (Seamless Connected Table)
    x0 = 35.0
    x1 = 560.0
    x_mid = 297.5
    
    # --- ROW 1 (y: 92 to 192): Shipper & Booking References ---
    r1_y0, r1_y1 = 92.0, 192.0
    # Outer rect & header fill
    page.draw_rect(pymupdf.Rect(x0, r1_y0, x1, r1_y1), color=black, width=0.6)
    page.draw_rect(pymupdf.Rect(x0, r1_y0, x1, r1_y0 + 14), color=black, fill=light_shading, width=0.6)
    # Divider between headers and content
    page.draw_line((x_mid, r1_y0), (x_mid, r1_y1), color=black, width=0.6)
    
    page.insert_text((x0 + 4, r1_y0 + 10), "1. SHIPPER / EXPORTER (Complete Name & Registered Address)", fontname="helv", fontsize=7, color=black)
    page.insert_text((x_mid + 4, r1_y0 + 10), "2. BOOKING & CARRIER REFERENCES", fontname="helv", fontsize=7, color=black)
    
    page.insert_textbox(pymupdf.Rect(x0 + 4, r1_y0 + 17, x_mid - 4, r1_y1 - 3), data.shipper or "N/A", fontname="helv", fontsize=7.5, color=dark_gray)
    ref_details = (
        f"Carrier Booking Ref: {data.booking_ref or 'N/A'}\n"
        f"Email Dispatch Ref: {data.email_id}\n"
        f"Freight Payable At: {data.freight_term or 'ORIGIN / PREPAID'}\n"
        f"Export / Order Code: PO-{data.email_id.replace('email_', '2026-')}"
    )
    page.insert_textbox(pymupdf.Rect(x_mid + 4, r1_y0 + 17, x1 - 4, r1_y1 - 3), ref_details, fontname="helv", fontsize=7.5, color=dark_gray)
    
    # --- ROW 2 (y: 192 to 292): Consignee & Notify Party ---
    r2_y0, r2_y1 = 192.0, 292.0
    page.draw_rect(pymupdf.Rect(x0, r2_y0, x1, r2_y1), color=black, width=0.6)
    page.draw_rect(pymupdf.Rect(x0, r2_y0, x1, r2_y0 + 14), color=black, fill=light_shading, width=0.6)
    page.draw_line((x_mid, r2_y0), (x_mid, r2_y1), color=black, width=0.6)
    
    page.insert_text((x0 + 4, r2_y0 + 10), "3. CONSIGNEE (Not Negotiable unless to Order)", fontname="helv", fontsize=7, color=black)
    page.insert_text((x_mid + 4, r2_y0 + 10), "4. NOTIFY PARTY (Complete Name, Address & Contact Details)", fontname="helv", fontsize=7, color=black)
    
    page.insert_textbox(pymupdf.Rect(x0 + 4, r2_y0 + 17, x_mid - 4, r2_y1 - 3), data.consignee or "TO ORDER", fontname="helv", fontsize=7.5, color=dark_gray)
    page.insert_textbox(pymupdf.Rect(x_mid + 4, r2_y0 + 17, x1 - 4, r2_y1 - 3), data.notify_party or "SAME AS CONSIGNEE", fontname="helv", fontsize=7.5, color=dark_gray)
    
    # --- ROW 3 (y: 292 to 348): Routing (4 equal columns with vertical lines through headings) ---
    r3_y0, r3_y1 = 292.0, 348.0
    col_w = (x1 - x0) / 4  # 131.25 pt each
    xc1, xc2, xc3 = x0 + col_w, x0 + col_w * 2, x0 + col_w * 3
    
    page.draw_rect(pymupdf.Rect(x0, r3_y0, x1, r3_y1), color=black, width=0.6)
    page.draw_rect(pymupdf.Rect(x0, r3_y0, x1, r3_y0 + 14), color=black, fill=light_shading, width=0.6)
    # Continuous vertical lines dividing headings AND body
    page.draw_line((xc1, r3_y0), (xc1, r3_y1), color=black, width=0.6)
    page.draw_line((xc2, r3_y0), (xc2, r3_y1), color=black, width=0.6)
    page.draw_line((xc3, r3_y0), (xc3, r3_y1), color=black, width=0.6)
    
    page.insert_text((x0 + 4, r3_y0 + 10), "5. PORT OF LOADING (POL)", fontname="helv", fontsize=6.8, color=black)
    page.insert_text((xc1 + 4, r3_y0 + 10), "6. PORT OF DISCHARGE (POD)", fontname="helv", fontsize=6.8, color=black)
    page.insert_text((xc2 + 4, r3_y0 + 10), "7. OCEAN VESSEL & VOY.", fontname="helv", fontsize=6.8, color=black)
    page.insert_text((xc3 + 4, r3_y0 + 10), "8. FREIGHT TERMS", fontname="helv", fontsize=6.8, color=black)
    
    page.insert_textbox(pymupdf.Rect(x0 + 4, r3_y0 + 17, xc1 - 4, r3_y1 - 3), data.port_of_loading or "TBA", fontname="helv", fontsize=7.5, color=dark_gray)
    page.insert_textbox(pymupdf.Rect(xc1 + 4, r3_y0 + 17, xc2 - 4, r3_y1 - 3), data.port_of_discharge or "TBA", fontname="helv", fontsize=7.5, color=dark_gray)
    page.insert_textbox(pymupdf.Rect(xc2 + 4, r3_y0 + 17, xc3 - 4, r3_y1 - 3), f"{data.vessel_name or 'TBA'} / {data.voyage_no or 'TBA'}", fontname="helv", fontsize=7.5, color=dark_gray)
    page.insert_textbox(pymupdf.Rect(xc3 + 4, r3_y0 + 17, x1 - 4, r3_y1 - 3), data.freight_term or "CFR TERM", fontname="helv", fontsize=7.5, color=dark_gray)
    
    # --- ROW 4 (y: 348 to 515): Container & Cargo Table ---
    tbl_top, tbl_bottom = 348.0, 515.0
    div1, div2 = 166.25, 428.75
    
    page.draw_rect(pymupdf.Rect(x0, tbl_top, x1, tbl_bottom), color=black, width=0.6)
    page.draw_rect(pymupdf.Rect(x0, tbl_top, x1, tbl_top + 16), color=black, fill=light_shading, width=0.6)
    # Continuous vertical dividers running from top of header to bottom of table
    page.draw_line((div1, tbl_top), (div1, tbl_bottom), color=black, width=0.6)
    page.draw_line((div2, tbl_top), (div2, tbl_bottom), color=black, width=0.6)
    
    page.insert_text((x0 + 4, tbl_top + 11), "CONTAINER & SEAL NOS. / MARKS", fontname="helv", fontsize=7, color=black)
    page.insert_text((div1 + 4, tbl_top + 11), "NO. OF PKGS & COMMODITY DESCRIPTION (HS CODE)", fontname="helv", fontsize=7, color=black)
    page.insert_text((div2 + 4, tbl_top + 11), "GROSS WEIGHT (KG)", fontname="helv", fontsize=7, color=black)
    
    # Body 1: Containers
    cntr_text = f"{data.container_count or ''} x {data.container_type or '20GP'}\n\nSEAL: SHIPPER'S LOAD & COUNT\nSTATUS: FCL/FCL"
    page.insert_textbox(pymupdf.Rect(x0 + 4, tbl_top + 20, div1 - 4, tbl_bottom - 4), cntr_text, fontname="helv", fontsize=7.5, color=dark_gray)
    
    # Body 2: Cargo Description & HS Code
    desc_full = f"{data.cargo_description or 'GENERAL MERCHANDISE'}\n\nHS CODE: {data.hs_code or 'N/A'}"
    page.insert_textbox(pymupdf.Rect(div1 + 4, tbl_top + 20, div2 - 4, tbl_bottom - 4), desc_full, fontname="helv", fontsize=7.5, color=dark_gray)
    
    # Body 3: Gross Weight & CBM
    wt_text = (
        f"GROSS WEIGHT:\n{data.gross_weight_kg:,.1f} KGS\n\n"
        f"NET WEIGHT:\nAS PER PACKING LIST\n\n"
        f"MEASUREMENT:\nSTANDARD STOWAGE"
    ) if data.gross_weight_kg else "GROSS WT: N/A"
    page.insert_textbox(pymupdf.Rect(div2 + 4, tbl_top + 20, x1 - 4, tbl_bottom - 4), wt_text, fontname="helv", fontsize=7.5, color=dark_gray)
    
    # --- ROW 5 (y: 515 to 665): Special Instructions, Remarks & Custom Fields ---
    r5_y0, r5_y1 = 515.0, 665.0
    page.draw_rect(pymupdf.Rect(x0, r5_y0, x1, r5_y1), color=black, width=0.6)
    page.draw_rect(pymupdf.Rect(x0, r5_y0, x1, r5_y0 + 14), color=black, fill=light_shading, width=0.6)
    page.insert_text((x0 + 4, r5_y0 + 10), "9. SPECIAL INSTRUCTIONS, DOCUMENTARY REQUIREMENTS & REMARKS", fontname="helv", fontsize=7, color=black)
    
    spec_instr = data.special_instructions or (
        "DOCUMENTS REQUIRED FOR B/L ISSUANCE:\n"
        "1) 3 Original Commercial Invoices\n"
        "2) 3 Original Packing Lists\n"
        "3) 3 Original Bills of Lading + 3 Non-Negotiable copies\n"
        "SPECIAL CLAUSES: 14 days demurrage/detention free time combined at port of discharge."
    )
    if data.custom_fields:
        custom_parts = []
        for cf in data.custom_fields:
            if cf.label and cf.value:
                custom_parts.append(f"- {cf.label.upper()}: {cf.value}")
        if custom_parts:
            spec_instr += "\n\nADDITIONAL CUSTOM PARTICULARS:\n" + "\n".join(custom_parts)
            
    page.insert_textbox(pymupdf.Rect(x0 + 4, r5_y0 + 18, x1 - 4, r5_y1 - 4), spec_instr, fontname="helv", fontsize=7.2, color=dark_gray)
    
    # --- ROW 6 (y: 665 to 760): Shipper's Declaration & Stamp ---
    r6_y0, r6_y1 = 665.0, 760.0
    page.draw_rect(pymupdf.Rect(x0, r6_y0, x1, r6_y1), color=black, width=0.6)
    page.draw_rect(pymupdf.Rect(x0, r6_y0, x1, r6_y0 + 14), color=black, fill=light_shading, width=0.6)
    page.insert_text((x0 + 4, r6_y0 + 10), "10. SHIPPER'S DECLARATION & AUTHORIZATION", fontname="helv", fontsize=7, color=black)
    
    decl_text = (
        "We hereby certify that the particulars furnished above are true and correct. "
        "The ocean carrier is authorized and instructed to issue the original Bill of Lading in accordance with these instructions."
    )
    page.insert_textbox(pymupdf.Rect(x0 + 4, r6_y0 + 18, x1 - 4, r6_y0 + 40), decl_text, fontname="helv", fontsize=7.0, color=dark_gray)
    
    # Signature line on left
    page.draw_line((x0 + 4, r6_y1 - 22), (x0 + 200, r6_y1 - 22), color=black, width=0.5)
    page.insert_text((x0 + 4, r6_y1 - 10), "AUTHORIZED SIGNATURE & COMPANY STAMP", fontname="helv", fontsize=6.5, color=(0.4, 0.4, 0.4))
    
    # Transmission metadata on right (textbox to prevent spillover)
    meta_text = (
        f"TRANSMITTED BY: Averis Shipping Documentation Ops\n"
        f"TRANSMISSION DATE: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n"
        f"VERIFICATION STATUS: {data.status} (AUDIT REF: {data.email_id})"
    )
    page.insert_textbox(pymupdf.Rect(310, r6_y0 + 42, x1 - 4, r6_y1 - 6), meta_text, fontname="helv", fontsize=7.0, color=dark_gray)
    
    # Footer Rule & Text
    page.draw_line((x0, 775), (x1, 775), color=black, width=0.5)
    page.insert_text((x0, 787), "Averis Global Shared Services - Shipping Document Verification & Creation System", fontname="helv", fontsize=7, color=(0.5, 0.5, 0.5))
    page.insert_text((415, 787), "OFFICIAL MARITIME INSTRUCTION", fontname="helv", fontsize=7, color=(0.5, 0.5, 0.5))

    return doc.tobytes()


@router.post("/export-pdf")
async def export_si_pdf(data: SIDraftData):
    """Generate and download a finalized Shipping Instruction PDF."""
    from fastapi.responses import Response
    
    try:
        pdf_bytes = create_si_pdf(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {e}")
        
    filename = f"SI_{data.booking_ref or data.email_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        }
    )