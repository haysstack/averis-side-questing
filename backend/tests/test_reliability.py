import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend folder is in python path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.reliability import (
    check_wrong_doc_type,
    check_missing_attachment,
    check_unreadable,
    check_missing_value,
    create_review_record,
    evaluate_and_flag_reliability,
)


def test_wrong_doc_type():
    invoice_text = "COMMERCIAL INVOICE\nInvoice No.: INV-12345\nSeller: ACME Corp"
    packing_text = "PACKING LIST\nCarton No. 001\nNet Wt 500kg"
    coo_text = "CERTIFICATE OF ORIGIN\nExporter: Global Freight\nHS Code: 12345"
    normal_si = "SHIPPING INSTRUCTION\nShipper: ACME Corp\nConsignee: Global Traders"

    assert check_wrong_doc_type(invoice_text) is True
    assert check_wrong_doc_type(packing_text) is True
    assert check_wrong_doc_type(coo_text) is True
    assert check_wrong_doc_type(normal_si) is False
    assert check_wrong_doc_type("", filename="commercial_invoice.pdf") is True


def test_missing_attachment():
    email_zero = {"email_id": "email_001", "category": "BL_COMPARISON", "attachments": []}
    email_one = {"email_id": "email_002", "category": "BL_COMPARISON", "attachments": ["attachments/email_002_SI.txt"]}
    email_two = {
        "email_id": "email_003",
        "category": "BL_COMPARISON",
        "attachments": ["attachments/email_003_SI.txt", "attachments/email_003_BL.txt"]
    }

    assert check_missing_attachment(email_zero) is True
    assert check_missing_attachment(email_one) is True
    assert check_missing_attachment(email_two) is False


def test_unreadable():
    # 0-byte file
    assert check_unreadable(b"", filename="doc.txt") is True

    # Corrupted PDF (missing PDF header)
    assert check_unreadable(b"SOME RANDOM BYTES NOT PDF", filename="doc.pdf") is True

    # Truncated PDF (missing %%EOF)
    assert check_unreadable(b"%PDF-1.5\nRandom Bytes Without EOF", filename="doc.pdf") is True

    # Scanned PDF without text layer
    scanned_text = "SCANNED COPY - NO OCR TEXT LAYER"
    valid_pdf_bytes = b"%PDF-1.5\n...data...\n%%EOF"
    assert check_unreadable(valid_pdf_bytes, file_text=scanned_text, filename="doc.pdf") is True

    # Valid TXT document
    assert check_unreadable(b"Shipper: ACME\nConsignee: XYZ", file_text="Shipper: ACME\nConsignee: XYZ", filename="doc.txt") is False


def test_missing_value():
    valid_extractions = {
        "shipper": "ACME Logistics",
        "consignee": "Global Import Co",
        "notify_party": "Global Import Co",
        "port_of_loading": "Port Klang",
        "port_of_discharge": "Hamburg",
        "container_count": 2,
        "gross_weight_kg": 15000.0,
    }

    invalid_extractions = {
        "shipper": "ACME Logistics",
        "consignee": "???",  # Placeholder token
        "notify_party": "_______",  # Placeholder token
        "port_of_loading": "Port Klang",
        "port_of_discharge": "TBA",
        "container_count": 2,
        "gross_weight_kg": None,
    }

    is_missing_valid, fields_valid = check_missing_value(valid_extractions)
    assert is_missing_valid is False
    assert len(fields_valid) == 0

    is_missing_invalid, fields_invalid = check_missing_value(invalid_extractions)
    assert is_missing_invalid is True
    assert "consignee" in fields_invalid
    assert "notify_party" in fields_invalid
    assert "port_of_discharge" in fields_invalid
    assert "gross_weight_kg" in fields_invalid


@patch("services.reliability.supabase")
def test_create_review_record(mock_supabase):
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    mock_table.insert.return_value.execute.return_value = MagicMock(data=[{"id": 1, "email_id": "email_001"}])

    res = create_review_record("email_001", "missing_attachment", confidence=0.95)

    mock_supabase.table.assert_any_call("emails")
    mock_supabase.table.assert_any_call("reviews")
    assert res == [{"id": 1, "email_id": "email_001"}]


if __name__ == "__main__":
    test_wrong_doc_type()
    test_missing_attachment()
    test_unreadable()
    test_missing_value()
    print("All reliability tests passed!")
