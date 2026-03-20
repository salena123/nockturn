from typing import Optional
from pydantic import BaseModel

class StudentCreate(BaseModel):
    fio: str
    phone: str
    email: str
    has_parent: bool
    parent_id: Optional[int] = None

class StudentResponse(StudentCreate):
    id: int