from sqlalchemy.orm import Session

from core.config import (
    DEFAULT_SUPERADMIN_LOGIN,
    DEFAULT_SUPERADMIN_NAME,
    DEFAULT_SUPERADMIN_PASSWORD,
    DEFAULT_SUPERADMIN_PHONE,
)
from core.security import hash_password, is_strong_password
from models.role import Role
from models.user import User


DEFAULT_ROLES = ("superadmin", "admin", "teacher")


def ensure_default_roles(db: Session) -> None:
    existing_role_names = {role.name for role in db.query(Role).all()}
    created = False

    for role_name in DEFAULT_ROLES:
        if role_name not in existing_role_names:
            db.add(Role(name=role_name))
            created = True

    if created:
        db.commit()


def ensure_default_superadmin(db: Session) -> None:
    ensure_default_roles(db)

    if not DEFAULT_SUPERADMIN_LOGIN or not DEFAULT_SUPERADMIN_PASSWORD:
        return

    existing_user = db.query(User).filter(User.login == DEFAULT_SUPERADMIN_LOGIN).first()
    if existing_user:
        return

    if not is_strong_password(DEFAULT_SUPERADMIN_PASSWORD):
        raise RuntimeError(
            "DEFAULT_SUPERADMIN_PASSWORD должен быть не короче 8 символов и содержать буквы и цифры"
        )

    superadmin_role = db.query(Role).filter(Role.name == "superadmin").first()
    if superadmin_role is None:
        raise RuntimeError("Не удалось найти роль superadmin для bootstrap-пользователя")

    db.add(
        User(
            login=DEFAULT_SUPERADMIN_LOGIN,
            password=hash_password(DEFAULT_SUPERADMIN_PASSWORD),
            full_name=DEFAULT_SUPERADMIN_NAME or "Суперадминистратор",
            phone=DEFAULT_SUPERADMIN_PHONE or None,
            role_id=superadmin_role.id,
            is_active=True,
        )
    )
    db.commit()
