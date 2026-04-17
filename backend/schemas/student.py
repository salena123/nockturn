from datetime import date
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

class ParentResponse(BaseModel):
    id: int
    full_name: Optional[str]
    phone: Optional[str]
    telegram_id: Optional[int]
    
    class Config:
        orm_mode = True

class StudentResponse(BaseModel):
    id: int
    fio: str
    phone: Optional[str]
    email: Optional[str]
    has_parent: bool
    parent_id: Optional[int]
    parent_name: Optional[str]
    parent: Optional[ParentResponse] = None
    address: Optional[str]
    level: Optional[str]
    status: Optional[str]
    comment: Optional[str]
    first_contact_date: Optional[date]
    birth_date: Optional[date]

    class Config:
        orm_mode = True