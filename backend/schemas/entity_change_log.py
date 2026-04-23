from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class EntityChangeLogCreate(BaseModel):
    actor_user_id: Optional[int] = None
    entity: str = Field(..., min_length=1, max_length=100)
    entity_id: int
    field_name: Optional[str] = Field(default=None, max_length=100)
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    action: str = Field(..., min_length=1, max_length=50)


class EntityChangeLogResponse(BaseModel):
    id: int
    actor_user_id: Optional[int] = None
    entity: str
    entity_id: int
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    action: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
