from pydantic import BaseModel

class UserCreate(BaseModel):
    email: str
    password: str
    role: str  # admin, teacher или student

class UserLogin(BaseModel):
    email: str
    password: str