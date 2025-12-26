from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from zoneinfo import ZoneInfo

from models.briefing import (
    Briefing,
    BriefingStatus,
    CreateBriefingRequest,
)
from services.briefing_service import BriefingService, BriefingServiceError
from services.email_service import EmailService, EmailServiceError


class SendEmailRequest(BaseModel):
    """이메일 발송 요청"""
    recipient: EmailStr

router = APIRouter(prefix="/briefings", tags=["briefings"])


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


def briefing_to_dict(b: Briefing) -> dict:
    """Briefing 모델을 API 응답 형식으로 변환"""
    return {
        "briefingId": b.id,
        "date": b.date,
        "title": b.title,
        "status": b.status.value,
        "top1Symbol": b.top1_symbol,
        "criteriaLabel": b.criteria_label,
        "summaryText": b.summary_text,
        "reportText": b.report_text,
        "items": [
            {
                "symbol": item.symbol,
                "shortName": item.short_name,
                "headlineKo": item.headline_ko,
                "keyPointsKo": item.key_points_ko,
                "sourceTags": item.source_tags,
                "regularMarketPrice": item.regular_market_price,
                "regularMarketChangePercent": item.regular_market_change_percent,
            }
            for item in b.items
        ],
        "assets": {
            "image": {
                "dataUrl": b.assets.image_data_url,
                "width": b.assets.image_width,
                "height": b.assets.image_height,
            }
        },
        "createdAt": b.created_at,
        "meta": {
            "tradingDate": b.meta.trading_date,
            "dataAsOf": b.meta.data_as_of,
            "timezone": b.meta.timezone,
            "usedCache": b.meta.used_cache,
            "sources": b.meta.sources,
            "disclaimer": b.meta.disclaimer,
        },
    }


@router.post("", status_code=202)
async def create_briefing(request: CreateBriefingRequest):
    """
    브리핑 생성 API

    화제 종목을 조회하고 브리핑을 생성합니다.
    """
    service = BriefingService()

    try:
        briefing = service.create_briefing(request)

        return create_response({
            "briefingId": briefing.id,
            "status": briefing.status.value,
            "date": briefing.date,
            "title": briefing.title,
            "top1Symbol": briefing.top1_symbol,
        })

    except BriefingServiceError as e:
        raise HTTPException(
            status_code=503,
            detail=create_error_response("SERVICE_UNAVAILABLE", str(e)),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=create_error_response("INTERNAL_ERROR", str(e)),
        )


@router.get("/{briefing_id}")
async def get_briefing(briefing_id: str):
    """
    브리핑 조회 API

    생성된 브리핑의 상세 정보를 조회합니다.
    """
    service = BriefingService()
    briefing = service.get_briefing(briefing_id)

    if not briefing:
        raise HTTPException(
            status_code=404,
            detail=create_error_response(
                "NOT_FOUND",
                f"Briefing not found: {briefing_id}",
            ),
        )

    return create_response(briefing_to_dict(briefing))


@router.get("")
async def list_briefings(
    limit: int = Query(20, ge=1, le=100, description="조회 수"),
    status: Optional[str] = Query(None, description="상태 필터 (QUEUED, READY, FAILED)"),
):
    """
    브리핑 목록 조회 API
    """
    service = BriefingService()

    status_filter = None
    if status:
        try:
            status_filter = BriefingStatus(status)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail=create_error_response(
                    "VALIDATION_ERROR",
                    f"Invalid status: {status}",
                    {"valid_values": [s.value for s in BriefingStatus]},
                ),
            )

    briefings = service.list_briefings(limit=limit, status=status_filter)

    return create_response({
        "items": [
            {
                "briefingId": b.id,
                "date": b.date,
                "status": b.status.value,
                "title": b.title,
                "top1Symbol": b.top1_symbol,
                "createdAt": b.created_at,
            }
            for b in briefings
        ],
        "page": {
            "limit": limit,
            "count": len(briefings),
        },
    })


@router.post("/{briefing_id}/send-email")
async def send_briefing_email(briefing_id: str, request: SendEmailRequest):
    """
    브리핑 이메일 발송 API

    지정된 이메일 주소로 브리핑을 발송합니다.
    """
    briefing_service = BriefingService()
    briefing = briefing_service.get_briefing(briefing_id)

    if not briefing:
        raise HTTPException(
            status_code=404,
            detail=create_error_response(
                "NOT_FOUND",
                f"Briefing not found: {briefing_id}",
            ),
        )

    try:
        email_service = EmailService()
        result = email_service.send_briefing(briefing, recipient=request.recipient)

        return create_response({
            "sent": True,
            "recipient": result["recipient"],
            "subject": result["subject"],
            "sentAt": result["sent_at"],
        })

    except EmailServiceError as e:
        raise HTTPException(
            status_code=503,
            detail=create_error_response("EMAIL_SEND_FAILED", str(e)),
        )
