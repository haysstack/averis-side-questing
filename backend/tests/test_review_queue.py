import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure backend folder is in python path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient


@patch("routers.review.review_queue.supabase")
def test_get_review_queue_empty(mock_supabase):
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    import main
    client = TestClient(main.app)
    response = client.get("/review-queue")

    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "ok"
    assert res["items"] == []


@patch("routers.review.review_queue.supabase")
def test_get_review_queue_with_items(mock_supabase):
    reviews_mock_data = [
        {
            "id": 1,
            "email_id": "email_004",
            "reason": "unreadable",
            "confidence": 0.95,
            "resolved": False,
        }
    ]
    emails_mock_data = [
        {
            "email_id": "email_004",
            "subject": "SI Document Review",
            "category": "BL_COMPARISON",
            "status": "NEEDS_REVIEW",
            "review_reason": "unreadable",
        }
    ]

    def mock_table(name):
        t = MagicMock()
        if name == "reviews":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=reviews_mock_data)
        elif name == "emails":
            t.select.return_value.eq.return_value.execute.return_value = MagicMock(data=emails_mock_data)
        return t

    mock_supabase.table.side_effect = mock_table

    import main
    client = TestClient(main.app)
    response = client.get("/review-queue")

    assert response.status_code == 200
    res = response.json()
    assert res["status"] == "ok"
    assert len(res["items"]) == 1

    item = res["items"][0]
    assert item["email_id"] == "email_004"
    assert item["review_reason"] == "unreadable"
    assert item["confidence"] == 0.95
    assert item["status"] == "NEEDS_REVIEW"
    assert item["subject"] == "SI Document Review"
    assert item["category"] == "BL_COMPARISON"
    assert item["resolved"] is False


if __name__ == "__main__":
    import os
    os.environ["GEMINI_API_KEY"] = "dummy"
    os.environ["SUPABASE_URL"] = "https://dummy.supabase.co"
    os.environ["SUPABASE_SERVICE_KEY"] = "dummy"
    test_get_review_queue_empty()
    test_get_review_queue_with_items()
    print("All review queue tests passed successfully!")
