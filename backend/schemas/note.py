from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NoteCreate(BaseModel):
    text: str = Field(..., min_length=1)
    reminder_at: Optional[datetime] = None
    recipient_user_id: Optional[int] = None
    priority: str = "normal"
    is_pinned: bool = False


class NoteUpdate(BaseModel):
    text: Optional[str] = Field(None, min_length=1)
    reminder_at: Optional[datetime] = None
    recipient_user_id: Optional[int] = None
    priority: Optional[str] = None
    is_pinned: Optional[bool] = None


class NoteResponse(BaseModel):
    id: int
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    recipient_user_id: Optional[int] = None
    recipient_user_name: Optional[str] = None
    text: str
    reminder_at: Optional[datetime] = None
    priority: str
    is_pinned: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
