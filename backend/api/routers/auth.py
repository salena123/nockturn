from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
import jwt as pyjwt
from core.deps import get_db
from core.security import create_access_token, create_refresh_token, verify_password
from core.config import SECRET_KEY, ALGORITHM
from models.user import User
from models.refreshToken import RefreshToken
from schemas.user import UserLogin
from schemas.refreshToken import RefreshTokenResponse


router = APIRouter(prefix="/api/auth")


@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.login == data.login)
        .first()
    )

    if not user:
        raise HTTPException(status_code=404, detail="Пользователь с таким логином не существует")

    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Учетная запись заблокирована")

    if not verify_password(data.password, user.password):
        raise HTTPException(status_code=401, detail="Неверный пароль")

    if not user.role:
        raise HTTPException(status_code=500, detail="У пользователя нет роли")

    access_token = create_access_token({"sub": user.login, "role": user.role.name})
    refresh_token = create_refresh_token({"sub": user.login})

    existing_tokens = db.query(RefreshToken).filter(RefreshToken.user_id == user.id).all()
    for token in existing_tokens:
        db.delete(token)

    new_refresh_token = RefreshToken(
        token=refresh_token,
        user_id=user.id,
        expires_at=datetime.utcnow() + timedelta(days=7)
    )
    db.add(new_refresh_token)
    db.commit()

    return RefreshTokenResponse(
        access_token=access_token,
        refresh_token=refresh_token
    )




@router.post("/refresh")
def refresh_token(refresh_token: str, db: Session = Depends(get_db)):
    try:
        payload = pyjwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        login = payload.get("sub")
        token_type = payload.get("type")

        if login is None or token_type != "refresh":
            raise HTTPException(status_code=401, detail="Неверный refresh токен")

        stored_token = db.query(RefreshToken).filter(
            RefreshToken.token == refresh_token,
            RefreshToken.expires_at > datetime.utcnow()
        ).first()

        if not stored_token:
            raise HTTPException(status_code=401, detail="Refresh токен не найден или истек")

        user = (
            db.query(User)
            .options(joinedload(User.role))
            .filter(User.login == login)
            .first()
        )

        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Пользователь не найден или неактивен")

        new_access_token = create_access_token({"sub": user.login, "role": user.role.name})

        return {"access_token": new_access_token, "token_type": "bearer"}

    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Неверный refresh токен")
