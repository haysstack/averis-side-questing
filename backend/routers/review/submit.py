from fastapi import APIRouter

router = APIRouter()

@router.post("/submit-check")
def submit_check():
    """Build final submission payload and POST to http://localhost:8080/submit."""
    return {"status": "ok", "scoring": {}}
