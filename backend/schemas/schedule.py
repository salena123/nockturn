from pydantic import BaseModel
from datetime import datetime, date


class ScheduleEventBase(BaseModel):
    teacher_id: int
    discipline_id: int
    room_id: int
    start_time: datetime
    end_time: datetime
    type: str


class ScheduleEventCreate(ScheduleEventBase):
    pass


class ScheduleEventUpdate(BaseModel):
    teacher_id: int = None
    discipline_id: int = None
    room_id: int = None
    start_time: datetime = None
    end_time: datetime = None
    type: str = None


class ScheduleEvent(ScheduleEventBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduleEventWithDetails(ScheduleEvent):
    teacher: dict
    discipline: dict
    room: dict


class LessonBase(BaseModel):
    schedule_id: int
    lesson_date: date
    status: str = 'planned'
    lesson_type: str = 'individual'  
    max_students: int = 1


class LessonCreate(LessonBase):
    student_ids: list[int] = []


class LessonUpdate(BaseModel):
    schedule_id: int = None
    lesson_date: date = None
    status: str = None
    lesson_type: str = None
    max_students: int = None
    student_ids: list[int] = None


class Lesson(LessonBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class LessonWithDetails(Lesson):
    schedule: ScheduleEventWithDetails
