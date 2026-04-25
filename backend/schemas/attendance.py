from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel


class AttendanceMark(BaseModel):
    lesson_id: int
    student_id: int
    status: str
    comment: Optional[str] = None


class AttendanceUpdate(BaseModel):
    lesson_id: Optional[int] = None
    student_id: Optional[int] = None
    status: Optional[str] = None
    comment: Optional[str] = None


class AttendanceResponse(BaseModel):
    id: int
    lesson_id: Optional[int] = None
    student_id: Optional[int] = None
    subscription_id: Optional[int] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    price_per_lesson: Optional[Decimal] = None
    is_charged: bool
    student_name: Optional[str] = None
    lesson_label: Optional[str] = None
    lesson_date: Optional[date] = None
    lesson_type: Optional[str] = None
    teacher_name: Optional[str] = None
    room_name: Optional[str] = None
    discipline_name: Optional[str] = None
    subscription_balance: Optional[int] = None
