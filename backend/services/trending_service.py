from yahooquery import Screener, Ticker
from typing import Optional

from models.trending import (
    ScreenerType,
    TrendingStock,
    StockDetail,
    Top1Result,
)


class TrendingStockServiceError(Exception):
    """화제 종목 서비스 에러"""
    pass


class TrendingStockService:
    """화제 종목 수집 서비스"""

    SCREENER_DESCRIPTIONS = {
        ScreenerType.MOST_ACTIVES: "거래량 기준 가장 활발한 종목",
        ScreenerType.DAY_GAINERS: "당일 상승률 상위 종목",
        ScreenerType.DAY_LOSERS: "당일 하락률 상위 종목",
    }

    def __init__(self):
        self._screener = Screener()

    def get_trending_stocks(
        self,
        screener_type: ScreenerType,
        count: int = 10,
    ) -> list[TrendingStock]:
        """
        스크리너에서 화제 종목 목록 조회

        Args:
            screener_type: 스크리너 타입 (most_actives, day_gainers, day_losers)
            count: 조회할 종목 수 (기본값: 10)

        Returns:
            TrendingStock 목록

        Raises:
            TrendingStockServiceError: 조회 실패 시
        """
        try:
            result = self._screener.get_screeners([screener_type.value], count)

            if screener_type.value not in result:
                raise TrendingStockServiceError(
                    f"스크리너 '{screener_type.value}' 결과를 찾을 수 없습니다."
                )

            screener_data = result[screener_type.value]
            quotes = screener_data.get("quotes", [])

            if not quotes:
                raise TrendingStockServiceError(
                    f"스크리너 '{screener_type.value}'에서 종목을 찾을 수 없습니다."
                )

            stocks = []
            for quote in quotes:
                stock = TrendingStock(
                    symbol=quote.get("symbol", ""),
                    short_name=quote.get("shortName", quote.get("symbol", "")),
                    regular_market_price=quote.get("regularMarketPrice", 0),
                    regular_market_change=quote.get("regularMarketChange", 0),
                    regular_market_change_percent=quote.get(
                        "regularMarketChangePercent", 0
                    ),
                    regular_market_volume=quote.get("regularMarketVolume", 0),
                    market_cap=quote.get("marketCap"),
                    source=screener_type,
                )
                stocks.append(stock)

            return stocks

        except TrendingStockServiceError:
            raise
        except Exception as e:
            raise TrendingStockServiceError(
                f"화제 종목 조회 중 오류 발생: {str(e)}"
            ) from e

    def get_stock_detail(
        self,
        symbol: str,
        source: ScreenerType,
    ) -> StockDetail:
        """
        종목 상세 정보 조회 (yahooquery Ticker 사용)

        Args:
            symbol: 종목 심볼
            source: 데이터 출처 스크리너

        Returns:
            StockDetail 객체

        Raises:
            TrendingStockServiceError: 조회 실패 시
        """
        try:
            ticker = Ticker(symbol)

            # summary_detail과 price 정보 조회
            summary = ticker.summary_detail.get(symbol, {})
            price = ticker.price.get(symbol, {})
            profile = ticker.asset_profile.get(symbol, {})

            # 에러 체크 (yahooquery는 에러 시 문자열 반환)
            if isinstance(summary, str):
                raise TrendingStockServiceError(f"종목 정보 조회 실패: {summary}")
            if isinstance(price, str):
                raise TrendingStockServiceError(f"가격 정보 조회 실패: {price}")

            return StockDetail(
                symbol=symbol,
                short_name=price.get("shortName", symbol),
                long_name=price.get("longName"),
                sector=profile.get("sector") if isinstance(profile, dict) else None,
                industry=profile.get("industry") if isinstance(profile, dict) else None,
                website=profile.get("website") if isinstance(profile, dict) else None,
                regular_market_price=price.get("regularMarketPrice", 0),
                regular_market_change=price.get("regularMarketChange", 0),
                regular_market_change_percent=price.get(
                    "regularMarketChangePercent", 0
                ) * 100,  # 소수점을 퍼센트로 변환
                regular_market_volume=price.get("regularMarketVolume", 0),
                market_cap=price.get("marketCap"),
                fifty_two_week_high=summary.get("fiftyTwoWeekHigh"),
                fifty_two_week_low=summary.get("fiftyTwoWeekLow"),
                fifty_day_average=summary.get("fiftyDayAverage"),
                two_hundred_day_average=summary.get("twoHundredDayAverage"),
                trailing_pe=summary.get("trailingPE"),
                forward_pe=summary.get("forwardPE"),
                dividend_yield=summary.get("dividendYield"),
                source=source,
            )

        except TrendingStockServiceError:
            raise
        except Exception as e:
            raise TrendingStockServiceError(
                f"종목 상세 정보 조회 중 오류 발생: {str(e)}"
            ) from e

    def get_top1(self, screener_type: ScreenerType) -> Top1Result:
        """
        TOP 1 종목 선정 및 상세 정보 조회

        Args:
            screener_type: 스크리너 타입

        Returns:
            Top1Result 객체

        Raises:
            TrendingStockServiceError: 조회 실패 시
        """
        # 스크리너에서 종목 목록 조회
        stocks = self.get_trending_stocks(screener_type, count=10)
        total_count = len(stocks)

        if not stocks:
            raise TrendingStockServiceError("TOP 1 종목을 선정할 수 없습니다.")

        # TOP 1 종목 선택 (첫 번째 종목)
        top1_stock = stocks[0]

        # 상세 정보 조회
        detail = self.get_stock_detail(top1_stock.symbol, screener_type)

        # 선정 이유 생성
        reason = self._generate_selection_reason(screener_type, detail)

        return Top1Result(
            stock=detail,
            screener_type=screener_type,
            total_count=total_count,
            selection_reason=reason,
        )

    def _generate_selection_reason(
        self,
        screener_type: ScreenerType,
        detail: StockDetail,
    ) -> str:
        """선정 이유 생성"""
        base_reason = self.SCREENER_DESCRIPTIONS.get(
            screener_type, "화제 종목"
        )

        if screener_type == ScreenerType.MOST_ACTIVES:
            volume_formatted = f"{detail.regular_market_volume:,}"
            return f"{base_reason} 1위 (거래량: {volume_formatted}주)"

        elif screener_type == ScreenerType.DAY_GAINERS:
            return f"{base_reason} 1위 (상승률: {detail.regular_market_change_percent:+.2f}%)"

        elif screener_type == ScreenerType.DAY_LOSERS:
            return f"{base_reason} 1위 (하락률: {detail.regular_market_change_percent:.2f}%)"

        return f"{base_reason} 1위"
