from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class Subscription(BaseModel):
    """이메일 구독 정보"""
    id: str
    email: EmailStr
    send_time_kst: str  # "07:00" 형식 (KST 기준)
    is_active: bool = True
    created_at: str
    updated_at: Optional[str] = None


class CreateSubscriptionRequest(BaseModel):
    """구독 생성 요청"""
    email: EmailStr
    send_time_kst: str = "07:00"  # 기본값: 오전 7시


class UpdateSubscriptionRequest(BaseModel):
    """구독 수정 요청"""
    send_time_kst: Optional[str] = None
    is_active: Optional[bool] = None
