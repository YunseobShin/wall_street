"""Test Gemini prompt directly to see the response structure."""
import os
import json
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-2.0-flash")

# Sample data
top1 = {
    "symbol": "ASTS",
    "short_name": "AST SpaceMobile, Inc.",
    "regular_market_price": 78.05,
    "regular_market_change_percent": -8.89,
    "source_tags": ["most_actives", "day_losers"]
}

stocks_info = """- ASTS (AST SpaceMobile, Inc.): $78.05, 변동률 -8.89%, 스크리너: most_actives, day_losers
- NVDA (NVIDIA Corporation): $188.61, 변동률 -0.32%, 스크리너: most_actives
- EWTX (Edgewise Therapeutics, Inc.): $27.29, 변동률 +25.50%, 스크리너: day_gainers"""

direction = "하락"
trading_date = "2025-12-26"

prompt = f"""당신은 "당신이 잠든 사이" 미국 주식 브리핑 서비스의 AI 애널리스트입니다.

한국의 투자자들이 아침에 일어나서 "어젯밤 미국 시장에서 무슨 일이 있었지?"라고 궁금해할 때,
마치 친한 증권사 친구가 커피 한 잔 하면서 설명해주듯이 브리핑을 작성해주세요.

## 오늘의 데이터 ({trading_date}, 뉴욕 기준)

### TOP 1 화제 종목
- 종목: {top1['symbol']} ({top1['short_name']})
- 현재가: ${top1['regular_market_price']:.2f}
- 변동: {top1['regular_market_change_percent']:+.2f}% {direction}
- 거래량 순위: {', '.join(top1['source_tags'])} 상위권

### 기타 주목 종목
{stocks_info}

## 당신의 임무

1. **왜 이 종목이 {direction}했는지** 설명해주세요
   - 이 회사가 뭘 하는 회사인지 (사업 영역)
   - 최근 이 종목/산업에 영향을 줄 만한 이슈
   - 당신이 알고 있는 이 회사에 대한 맥락 정보

2. **한국 투자자에게 의미 있는 인사이트** 제공

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
- 친근하지만 전문적인 톤
- 구체적인 숫자와 팩트 기반
- 불확실성 표현 적절히 사용
"""

print("=" * 60)
print("Sending prompt to Gemini...")
print("=" * 60)

response = model.generate_content(prompt)
text = response.text.strip()

print("\n=== RAW RESPONSE ===")
print(text)
print("\n=== PARSING ===")

# Clean up
if text.startswith("```"):
    text = text.split("```")[1]
    if text.startswith("json"):
        text = text[4:]
if text.endswith("```"):
    text = text[:-3]

try:
    result = json.loads(text.strip())
    print(f"Keys: {list(result.keys())}")
    print("\n=== PARSED FIELDS ===")
    for key, value in result.items():
        print(f"\n[{key}]")
        print(value[:200] if len(str(value)) > 200 else value)
except Exception as e:
    print(f"Parse error: {e}")
