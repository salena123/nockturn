from pydantic import BaseModel, Field

class UserCreate(BaseModel):
    login: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    role_id: int
    is_active: bool = True

class UserLogin(BaseModel):
    login: str
    password: str