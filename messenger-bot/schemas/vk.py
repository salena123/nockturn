from typing import Any

from pydantic import BaseModel, Field


class VkCallbackObject(BaseModel):
    message: dict[str, Any] | None = None


class VkCallbackPayload(BaseModel):
    type: str = Field(..., min_length=1)
    group_id: int | None = None
    event_id: str | None = None
    secret: str | None = None
    object: VkCallbackObject | dict[str, Any] | None = None
