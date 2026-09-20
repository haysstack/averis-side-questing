import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend folder is in python path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from routers.review.submit import build_submission_payload


def test_1_bl_comparison_with_comparison_no_defect():
    """1. BL_COMPARISON + comparison row + no defect -> OK"""
    mock_raw = [{"email_id": "email_001"}]
    mock_emails = [{"email_id": "email_001", "category": "BL_COMPARISON", "status": "CLASSIFIED"}]
    mock_comparisons = [{"email_id": "email_001", "has_defect": False, "defect_fields": []}]

    with patch("routers.review.submit.get_all_emails", return_value=mock_raw):
        with patch("routers.review.submit.supabase") as mock_supabase:
            def mock_table(name):
                t = MagicMock()
                if name == "emails":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_emails)
                elif name == "comparisons":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_comparisons)
                else:
                    t.select.return_value.execute.return_value = MagicMock(data=[])
                return t

            mock_supabase.table.side_effect = mock_table
            payload, errors = build_submission_payload()

            assert errors == []
            assert payload["email_001"]["category"] == "BL_COMPARISON"
            assert payload["email_001"]["status"] == "OK"
            assert payload["email_001"]["has_defect"] is False
            assert payload["email_001"]["defect_fields"] == []


def test_2_bl_comparison_with_comparison_with_defect():
    """2. BL_COMPARISON + comparison row + defect -> MISMATCH"""
    mock_raw = [{"email_id": "email_002"}]
    mock_emails = [{"email_id": "email_002", "category": "BL_COMPARISON", "status": "CLASSIFIED"}]
    mock_comparisons = [{"email_id": "email_002", "has_defect": True, "defect_fields": ["gross_weight_kg"]}]

    with patch("routers.review.submit.get_all_emails", return_value=mock_raw):
        with patch("routers.review.submit.supabase") as mock_supabase:
            def mock_table(name):
                t = MagicMock()
                if name == "emails":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_emails)
                elif name == "comparisons":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_comparisons)
                else:
                    t.select.return_value.execute.return_value = MagicMock(data=[])
                return t

            mock_supabase.table.side_effect = mock_table
            payload, errors = build_submission_payload()

            assert errors == []
            assert payload["email_002"]["category"] == "BL_COMPARISON"
            assert payload["email_002"]["status"] == "MISMATCH"
            assert payload["email_002"]["has_defect"] is True
            assert payload["email_002"]["defect_fields"] == ["gross_weight_kg"]


def test_3_bl_comparison_unresolved_review():
    """3. BL_COMPARISON + unresolved review -> NEEDS_REVIEW"""
    mock_raw = [{"email_id": "email_003"}]
    mock_emails = [{"email_id": "email_003", "category": "BL_COMPARISON", "status": "NEEDS_REVIEW", "review_reason": "unreadable"}]
    mock_reviews = [{"email_id": "email_003", "reason": "unreadable", "resolved": False}]

    with patch("routers.review.submit.get_all_emails", return_value=mock_raw):
        with patch("routers.review.submit.supabase") as mock_supabase:
            def mock_table(name):
                t = MagicMock()
                if name == "emails":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_emails)
                elif name == "reviews":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_reviews)
                else:
                    t.select.return_value.execute.return_value = MagicMock(data=[])
                return t

            mock_supabase.table.side_effect = mock_table
            payload, errors = build_submission_payload()

            assert errors == []
            assert payload["email_003"]["category"] == "BL_COMPARISON"
            assert payload["email_003"]["status"] == "NEEDS_REVIEW"
            assert payload["email_003"]["review_reason"] == "unreadable"
            assert payload["email_003"]["has_defect"] is False


def test_4_bl_comparison_no_comparison_no_review_validation_error():
    """4. BL_COMPARISON + NO comparison + NO review -> validation error"""
    mock_raw = [{"email_id": "email_004"}]
    mock_emails = [{"email_id": "email_004", "category": "BL_COMPARISON", "status": "CLASSIFIED"}]

    with patch("routers.review.submit.get_all_emails", return_value=mock_raw):
        with patch("routers.review.submit.supabase") as mock_supabase:
            def mock_table(name):
                t = MagicMock()
                if name == "emails":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_emails)
                else:
                    t.select.return_value.execute.return_value = MagicMock(data=[])
                return t

            mock_supabase.table.side_effect = mock_table
            payload, errors = build_submission_payload()

            assert len(errors) > 0
            assert any("Person B/C incomplete" in e for e in errors)


def test_5_resolved_review_uses_resolved_result():
    """5. Resolved review -> uses resolved OK/MISMATCH result"""
    mock_raw = [{"email_id": "email_005"}]
    mock_emails = [{"email_id": "email_005", "category": "BL_COMPARISON", "status": "MISMATCH"}]
    mock_comparisons = [{"email_id": "email_005", "has_defect": True, "defect_fields": ["consignee"]}]
    mock_reviews = [{"email_id": "email_005", "reason": "missing_value", "resolved": True}]

    with patch("routers.review.submit.get_all_emails", return_value=mock_raw):
        with patch("routers.review.submit.supabase") as mock_supabase:
            def mock_table(name):
                t = MagicMock()
                if name == "emails":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_emails)
                elif name == "comparisons":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_comparisons)
                elif name == "reviews":
                    t.select.return_value.execute.return_value = MagicMock(data=mock_reviews)
                return t

            mock_supabase.table.side_effect = mock_table
            payload, errors = build_submission_payload()

            assert errors == []
            assert payload["email_005"]["category"] == "BL_COMPARISON"
            assert payload["email_005"]["status"] == "MISMATCH"
            assert payload["email_005"]["review_reason"] is None
            assert payload["email_005"]["has_defect"] is True
            assert payload["email_005"]["defect_fields"] == ["consignee"]


def test_6_all_520_email_ids_required():
    """6. All 520 email IDs are required in payload"""
    mock_raw_emails = [{"email_id": f"email_{i:03d}"} for i in range(1, 521)]

    with patch("routers.review.submit.get_all_emails", return_value=mock_raw_emails):
        with patch("routers.review.submit.supabase") as mock_supabase:
            mock_table = MagicMock()
            mock_supabase.table.return_value = mock_table
            mock_table.select.return_value.execute.return_value = MagicMock(data=[])

            payload, errors = build_submission_payload()

            assert len(payload) == 520
            assert "email_001" in payload
            assert "email_520" in payload


if __name__ == "__main__":
    import os
    os.environ["GEMINI_API_KEY"] = "dummy"
    os.environ["SUPABASE_URL"] = "https://dummy.supabase.co"
    os.environ["SUPABASE_SERVICE_KEY"] = "dummy"

    test_1_bl_comparison_with_comparison_no_defect()
    test_2_bl_comparison_with_comparison_with_defect()
    test_3_bl_comparison_unresolved_review()
    test_4_bl_comparison_no_comparison_no_review_validation_error()
    test_5_resolved_review_uses_resolved_result()
    test_6_all_520_email_ids_required()

    print("All 6 safety tests for submit-check passed successfully!")
