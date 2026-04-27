from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


RepeatType = Literal["none", "daily", "weekly", "weekdays"]


class ScheduleRecurringRule(BaseModel):
    repeat_type: RepeatType = "none"
    repeat_until: date | None = None
    weekdays: list[int] = Field(default_factory=list)


class ScheduleEventBase(BaseModel):
    teacher_id: int
    discipline_id: int
    room_id: int
    start_time: datetime
    end_time: datetime
    type: str


class ScheduleEventCreate(ScheduleEventBase):
    ignore_conflicts: bool = False


class ScheduleEventUpdate(BaseModel):
    teacher_id: int | None = None
    discipline_id: int | None = None
    room_id: int | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    type: str | None = None
    ignore_conflicts: bool = False


class ScheduleEntryCreate(BaseModel):
    teacher_id: int
    discipline_id: int
    room_id: int
    start_time: datetime
    end_time: datetime
    type: str = "lesson"
    lesson_type: str = "individual"
    max_students: int = 1
    student_ids: list[int] = Field(default_factory=list)
    ignore_conflicts: bool = False
    recurrence: ScheduleRecurringRule = Field(default_factory=ScheduleRecurringRule)


class BulkTeacherRescheduleRequest(BaseModel):
    teacher_id: int
    source_date: date
    target_date: date
    ignore_conflicts: bool = False


class ScheduleEvent(BaseModel):
    id: int
    teacher_id: int
    discipline_id: int
    room_id: int
    start_time: datetime
    end_time: datetime
    type: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class ScheduleEventWithDetails(ScheduleEvent):
    teacher: dict | None = None
    discipline: dict | None = None
    room: dict | None = None
    lesson: dict | None = None
    recurring: dict | None = None
    has_conflict: bool = False


class LessonBase(BaseModel):
    schedule_id: int
    lesson_date: date
    status: str = "planned"
    lesson_type: str = "individual"
    max_students: int = 1


class LessonCreate(LessonBase):
    student_ids: list[int] = Field(default_factory=list)


class LessonUpdate(BaseModel):
    schedule_id: int | None = None
    lesson_date: date | None = None
    status: str | None = None
    lesson_type: str | None = None
    max_students: int | None = None
    student_ids: list[int] | None = None


class Lesson(BaseModel):
    id: int
    schedule_id: int
    lesson_date: date
    status: str
    lesson_type: str
    max_students: int
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class LessonWithDetails(Lesson):
    schedule: ScheduleEventWithDetails | None = None
