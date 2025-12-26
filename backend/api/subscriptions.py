from fastapi import APIRouter, HTTPException
from datetime import datetime
from zoneinfo import ZoneInfo
import json
from pathlib import Path

from models.subscription import (
    Subscription,
    CreateSubscriptionRequest,
    UpdateSubscriptionRequest,
)

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

# 구독자 저장 파일 (간단한 MVP용)
SUBSCRIPTIONS_FILE = Path(__file__).parent.parent / "data" / "subscriptions.json"


def _load_subscriptions() -> dict[str, Subscription]:
    """구독자 목록 로드"""
    if not SUBSCRIPTIONS_FILE.exists():
        SUBSCRIPTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        SUBSCRIPTIONS_FILE.write_text("{}", encoding="utf-8")
        return {}

    data = json.loads(SUBSCRIPTIONS_FILE.read_text(encoding="utf-8"))
    return {k: Subscription(**v) for k, v in data.items()}


def _save_subscriptions(subs: dict[str, Subscription]):
    """구독자 목록 저장"""
    SUBSCRIPTIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    data = {k: v.model_dump() for k, v in subs.items()}
    SUBSCRIPTIONS_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def _create_response(data: dict, success: bool = True):
    return {
        "success": success,
        "data": data,
        "meta": {
            "requestId": f"req_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "generatedAt": datetime.now(ZoneInfo("UTC")).isoformat(),
        },
    }


@router.post("")
async def create_subscription(request: CreateSubscriptionRequest):
    """
    이메일 구독 등록

    - 이메일과 수신 시간(KST)을 등록합니다
    - 이미 등록된 이메일이면 시간만 업데이트합니다
    """
    subs = _load_subscriptions()
    now = datetime.now(ZoneInfo("UTC")).isoformat()

    # 이메일로 기존 구독 확인
    existing = None
    for sub_id, sub in subs.items():
        if sub.email == request.email:
            existing = sub
            break

    if existing:
        # 기존 구독 업데이트
        existing.send_time_kst = request.send_time_kst
        existing.is_active = True
        existing.updated_at = now
        subs[existing.id] = existing
        _save_subscriptions(subs)

        return _create_response({
            "subscriptionId": existing.id,
            "email": existing.email,
            "sendTimeKst": existing.send_time_kst,
            "isActive": existing.is_active,
            "message": "구독 정보가 업데이트되었습니다",
        })

    # 새 구독 생성
    sub_id = f"sub_{int(datetime.now().timestamp() * 1000)}"
    subscription = Subscription(
        id=sub_id,
        email=request.email,
        send_time_kst=request.send_time_kst,
        is_active=True,
        created_at=now,
    )

    subs[sub_id] = subscription
    _save_subscriptions(subs)

    return _create_response({
        "subscriptionId": sub_id,
        "email": subscription.email,
        "sendTimeKst": subscription.send_time_kst,
        "isActive": subscription.is_active,
        "message": f"매일 {subscription.send_time_kst} (KST)에 브리핑을 발송합니다",
    })


@router.get("")
async def list_subscriptions():
    """구독자 목록 조회 (관리용)"""
    subs = _load_subscriptions()

    return _create_response({
        "items": [
            {
                "subscriptionId": sub.id,
                "email": sub.email,
                "sendTimeKst": sub.send_time_kst,
                "isActive": sub.is_active,
                "createdAt": sub.created_at,
            }
            for sub in subs.values()
        ],
        "count": len(subs),
    })


@router.delete("/{email}")
async def unsubscribe(email: str):
    """구독 취소"""
    subs = _load_subscriptions()

    target = None
    for sub_id, sub in subs.items():
        if sub.email == email:
            target = sub
            break

    if not target:
        raise HTTPException(status_code=404, detail="구독 정보를 찾을 수 없습니다")

    target.is_active = False
    target.updated_at = datetime.now(ZoneInfo("UTC")).isoformat()
    subs[target.id] = target
    _save_subscriptions(subs)

    return _create_response({
        "message": "구독이 취소되었습니다",
        "email": email,
    })


def get_active_subscriptions_for_time(time_kst: str) -> list[Subscription]:
    """특정 시간대의 활성 구독자 목록 반환"""
    subs = _load_subscriptions()
    return [
        sub for sub in subs.values()
        if sub.is_active and sub.send_time_kst == time_kst
    ]
