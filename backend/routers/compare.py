from fastapi import APIRouter
from db import supabase           # still works — Python looks from where you run uvicorn (backend/), not from the file's own folder
from data_source import get_email, get_attachment_text

router = APIRouter()
