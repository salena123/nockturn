from fastapi import HTTPException


ADMIN_ROLES = {"admin", "superadmin"}
STAFF_ROLES = {"admin", "superadmin", "teacher"}


def require_admin(user) -> None:
    role_name = getattr(getattr(user, "role", None), "name", None)
    if role_name not in ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")


def require_staff(user) -> None:
    role_name = getattr(getattr(user, "role", None), "name", None)
    if role_name not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
