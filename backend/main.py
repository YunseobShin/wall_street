from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import router as api_router

app = FastAPI(
    title="당신이 잠든 사이 API",
    description="WYWS - Daily US Stock Briefing Service",
    version="0.1.0",
)

# CORS 설정 - 프론트엔드 localhost:3000 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
