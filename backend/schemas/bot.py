from datetime import date, datetime

from pydantic import BaseModel, Field


class BotPhoneResolveRequest(BaseModel):
    phone: str = Field(..., min_length=1)


class BotPhoneResolveMatch(BaseModel):
    student_id: int
    fio: str
    parent_id: int | None = None
    parent_name: str | None = None
    relation: str


class BotPhoneResolveResponse(BaseModel):
    normalized_phone: str
    matches: list[BotPhoneResolveMatch]


class BotLinkCreateRequest(BaseModel):
    vk_user_id: int
    student_id: int
    parent_id: int | None = None
    phone: str | None = None


class BotLinkResponse(BaseModel):
    linked: bool
    platform: str
    vk_user_id: int
    student_id: int
    student_name: str
    parent_id: int | None = None
    parent_name: str | None = None


class BotSubscriptionResponse(BaseModel):
    student_id: int
    student_name: str
    subscription_id: int | None = None
    balance_lessons: int | None = None
    end_date: date | None = None
    status: str | None = None
    tariff_id: int | None = None


class BotScheduleItem(BaseModel):
    lesson_id: int
    event_id: int
    start_time: datetime
    end_time: datetime
    teacher_name: str | None = None
    discipline_name: str | None = None
    room_name: str | None = None


class BotScheduleResponse(BaseModel):
    student_id: int
    student_name: str
    items: list[BotScheduleItem]


class BotAbsenceReportRequest(BaseModel):
    lesson_id: int
    reason: str
    comment: str | None = None


class BotAbsenceReportResponse(BaseModel):
    student_id: int
    student_name: str
    lesson_id: int
    attendance_id: int
    status: str
    notified_at: datetime
    can_transfer: bool
    lesson_start_time: datetime
    message: str
