#!/usr/bin/env python3
"""
당신이 잠든 사이 - 일일 브리핑 실행 스크립트

GitHub Actions 또는 수동으로 실행하여 다음 작업 수행:
1. 화제 종목 조회 (Yahoo Finance)
2. 브리핑 생성 (Gemini AI)
3. 이메일 발송 (선택)

Usage:
    python scripts/run_daily_briefing.py
    python scripts/run_daily_briefing.py --no-email  # 이메일 발송 스킵
"""
import os
import sys
import json
import argparse
from datetime import datetime
from zoneinfo import ZoneInfo
from pathlib import Path

# 프로젝트 루트를 path에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv()

from models.briefing import CreateBriefingRequest
from services.trending_service import TrendingStockService, TrendingStockServiceError
from services.briefing_service import BriefingService, BriefingServiceError
from models.trending import ScreenerType


def run_daily_briefing(send_email: bool = True) -> dict:
    """일일 브리핑 실행"""
    result = {
        "success": False,
        "steps": {},
        "error": None,
    }

    now_kst = datetime.now(ZoneInfo("Asia/Seoul"))
    now_ny = datetime.now(ZoneInfo("America/New_York"))

    print("=" * 60)
    print("당신이 잠든 사이 - Daily Briefing")
    print("=" * 60)
    print(f"실행 시각 (KST): {now_kst.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"뉴욕 시각 (EST): {now_ny.strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Step 1: 화제 종목 조회
    print("[1/3] 화제 종목 조회 중...")
    try:
        trending_service = TrendingStockService()

        stocks = {}
        for screener_type in [
            ScreenerType.MOST_ACTIVES,
            ScreenerType.DAY_GAINERS,
            ScreenerType.DAY_LOSERS,
        ]:
            items = trending_service.get_trending_stocks(screener_type, count=5)
            stocks[screener_type.value] = [
                {
                    "symbol": s.symbol,
                    "name": s.short_name,
                    "price": s.regular_market_price,
                    "change_pct": s.regular_market_change_percent,
                }
                for s in items
            ]
            print(f"  - {screener_type.value}: {len(items)}개 조회")

        result["steps"]["trending"] = {
            "success": True,
            "counts": {k: len(v) for k, v in stocks.items()},
        }
        print("  ✓ 화제 종목 조회 완료\n")

    except TrendingStockServiceError as e:
        print(f"  ✗ 화제 종목 조회 실패: {e}\n")
        result["steps"]["trending"] = {"success": False, "error": str(e)}
        result["error"] = str(e)
        return result

    # Step 2: 브리핑 생성
    print("[2/3] 브리핑 생성 중 (Gemini AI)...")
    try:
        briefing_service = BriefingService()
        request = CreateBriefingRequest()
        briefing = briefing_service.create_briefing(request)

        result["steps"]["briefing"] = {
            "success": True,
            "briefing_id": briefing.id,
            "top1_symbol": briefing.top1_symbol,
            "title": briefing.title,
        }
        print(f"  - 브리핑 ID: {briefing.id}")
        print(f"  - TOP 1: {briefing.top1_symbol}")
        print(f"  - 제목: {briefing.title}")
        print("  ✓ 브리핑 생성 완료\n")

        # 브리핑 결과 파일로 저장
        output_dir = Path(__file__).parent.parent / "output"
        output_dir.mkdir(exist_ok=True)

        output_file = output_dir / f"briefing_{briefing.date}.json"
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(briefing.model_dump(), f, ensure_ascii=False, indent=2, default=str)
        print(f"  - 저장 위치: {output_file}\n")

    except BriefingServiceError as e:
        print(f"  ✗ 브리핑 생성 실패: {e}\n")
        result["steps"]["briefing"] = {"success": False, "error": str(e)}
        result["error"] = str(e)
        return result

    # Step 3: 이메일 발송
    if send_email:
        print("[3/3] 이메일 발송 중...")
        try:
            from services.email_service import EmailService, EmailServiceError
            from api.subscriptions import get_active_subscriptions_for_time

            email_service = EmailService()

            # 현재 KST 시간에 해당하는 구독자 조회
            current_time_kst = now_kst.strftime("%H:%M")
            # 30분 단위로 반올림 (06:00, 06:30, 07:00, ...)
            hour = now_kst.hour
            minute = 0 if now_kst.minute < 30 else 30
            time_slot = f"{hour:02d}:{minute:02d}"

            subscribers = get_active_subscriptions_for_time(time_slot)

            if subscribers:
                print(f"  - 구독자 수: {len(subscribers)}명 (시간대: {time_slot} KST)")
                sent_count = 0
                failed_count = 0

                for sub in subscribers:
                    try:
                        email_result = email_service.send_briefing(briefing, recipient=sub.email)
                        print(f"    ✓ {sub.email}")
                        sent_count += 1
                    except EmailServiceError as e:
                        print(f"    ✗ {sub.email}: {e}")
                        failed_count += 1

                result["steps"]["email"] = {
                    "success": True,
                    "time_slot": time_slot,
                    "total_subscribers": len(subscribers),
                    "sent_count": sent_count,
                    "failed_count": failed_count,
                }
                print(f"  ✓ 이메일 발송 완료 ({sent_count}/{len(subscribers)})\n")
            else:
                # 구독자가 없으면 기본 수신자에게 발송
                default_recipient = os.getenv("DEFAULT_RECIPIENT")
                if default_recipient:
                    email_result = email_service.send_briefing(briefing, recipient=default_recipient)
                    result["steps"]["email"] = {
                        "success": True,
                        "recipient": email_result["recipient"],
                        "sent_at": email_result["sent_at"],
                        "note": "No subscribers, sent to default recipient",
                    }
                    print(f"  - 구독자 없음, 기본 수신자에게 발송: {default_recipient}")
                    print("  ✓ 이메일 발송 완료\n")
                else:
                    result["steps"]["email"] = {
                        "success": True,
                        "note": "No subscribers and no default recipient",
                    }
                    print("  - 구독자 및 기본 수신자 없음, 이메일 발송 스킵\n")

        except EmailServiceError as e:
            print(f"  ✗ 이메일 발송 실패: {e}\n")
            result["steps"]["email"] = {"success": False, "error": str(e)}
            # 이메일 실패는 전체 실패로 처리하지 않음
        except ImportError as e:
            print(f"  - 모듈 임포트 실패: {e}\n")
            result["steps"]["email"] = {"success": False, "error": str(e)}
    else:
        print("[3/3] 이메일 발송 스킵 (--no-email)\n")
        result["steps"]["email"] = {"success": True, "skipped": True}

    # 완료
    result["success"] = True
    print("=" * 60)
    print("Daily Briefing 완료!")
    print("=" * 60)

    return result


def main():
    parser = argparse.ArgumentParser(description="당신이 잠든 사이 - 일일 브리핑 실행")
    parser.add_argument(
        "--no-email",
        action="store_true",
        help="이메일 발송 스킵",
    )
    args = parser.parse_args()

    result = run_daily_briefing(send_email=not args.no_email)

    # 실패 시 exit code 1
    if not result["success"]:
        print(f"\n오류: {result['error']}")
        sys.exit(1)


if __name__ == "__main__":
    main()
