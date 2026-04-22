from decimal import Decimal
from typing import Optional
from pydantic import BaseModel


class AttendanceMark(BaseModel):
    lesson_id: int
    student_id: int
    subscription_id: Optional[int] = None
    status: str
    comment: Optional[str] = None
    price_per_lesson: Optional[float] = None


class AttendanceUpdate(BaseModel):
    lesson_id: Optional[int] = None
    student_id: Optional[int] = None
    subscription_id: Optional[int] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    price_per_lesson: Optional[float] = None


class AttendanceResponse(BaseModel):
    id: int
    lesson_id: Optional[int] = None
    student_id: Optional[int] = None
    subscription_id: Optional[int] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    price_per_lesson: Optional[Decimal] = None
    is_charged: bool

    class Config:
        from_attributes = True
