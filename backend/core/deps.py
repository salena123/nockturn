from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt as pyjwt
from core.config import SECRET_KEY, ALGORITHM
from db.session import SessionLocal
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = pyjwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")

        user = db.query(User).filter(User.email == email).first()

        if not user:
            raise HTTPException(status_code=401, detail="Пользователь не найден")

        return user

    except:
        raise HTTPException(status_code=401, detail="Неверный токен")
