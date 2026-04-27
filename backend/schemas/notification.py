from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: int
    student_id: Optional[int] = None
    user_id: Optional[int] = None
    note_id: Optional[int] = None
    text: str
    type: Optional[str] = None
    is_read: bool = False
    created_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    student_name: Optional[str] = None
    user_name: Optional[str] = None

    class Config:
        from_attributes = True
