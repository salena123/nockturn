from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from schemas.user import UserLogin
from core.security import verify_password, create_access_token
from core.deps import get_db
from models.user import User

router = APIRouter(prefix="/api/auth")

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    
    if user and verify_password(data.password, user.password):
        token = create_access_token({
            "sub": user.email,
            "role": user.role
        })
        return {"access_token": token, "token_type": "bearer"}
    
    return {"error": "Invalid credentials"}