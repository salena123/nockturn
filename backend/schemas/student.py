from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class StudentCreate(BaseModel):
    fio: str
    phone: Optional[str] = None
    email: Optional[str] = None
    has_parent: bool = False
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_telegram_id: Optional[int] = None
    address: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    first_contact_date: Optional[date] = None
    birth_date: Optional[date] = None
    consent_received: bool = False
    consent_received_at: Optional[datetime] = None
    consent_document_version: Optional[str] = None


class StudentUpdate(BaseModel):
    fio: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    has_parent: Optional[bool] = None
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    parent_telegram_id: Optional[int] = None
    address: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    first_contact_date: Optional[date] = None
    birth_date: Optional[date] = None
    consent_received: Optional[bool] = None
    consent_received_at: Optional[datetime] = None
    consent_document_version: Optional[str] = None


class ParentResponse(BaseModel):
    id: int
    full_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    telegram_id: Optional[int] = None

    class Config:
        from_attributes = True


class StudentResponse(BaseModel):
    id: int
    fio: str
    phone: Optional[str] = None
    email: Optional[str] = None
    has_parent: bool
    parent_id: Optional[int] = None
    parent_name: Optional[str] = None
    parent: Optional[ParentResponse] = None
    address: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    first_contact_date: Optional[date] = None
    birth_date: Optional[date] = None
    consent_received: bool = False
    consent_received_at: Optional[datetime] = None
    consent_document_version: Optional[str] = None
    age: Optional[int] = None

    class Config:
        from_attributes = True
