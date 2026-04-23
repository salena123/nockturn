from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field


class ArchivedUserCreate(BaseModel):
    original_user_id: Optional[int] = None
    login: str = Field(..., min_length=1, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    role_id: Optional[int] = None
    hire_date: Optional[date] = None
    archived_by: Optional[int] = None
    snapshot_json: Optional[str] = None


class ArchivedUserResponse(BaseModel):
    id: int
    original_user_id: Optional[int] = None
    login: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[int] = None
    hire_date: Optional[date] = None
    archived_at: Optional[datetime] = None
    archived_by: Optional[int] = None
    snapshot_json: Optional[str] = None

    class Config:
        from_attributes = True
