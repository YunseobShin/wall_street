from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from models.trending import ScreenerType, TrendingStock
from services.trending_service import TrendingStockService, TrendingStockServiceError

router = APIRouter(prefix="/trending-stocks", tags=["trending"])


def create_response(data: dict, success: bool = True):
    """공통 Response Envelope 생성"""
    return {
        "success": success,
        "data": data,
        "meta": {
            "requestId": f"req_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "generatedAt": datetime.now(ZoneInfo("UTC")).isoformat(),
        },
    }


def create_error_response(code: str, message: str, details: Optional[dict] = None):
    """에러 Response 생성"""
    error = {"code": code, "message": message}
    if details:
        error["details"] = details
    return {
        "success": False,
        "error": error,
        "meta": {
            "requestId": f"req_{datetime.now().strftime('%Y%m%d%H%M%S')}",
        },
    }


@router.get("")
async def get_trending_stocks(
    date: Optional[str] = Query(None, description="조회 날짜 (YYYY-MM-DD)"),
    market: str = Query("US", description="시장 (기본: US)"),
    limit: int = Query(10, ge=1, le=50, description="조회 수 (1-50)"),
    include: str = Query(
        "most_actives,day_gainers,day_losers",
        description="포함할 스크리너 (콤마 구분)",
    ),
):
    """
    화제 종목 조회 API

    Yahoo Finance Screener에서 화제 종목을 조회합니다.
    """
    service = TrendingStockService()

    # include 파라미터 파싱
    screener_types = []
    for s in include.split(","):
        s = s.strip()
        try:
            screener_types.append(ScreenerType(s))
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=create_error_response(
                    "VALIDATION_ERROR",
                    f"Invalid screener type: {s}",
                    {"field": "include", "valid_values": [e.value for e in ScreenerType]},
                ),
            )

    # 각 스크리너에서 종목 조회
    all_stocks: dict[str, dict] = {}  # symbol -> stock data

    try:
        for screener_type in screener_types:
            stocks = service.get_trending_stocks(screener_type, count=limit)

            for rank, stock in enumerate(stocks, 1):
                symbol = stock.symbol

                if symbol not in all_stocks:
                    all_stocks[symbol] = {
                        "symbol": stock.symbol,
                        "shortName": stock.short_name,
                        "quoteType": "EQUITY",
                        "regularMarketPrice": stock.regular_market_price,
                        "regularMarketChange": stock.regular_market_change,
                        "regularMarketChangePercent": stock.regular_market_change_percent,
                        "regularMarketVolume": stock.regular_market_volume,
                        "marketCap": stock.market_cap,
                        "sourceTags": [],
                        "rank": {},
                        "score": 0,
                    }

                all_stocks[symbol]["sourceTags"].append(screener_type.value)
                all_stocks[symbol]["rank"][screener_type.value] = rank

        # 점수 계산 (여러 스크리너에 나타날수록 높은 점수)
        for symbol, data in all_stocks.items():
            source_count = len(data["sourceTags"])
            avg_rank = sum(data["rank"].values()) / len(data["rank"])
            # 점수: 출처 개수 가중치 + 순위 역가중치
            data["score"] = round(source_count * 0.3 + (1 - avg_rank / limit) * 0.7, 2)

        # 점수순 정렬
        items = sorted(all_stocks.values(), key=lambda x: x["score"], reverse=True)

        # top1 선정
        top1 = None
        if items:
            top1_item = items[0]
            top1 = {
                "symbol": top1_item["symbol"],
                "score": top1_item["score"],
                "selectedReason": f"Appears in {len(top1_item['sourceTags'])} screener(s): {', '.join(top1_item['sourceTags'])}",
            }

        # 응답 생성
        now_ny = datetime.now(ZoneInfo("America/New_York"))
        response_date = date if date else now_ny.strftime("%Y-%m-%d")

        return create_response({
            "date": response_date,
            "timezone": "America/New_York",
            "criteria": {
                "sources": [s.value for s in screener_types],
                "limitPerSource": limit,
                "dedupeBy": "symbol",
            },
            "items": items,
            "top1": top1,
        })

    except TrendingStockServiceError as e:
        raise HTTPException(
            status_code=502,
            detail=create_error_response("UPSTREAM_ERROR", str(e)),
        )
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=create_error_response("SERVICE_UNAVAILABLE", str(e)),
        )
