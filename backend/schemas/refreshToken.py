from pydantic import BaseModel


class RefreshTokenCreate(BaseModel):
    token: str
    user_id: int


class RefreshTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
