from datetime import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class PaymentCreate(BaseModel):
    student_id: Optional[int] = None
    subscription_id: Optional[int] = None
    amount: Decimal
    method: Optional[str] = None
    paid_at: Optional[datetime] = None
    comment: Optional[str] = None
    status: Optional[str] = None


class PaymentUpdate(BaseModel):
    student_id: Optional[int] = None
    subscription_id: Optional[int] = None
    amount: Optional[Decimal] = None
    method: Optional[str] = None
    paid_at: Optional[datetime] = None
    comment: Optional[str] = None
    status: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    student_id: Optional[int] = None
    subscription_id: Optional[int] = None
    amount: Optional[Decimal] = None
    method: Optional[str] = None
    paid_at: Optional[datetime] = None
    comment: Optional[str] = None
    status: Optional[str] = None
    subscription_balance_snapshot: Optional[int] = None

    class Config:
        from_attributes = True
