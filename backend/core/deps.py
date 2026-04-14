from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload
import jwt as pyjwt
from core.config import SECRET_KEY, ALGORITHM
from db.session import SessionLocal
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
        login = payload.get("sub")

        if login is None:
            raise HTTPException(status_code=401, detail="Неверный токен")

        user = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.login == login)
            .first()
        )

        if not user:
            raise HTTPException(status_code=401, detail="Пользователь не найден")

        if not user.role:
            raise HTTPException(status_code=500, detail="У пользователя нет роли")

        return user

    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")