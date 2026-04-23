from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StudentWaitlistCreate(BaseModel):
    student_id: int
    teacher_id: Optional[int] = None
    discipline_id: Optional[int] = None
    desired_schedule_text: Optional[str] = None
    comment: Optional[str] = None
    status: Optional[str] = Field(default="waiting", max_length=50)


class StudentWaitlistUpdate(BaseModel):
    teacher_id: Optional[int] = None
    discipline_id: Optional[int] = None
    desired_schedule_text: Optional[str] = None
    comment: Optional[str] = None
    status: Optional[str] = Field(default=None, max_length=50)


class StudentWaitlistResponse(BaseModel):
    id: int
    student_id: int
    teacher_id: Optional[int] = None
    discipline_id: Optional[int] = None
    desired_schedule_text: Optional[str] = None
    comment: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
