from fastapi import APIRouter

from api.trending import router as trending_router
from api.briefings import router as briefings_router
from api.subscriptions import router as subscriptions_router

router = APIRouter()

# 라우터 등록
router.include_router(trending_router)
router.include_router(briefings_router)
router.include_router(subscriptions_router)


@router.get("/")
async def api_root():
    return {"message": "WYWS API v1"}
