from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserDocumentCreate(BaseModel):
    user_id: int
    document_type: str = Field(..., min_length=1, max_length=100)
    file_path: str = Field(..., min_length=1)


class UserDocumentUpdate(BaseModel):
    document_type: Optional[str] = Field(default=None, min_length=1, max_length=100)
    file_path: Optional[str] = Field(default=None, min_length=1)


class UserDocumentResponse(BaseModel):
    id: int
    user_id: int
    document_type: str
    file_path: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
