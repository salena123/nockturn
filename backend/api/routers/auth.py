from datetime import datetime, timedelta

import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

from core.config import (
    ALGORITHM,
    LOGIN_LOCK_MINUTES,
    MAX_LOGIN_ATTEMPTS,
    SECRET_KEY,
)
from core.deps import get_db
from core.entity_changes import log_entity_change
from core.request_context import extract_client_ip
from core.security import create_access_token, create_refresh_token, verify_password
from models.refreshToken import RefreshToken
from models.user import User
from schemas.refreshToken import RefreshTokenResponse
from schemas.user import UserLogin


router = APIRouter(prefix="/api/auth")


def build_invalid_credentials_error() -> HTTPException:
    return HTTPException(status_code=401, detail="Неверный логин или пароль")


def build_locked_account_error(locked_until: datetime | None) -> HTTPException:
    formatted_until = locked_until.strftime("%d.%m.%Y %H:%M") if locked_until else None
    detail = f"Учетная запись временно заблокирована на {LOGIN_LOCK_MINUTES} минут"
    if formatted_until:
        detail = f"Учетная запись временно заблокирована до {formatted_until}"
    return HTTPException(status_code=423, detail=detail)


def reset_login_protection(user: User, request_ip: str | None) -> None:
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.utcnow()
    user.last_login_ip = request_ip


def register_failed_login(db: Session, user: User, request_ip: str | None) -> None:
    current_attempts = int(user.failed_login_attempts or 0) + 1
    user.failed_login_attempts = current_attempts

    locked_until = None
    if current_attempts >= MAX_LOGIN_ATTEMPTS:
        locked_until = datetime.utcnow() + timedelta(minutes=LOGIN_LOCK_MINUTES)
        user.locked_until = locked_until
        user.failed_login_attempts = 0

    log_entity_change(
        db,
        actor_user_id=user.id,
        entity="auth",
        entity_id=user.id,
        action="login_failed",
        new_value={
            "failed_login_attempts": current_attempts,
            "locked_until": locked_until,
            "last_login_ip": request_ip,
        },
    )
    db.commit()

    if locked_until is not None:
        raise build_locked_account_error(locked_until)

    raise build_invalid_credentials_error()


@router.post("/login")
def login(data: UserLogin, request: Request, db: Session = Depends(get_db)):
    request_ip = extract_client_ip(request)

    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.login == data.login)
        .first()
    )

    if not user:
        raise build_invalid_credentials_error()

    if user.is_active is False:
        raise HTTPException(status_code=403, detail="Учетная запись заблокирована")

    if user.locked_until and user.locked_until > datetime.utcnow():
        raise build_locked_account_error(user.locked_until)

    if not verify_password(data.password, user.password):
        register_failed_login(db, user, request_ip)

    if not user.role:
        raise HTTPException(status_code=500, detail="У пользователя нет роли")

    access_token = create_access_token({"sub": user.login, "role": user.role.name})
    refresh_token = create_refresh_token({"sub": user.login})

    reset_login_protection(user, request_ip)

    existing_tokens = db.query(RefreshToken).filter(RefreshToken.user_id == user.id).all()
    for token in existing_tokens:
        db.delete(token)

    db.add(
        RefreshToken(
            token=refresh_token,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(days=7),
        )
    )
    log_entity_change(
        db,
        actor_user_id=user.id,
        entity="auth",
        entity_id=user.id,
        action="login_success",
        new_value={
            "last_login_at": user.last_login_at,
            "last_login_ip": user.last_login_ip,
        },
    )
    db.commit()

    return RefreshTokenResponse(access_token=access_token, refresh_token=refresh_token)


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
            RefreshToken.expires_at > datetime.utcnow(),
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
