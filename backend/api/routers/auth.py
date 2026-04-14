from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from schemas.user import UserLogin
from core.security import verify_password, create_access_token
from core.deps import get_db
from models.user import User

router = APIRouter(prefix="/api/auth")

@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.login == data.login).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователя с таким логином не существует")
    
    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Неверный пароль")
    
    if not user.role:
        raise HTTPException(status_code=500, detail="У пользователя нет роли")
    
    token = create_access_token({
        "sub": user.login,
        "role": user.role.name
    })
    return {"access_token": token, "token_type": "bearer"}