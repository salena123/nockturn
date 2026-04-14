from pydantic import BaseModel

class UserCreate(BaseModel):
    login: str
    password: str
    role_id: int
    is_active: bool

class UserLogin(BaseModel):
    login: str
    password: str