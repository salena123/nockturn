from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    login: str = Field(..., min_length=3, max_length=255)
    password: Optional[str] = Field(default=None, min_length=8, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    role_id: int
    is_active: bool = True
    hire_date: Optional[date] = None
    generate_password: bool = False


class UserUpdate(BaseModel):
    login: Optional[str] = Field(default=None, min_length=3, max_length=255)
    full_name: Optional[str] = Field(default=None, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=20)
    role_id: Optional[int] = None
    is_active: Optional[bool] = None
    hire_date: Optional[date] = None


class UserPasswordResetRequest(BaseModel):
    password: Optional[str] = Field(default=None, min_length=8, max_length=255)
    generate_password: bool = True


class UserLogin(BaseModel):
    login: str
    password: str


class UserResponse(BaseModel):
    id: int
    login: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    role_id: Optional[int] = None
    role: Optional[str] = None
    is_active: bool
    hire_date: Optional[date] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UserWithPasswordResponse(BaseModel):
    user: UserResponse
    generated_password: Optional[str] = None


class RoleResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True
