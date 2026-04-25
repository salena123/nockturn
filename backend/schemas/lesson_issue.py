from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class LessonIssueCreate(BaseModel):
    description: str


class LessonIssueResponse(BaseModel):
    id: int
    lesson_id: Optional[int] = None
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
