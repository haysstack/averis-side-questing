from fastapi import APIRouter
from .review_queue import router as queue_router
from .review_resolve import router as resolve_router
from .submit import router as submit_router

router = APIRouter()
router.include_router(queue_router)
router.include_router(resolve_router)
router.include_router(submit_router)
