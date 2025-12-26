from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BriefingStatus(str, Enum):
    """브리핑 상태"""
    QUEUED = "QUEUED"
    READY = "READY"
    FAILED = "FAILED"


class BriefingItem(BaseModel):
    """브리핑 내 종목 정보"""
    symbol: str
    short_name: str
    headline_ko: str = Field(..., description="한글 헤드라인")
    key_points_ko: list[str] = Field(default_factory=list, description="핵심 포인트")
    source_tags: list[str] = Field(default_factory=list)
    regular_market_price: float
    regular_market_change_percent: float


class BriefingAssets(BaseModel):
    """브리핑 에셋 (이미지 등)"""
    image_data_url: Optional[str] = None
    image_width: int = 1080
    image_height: int = 1350


class BriefingMeta(BaseModel):
    """브리핑 메타데이터"""
    trading_date: str = Field(..., description="거래일 (America/New_York)")
    data_as_of: str = Field(..., description="데이터 기준 시각 (ISO)")
    timezone: str = "America/New_York"
    used_cache: bool = False
    sources: list[str] = Field(default_factory=list)
    disclaimer: str = "본 브리핑은 투자 자문이 아닙니다. 투자 결정은 본인 책임입니다."


class Briefing(BaseModel):
    """브리핑 전체 모델"""
    id: str
    date: str = Field(..., description="거래일 YYYY-MM-DD")
    title: str
    status: BriefingStatus
    top1_symbol: str
    criteria_label: str = Field(..., description="선정 기준 설명")
    summary_text: str
    report_text: str
    items: list[BriefingItem] = Field(default_factory=list)
    assets: BriefingAssets = Field(default_factory=BriefingAssets)
    created_at: str = Field(..., description="생성 시각 (ISO)")
    meta: BriefingMeta


class CreateBriefingRequest(BaseModel):
    """브리핑 생성 요청"""
    date: Optional[str] = Field(None, description="거래일 (YYYY-MM-DD), 미입력시 오늘")
    market: str = Field("US", description="시장")
    symbols: Optional[list[str]] = Field(None, description="종목 심볼 목록 (미입력시 자동 선정)")
    template: str = Field("daily_v1", description="템플릿")
    language: str = Field("ko", description="언어")


class CreateBriefingResponse(BaseModel):
    """브리핑 생성 응답"""
    briefing_id: str
    status: BriefingStatus
    date: str
