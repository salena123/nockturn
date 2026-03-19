from pydantic import BaseModel

class StudentCreate(BaseModel):
    fio: str
    phone: str
    email: str

class StudentResponse(StudentCreate):
    id: int