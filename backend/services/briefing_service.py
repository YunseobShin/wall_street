import os
from datetime import datetime
from zoneinfo import ZoneInfo
from typing import Optional
import base64

from dotenv import load_dotenv
import google.generativeai as genai

from models.briefing import (
    Briefing,
    BriefingStatus,
    BriefingItem,
    BriefingAssets,
    BriefingMeta,
    CreateBriefingRequest,
)
from models.trending import ScreenerType
from services.trending_service import TrendingStockService, TrendingStockServiceError

# .env 파일 로드
load_dotenv()


class BriefingServiceError(Exception):
    """브리핑 서비스 에러"""
    pass


# 간단한 인메모리 저장소 (MVP용, 추후 DB로 교체)
_briefings_store: dict[str, Briefing] = {}


class BriefingService:
    """브리핑 생성 및 관리 서비스 (Gemini AI 연동)"""

    def __init__(self):
        self._trending_service = TrendingStockService()
        self._setup_gemini()

    def _setup_gemini(self):
        """Gemini API 설정"""
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            raise BriefingServiceError("GOOGLE_API_KEY 환경변수가 설정되지 않았습니다.")

        genai.configure(api_key=api_key)
        self._model = genai.GenerativeModel("gemini-2.0-flash")

    def create_briefing(self, request: CreateBriefingRequest) -> Briefing:
        """
        브리핑 생성 (Gemini AI 활용)

        Args:
            request: 브리핑 생성 요청

        Returns:
            생성된 Briefing 객체
        """
        now_utc = datetime.now(ZoneInfo("UTC"))
        now_ny = datetime.now(ZoneInfo("America/New_York"))

        # 날짜 결정
        trading_date = request.date if request.date else now_ny.strftime("%Y-%m-%d")

        # 브리핑 ID 생성
        briefing_id = f"brf_{int(datetime.now().timestamp() * 1000)}"

        try:
            # 화제 종목 조회
            stocks_data = self._fetch_trending_stocks(request.symbols)

            if not stocks_data:
                raise BriefingServiceError("화제 종목을 조회할 수 없습니다.")

            # TOP 1 종목
            top1 = stocks_data[0]

            # 브리핑 아이템 생성
            items = self._create_briefing_items(stocks_data[:5])

            # Gemini AI로 브리핑 텍스트 생성
            ai_content = self._generate_ai_briefing(top1, stocks_data[:5], trading_date)

            # 브리핑 객체 생성
            briefing = Briefing(
                id=briefing_id,
                date=trading_date,
                title=f"당신이 잠든 사이 — {self._format_date_korean(trading_date)} 미국주식 브리핑",
                status=BriefingStatus.READY,
                top1_symbol=top1["symbol"],
                criteria_label=ai_content["criteria_label"],
                summary_text=ai_content["summary"],
                report_text=ai_content["report"],
                items=items,
                assets=BriefingAssets(
                    image_data_url=self._generate_image_data_url(top1, trading_date, ai_content["headline"]),
                ),
                created_at=now_utc.isoformat(),
                meta=BriefingMeta(
                    trading_date=trading_date,
                    data_as_of=now_utc.isoformat(),
                    timezone="America/New_York",
                    used_cache=False,
                    sources=["most_actives", "day_gainers", "day_losers"],
                ),
            )

            # 저장
            _briefings_store[briefing_id] = briefing

            return briefing

        except TrendingStockServiceError as e:
            raise BriefingServiceError(f"화제 종목 조회 실패: {str(e)}") from e
        except Exception as e:
            raise BriefingServiceError(f"브리핑 생성 중 오류: {str(e)}") from e

    def _generate_ai_briefing(
        self,
        top1: dict,
        stocks: list[dict],
        trading_date: str,
    ) -> dict:
        """Gemini AI로 브리핑 콘텐츠 생성"""

        # 종목 정보 텍스트 구성
        stocks_info = "\n".join([
            f"- {s['symbol']} ({s['short_name']}): ${s['regular_market_price']:.2f}, "
            f"변동률 {s['regular_market_change_percent']:+.2f}%, "
            f"스크리너: {', '.join(s['source_tags'])}"
            for s in stocks
        ])

        # 상승/하락 방향
        direction = "상승" if top1['regular_market_change_percent'] >= 0 else "하락"
        direction_emoji = "📈" if top1['regular_market_change_percent'] >= 0 else "📉"

        prompt = f"""당신은 "당신이 잠든 사이" 미국 주식 브리핑 서비스의 AI 애널리스트입니다.

한국의 투자자들이 아침에 일어나서 "어젯밤 미국 시장에서 무슨 일이 있었지?"라고 궁금해할 때,
마치 친한 증권사 친구가 커피 한 잔 하면서 설명해주듯이 브리핑을 작성해주세요.

## 오늘의 데이터 ({trading_date}, 뉴욕 기준)

### {direction_emoji} TOP 1 화제 종목
- 종목: {top1['symbol']} ({top1['short_name']})
- 현재가: ${top1['regular_market_price']:.2f}
- 변동: {top1['regular_market_change_percent']:+.2f}% {direction}
- 거래량 순위: {', '.join(top1['source_tags'])} 상위권

### 기타 주목 종목
{stocks_info}

## 당신의 임무

1. **왜 이 종목이 {direction}했는지** 설명해주세요
   - 이 회사가 뭘 하는 회사인지 (사업 영역)
   - 최근 이 종목/산업에 영향을 줄 만한 이슈 (실적 발표, 신제품, 규제, 경쟁사 뉴스, 매크로 이슈 등)
   - 당신이 알고 있는 이 회사에 대한 맥락 정보

2. **한국 투자자에게 의미 있는 인사이트** 제공
   - 한국에서 관련된 산업/기업이 있다면 언급
   - 시차 때문에 놓칠 수 있는 중요 포인트

## 출력 형식

코드블록 없이 순수 JSON만 출력. 필드별로 상세히 작성:

{{
  "headline": "15자 이내 한줄 (예: 'ASTS, 위성통신 차익실현')",
  "criteria_label": "선정이유 (예: '거래량+하락률 상위')",
  "summary": "2-3문장. 어젯밤 [회사명]이 [이유]로 X% 변동. [추가 맥락].",
  "company_description": "{top1['short_name']}이 뭐하는 회사인지 2-3문장으로 설명",
  "why_moved": "왜 {direction}했는지 분석. 가능한 이유 2-3가지 bullet point로",
  "related_stocks": "같이 봐야 할 종목 2-3개. 종목명, 변동률, 한줄 이유",
  "korean_investor_note": "한국 투자자가 알아야 할 것 (관련 국내주, 시차, 환율 등)"
}}

## 작성 스타일
- 친근하지만 전문적인 톤 ("~했습니다", "~네요" 혼용 가능)
- 구체적인 숫자와 팩트 기반
- "~한 것으로 보입니다", "~가능성이 있습니다" 등 불확실성 표현 적절히 사용
- 투자 권유가 아닌 정보 제공 목적임을 명심
- 모르는 건 모른다고, 추측은 추측이라고 명시
"""

        try:
            response = self._model.generate_content(prompt)
            text = response.text.strip()

            # JSON 파싱
            import json

            # 마크다운 코드블록 제거
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            if text.endswith("```"):
                text = text[:-3]

            result = json.loads(text.strip())

            # 새 필드들을 조합해서 구조화된 리포트 생성
            report_parts = []

            if result.get("company_description"):
                report_parts.append(f"## 이 회사 뭐하는 곳?\n\n{result['company_description']}")

            if result.get("why_moved"):
                why_moved = result["why_moved"]
                if isinstance(why_moved, list):
                    # 리스트인 경우 bullet point로 변환
                    why_text = "\n".join([f"- {item}" for item in why_moved])
                else:
                    why_text = why_moved
                report_parts.append(f"## 왜 {direction}했을까?\n\n{why_text}")

            if result.get("related_stocks"):
                related = result["related_stocks"]
                if isinstance(related, list) and len(related) > 0:
                    if isinstance(related[0], dict):
                        # 딕셔너리 리스트인 경우 테이블로 변환
                        lines = ["| 종목 | 변동 | 요약 |", "|------|------|------|"]
                        for item in related:
                            ticker = item.get("ticker", item.get("symbol", "?"))
                            change = item.get("change", "?")
                            reason = item.get("reason", item.get("summary", ""))
                            lines.append(f"| {ticker} | {change} | {reason} |")
                        related_text = "\n".join(lines)
                    else:
                        # 문자열 리스트
                        related_text = "\n".join([f"- {item}" for item in related])
                else:
                    related_text = str(related)
                report_parts.append(f"## 같이 봐야 할 종목\n\n{related_text}")

            if result.get("korean_investor_note"):
                report_parts.append(f"## 한국 투자자 체크\n\n{result['korean_investor_note']}")

            # 기존 report 필드가 있으면 그것도 사용
            final_report = "\n\n".join(report_parts) if report_parts else result.get("report", self._generate_fallback_report(top1, stocks))

            return {
                "headline": result.get("headline", f"{top1['symbol']} 급등"),
                "criteria_label": result.get("criteria_label", "거래량/변동률 상위"),
                "summary": result.get("summary", self._generate_fallback_summary(top1)),
                "report": final_report,
            }

        except Exception as e:
            print(f"Gemini API 오류, 폴백 사용: {e}")
            # 폴백: 기본 텍스트 생성
            return {
                "headline": f"{top1['symbol']} 주목",
                "criteria_label": self._generate_criteria_label(top1),
                "summary": self._generate_fallback_summary(top1),
                "report": self._generate_fallback_report(top1, stocks),
            }

    def _generate_fallback_summary(self, top1: dict) -> str:
        """폴백 요약 생성"""
        change_pct = top1["regular_market_change_percent"]
        direction = "상승" if change_pct >= 0 else "하락"
        return (
            f"오늘 가장 주목받은 종목은 {top1['symbol']}({top1['short_name']})입니다. "
            f"{abs(change_pct):.1f}% {direction}하며 "
            f"{', '.join(top1['source_tags'])} 스크리너에서 상위권을 기록했습니다."
        )

    def _generate_fallback_report(self, top1: dict, stocks: list[dict]) -> str:
        """폴백 리포트 생성"""
        lines = [
            f"## {top1['symbol']} - 오늘의 화제 종목",
            "",
            f"**{top1['short_name']}**이(가) 오늘 미국 주식시장에서 가장 주목받았습니다.",
            "",
            f"- 현재가: ${top1['regular_market_price']:.2f}",
            f"- 변동률: {top1['regular_market_change_percent']:+.2f}%",
            f"- 출처: {', '.join(top1['source_tags'])}",
            "",
            "### 기타 주목 종목",
            "",
        ]
        for stock in stocks[1:5]:
            lines.append(
                f"- **{stock['symbol']}**: ${stock['regular_market_price']:.2f} "
                f"({stock['regular_market_change_percent']:+.2f}%)"
            )
        return "\n".join(lines)

    def get_briefing(self, briefing_id: str) -> Optional[Briefing]:
        """브리핑 조회"""
        return _briefings_store.get(briefing_id)

    def list_briefings(
        self,
        limit: int = 20,
        status: Optional[BriefingStatus] = None,
    ) -> list[Briefing]:
        """브리핑 목록 조회"""
        briefings = list(_briefings_store.values())

        if status:
            briefings = [b for b in briefings if b.status == status]

        # 최신순 정렬
        briefings.sort(key=lambda b: b.created_at, reverse=True)

        return briefings[:limit]

    def _fetch_trending_stocks(
        self,
        symbols: Optional[list[str]] = None,
    ) -> list[dict]:
        """화제 종목 데이터 조회"""
        all_stocks: dict[str, dict] = {}

        for screener_type in [
            ScreenerType.MOST_ACTIVES,
            ScreenerType.DAY_GAINERS,
            ScreenerType.DAY_LOSERS,
        ]:
            stocks = self._trending_service.get_trending_stocks(screener_type, count=10)

            for rank, stock in enumerate(stocks, 1):
                symbol = stock.symbol

                if symbols and symbol not in symbols:
                    continue

                if symbol not in all_stocks:
                    all_stocks[symbol] = {
                        "symbol": stock.symbol,
                        "short_name": stock.short_name,
                        "regular_market_price": stock.regular_market_price,
                        "regular_market_change": stock.regular_market_change,
                        "regular_market_change_percent": stock.regular_market_change_percent,
                        "regular_market_volume": stock.regular_market_volume,
                        "source_tags": [],
                        "rank": {},
                        "score": 0,
                    }

                all_stocks[symbol]["source_tags"].append(screener_type.value)
                all_stocks[symbol]["rank"][screener_type.value] = rank

        # 점수 계산
        for symbol, data in all_stocks.items():
            source_count = len(data["source_tags"])
            avg_rank = sum(data["rank"].values()) / len(data["rank"])
            data["score"] = round(source_count * 0.3 + (1 - avg_rank / 10) * 0.7, 2)

        result = sorted(all_stocks.values(), key=lambda x: x["score"], reverse=True)
        return result

    def _create_briefing_items(self, stocks_data: list[dict]) -> list[BriefingItem]:
        """브리핑 아이템 생성"""
        items = []
        for stock in stocks_data:
            change_pct = stock["regular_market_change_percent"]
            direction = "상승" if change_pct >= 0 else "하락"

            items.append(BriefingItem(
                symbol=stock["symbol"],
                short_name=stock["short_name"],
                headline_ko=f"{stock['short_name']} {abs(change_pct):.1f}% {direction}",
                key_points_ko=[
                    f"현재가: ${stock['regular_market_price']:.2f}",
                    f"변동률: {change_pct:+.2f}%",
                    f"스크리너: {', '.join(stock['source_tags'])}",
                ],
                source_tags=stock["source_tags"],
                regular_market_price=stock["regular_market_price"],
                regular_market_change_percent=change_pct,
            ))
        return items

    def _generate_criteria_label(self, top1: dict) -> str:
        """선정 기준 라벨 생성"""
        tags = top1["source_tags"]
        if len(tags) >= 3:
            return "거래량/상승률/하락률 스크리너 모두 상위권"
        elif len(tags) == 2:
            return f"{' + '.join(tags)} 스크리너 중복 등장"
        else:
            return f"{tags[0]} 스크리너 1위"

    def _format_date_korean(self, date_str: str) -> str:
        """날짜를 한국어 형식으로 변환"""
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return f"{dt.month}/{dt.day}"

    def _generate_image_data_url(self, top1: dict, date_str: str, headline: str = "") -> str:
        """SVG 이미지 데이터 URL 생성"""
        change_pct = top1["regular_market_change_percent"]
        color = "#10b981" if change_pct >= 0 else "#f43f5e"
        arrow = "↑" if change_pct >= 0 else "↓"

        # 헤드라인이 없으면 기본값
        if not headline:
            headline = f"{top1['symbol']} {'급등' if change_pct >= 0 else '급락'}"

        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0b0f1a"/>
      <stop offset="100%" style="stop-color:#111b33"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1350" fill="url(#bg)"/>
  <text x="540" y="180" text-anchor="middle" fill="#f5f0e6" font-family="sans-serif" font-size="48" font-weight="bold">당신이 잠든 사이</text>
  <text x="540" y="250" text-anchor="middle" fill="#8b8680" font-family="monospace" font-size="24">{date_str} 미국주식 브리핑</text>
  <text x="540" y="480" text-anchor="middle" fill="#f5f0e6" font-family="sans-serif" font-size="120" font-weight="bold">{top1["symbol"]}</text>
  <text x="540" y="580" text-anchor="middle" fill="#8b8680" font-family="sans-serif" font-size="32">{top1["short_name"]}</text>
  <text x="540" y="720" text-anchor="middle" fill="{color}" font-family="monospace" font-size="72" font-weight="bold">{arrow} {abs(change_pct):.2f}%</text>
  <text x="540" y="820" text-anchor="middle" fill="#f5f0e6" font-family="monospace" font-size="48">${top1["regular_market_price"]:.2f}</text>
  <text x="540" y="1000" text-anchor="middle" fill="#d4a574" font-family="sans-serif" font-size="36">{headline}</text>
  <text x="540" y="1200" text-anchor="middle" fill="#d4a574" font-family="sans-serif" font-size="24">Powered by Gemini AI</text>
</svg>'''

        encoded = base64.b64encode(svg.encode("utf-8")).decode("utf-8")
        return f"data:image/svg+xml;base64,{encoded}"
