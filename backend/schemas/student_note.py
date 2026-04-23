from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class StudentNoteCreate(BaseModel):
    text: str = Field(..., min_length=1)


class StudentNoteUpdate(BaseModel):
    text: Optional[str] = Field(default=None, min_length=1)


class StudentNoteResponse(BaseModel):
    id: int
    student_id: int
    text: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
