from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class SubscriptionCreate(BaseModel):
    student_id: int
    tariff_id: int
    discount_id: Optional[int] = None
    start_date: date
    end_date: Optional[date] = None
    status: Optional[str] = None
    freeze_start_date: Optional[date] = None
    freeze_end_date: Optional[date] = None
    freeze_reason: Optional[str] = None
    remaining_lessons: Optional[int] = None
    lessons_total: Optional[int] = None
    balance_lessons: Optional[int] = None
    price: Optional[float] = None
    price_per_lesson: Optional[float] = None
    total_price: Optional[float] = None


class SubscriptionUpdate(BaseModel):
    student_id: Optional[int] = None
    tariff_id: Optional[int] = None
    discount_id: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    freeze_start_date: Optional[date] = None
    freeze_end_date: Optional[date] = None
    freeze_reason: Optional[str] = None
    remaining_lessons: Optional[int] = None
    lessons_total: Optional[int] = None
    balance_lessons: Optional[int] = None
    price: Optional[float] = None
    price_per_lesson: Optional[float] = None
    total_price: Optional[float] = None


class SubscriptionResponse(BaseModel):
    id: int
    student_id: Optional[int] = None
    tariff_id: Optional[int] = None
    discount_id: Optional[int] = None
    lessons_total: Optional[int] = None
    remaining_lessons: Optional[int] = None
    balance_lessons: Optional[int] = None
    price: Optional[float] = None
    price_per_lesson: Optional[float] = None
    total_price: Optional[float] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[str] = None
    freeze_start_date: Optional[date] = None
    freeze_end_date: Optional[date] = None
    freeze_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
