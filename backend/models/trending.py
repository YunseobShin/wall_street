from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional


class ScreenerType(str, Enum):
    """스크리너 타입"""
    MOST_ACTIVES = "most_actives"
    DAY_GAINERS = "day_gainers"
    DAY_LOSERS = "day_losers"


class TrendingStock(BaseModel):
    """화제 종목 기본 정보"""
    symbol: str = Field(..., description="종목 심볼 (예: AAPL)")
    short_name: str = Field(..., description="종목 약칭")
    regular_market_price: float = Field(..., description="현재가")
    regular_market_change: float = Field(..., description="가격 변동")
    regular_market_change_percent: float = Field(..., description="가격 변동률 (%)")
    regular_market_volume: int = Field(..., description="거래량")
    market_cap: Optional[int] = Field(None, description="시가총액")
    source: ScreenerType = Field(..., description="데이터 출처 스크리너")


class StockDetail(BaseModel):
    """종목 상세 정보 (Ticker에서 조회)"""
    symbol: str
    short_name: str
    long_name: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    regular_market_price: float
    regular_market_change: float
    regular_market_change_percent: float
    regular_market_volume: int
    market_cap: Optional[int] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    fifty_day_average: Optional[float] = None
    two_hundred_day_average: Optional[float] = None
    trailing_pe: Optional[float] = None
    forward_pe: Optional[float] = None
    dividend_yield: Optional[float] = None
    source: ScreenerType


class Top1Result(BaseModel):
    """TOP 1 종목 선정 결과"""
    stock: StockDetail = Field(..., description="선정된 TOP 1 종목")
    screener_type: ScreenerType = Field(..., description="사용된 스크리너 타입")
    total_count: int = Field(..., description="스크리너에서 조회된 총 종목 수")
    selection_reason: str = Field(..., description="선정 이유")
