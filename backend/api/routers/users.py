from fastapi import APIRouter, Depends, HTTPException
from core.deps import get_current_user
from schemas.user import UserCreate
from core.security import hash_password

router = APIRouter(prefix="/api")

users_db = []

@router.post("/users")
def create_user(data: UserCreate, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")

