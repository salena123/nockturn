from pydantic import BaseModel

class UserCreate(BaseModel):
    login: str
    password: str
    role: str  # admin, teacher или superadmin

class UserLogin(BaseModel):
    login: str
    password: str