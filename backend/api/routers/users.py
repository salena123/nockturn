from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from core.access import require_admin
from core.deps import get_current_user, get_db
from core.security import generate_password, hash_password, is_strong_password
from models.role import Role
from models.user import User
from schemas.user import (
    RoleResponse,
    UserCreate,
    UserPasswordResetRequest,
    UserResponse,
    UserUpdate,
    UserWithPasswordResponse,
)


router = APIRouter(prefix="/api")


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        login=user.login,
        full_name=user.full_name,
        phone=user.phone,
        role_id=user.role_id,
        role=user.role.name if user.role else None,
        is_active=bool(user.is_active),
        hire_date=user.hire_date,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def get_role_or_404(db: Session, role_id: int) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    return role


def ensure_role_assignable(current_user: User, role: Role) -> None:
    current_role = current_user.role.name if current_user.role else None
    if current_role != "superadmin" and role.name == "superadmin":
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")


def get_user_or_404(db: Session, user_id: int) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


def ensure_manageable_by_current_user(current_user: User, target_user: User) -> None:
    current_role = current_user.role.name if current_user.role else None
    target_role = target_user.role.name if target_user.role else None

    if current_role == "superadmin":
        return

    if current_role == "admin" and target_role == "superadmin":
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.get("/roles", response_model=list[RoleResponse])
def get_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return db.query(Role).order_by(Role.name.asc()).all()


@router.get("/users", response_model=list[UserResponse])
def get_users(
    is_active: bool | None = None,
    role_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    query = db.query(User).options(joinedload(User.role))

    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if role_id is not None:
        query = query.filter(User.role_id == role_id)

    users = query.order_by(User.created_at.desc(), User.id.desc()).all()
    return [serialize_user(user) for user in users]


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return serialize_user(get_user_or_404(db, user_id))


@router.post("/users", response_model=UserWithPasswordResponse)
def create_user(
    data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    role = get_role_or_404(db, data.role_id)
    ensure_role_assignable(current_user, role)

    existing_user = db.query(User).filter(User.login == data.login).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Такой пользователь уже существует")

    password = data.password
    generated_password = None

    if data.generate_password or not password:
        generated_password = generate_password()
        password = generated_password
    elif not is_strong_password(password):
        raise HTTPException(
            status_code=400,
            detail="Пароль должен быть не короче 8 символов и содержать буквы и цифры",
        )

    new_user = User(
        login=data.login,
        password=hash_password(password),
        full_name=data.full_name,
        phone=data.phone,
        role_id=data.role_id,
        is_active=data.is_active,
        hire_date=data.hire_date,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user = get_user_or_404(db, new_user.id)
    return UserWithPasswordResponse(
        user=serialize_user(user),
        generated_password=generated_password,
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)

    if current_user.id == user_id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

    if data.login is not None and data.login != target_user.login:
        existing_user = db.query(User).filter(User.login == data.login).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Такой пользователь уже существует")
        target_user.login = data.login

    if data.role_id is not None:
        role = get_role_or_404(db, data.role_id)
        ensure_role_assignable(current_user, role)
        target_user.role_id = data.role_id

    if data.full_name is not None:
        target_user.full_name = data.full_name
    if data.phone is not None:
        target_user.phone = data.phone
    if data.is_active is not None:
        target_user.is_active = data.is_active
    if data.hire_date is not None:
        target_user.hire_date = data.hire_date

    db.commit()
    db.refresh(target_user)

    return serialize_user(get_user_or_404(db, target_user.id))


@router.post("/users/{user_id}/reset-password", response_model=UserWithPasswordResponse)
def reset_user_password(
    user_id: int,
    data: UserPasswordResetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)

    password = data.password
    generated_password = None

    if data.generate_password or not password:
        generated_password = generate_password()
        password = generated_password
    elif not is_strong_password(password):
        raise HTTPException(
            status_code=400,
            detail="Пароль должен быть не короче 8 символов и содержать буквы и цифры",
        )

    target_user.password = hash_password(password)
    db.commit()
    db.refresh(target_user)

    return UserWithPasswordResponse(
        user=serialize_user(get_user_or_404(db, target_user.id)),
        generated_password=generated_password,
    )


@router.post("/users/{user_id}/block", response_model=UserResponse)
def block_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)
    target_user.is_active = False
    db.commit()
    db.refresh(target_user)
    return serialize_user(get_user_or_404(db, target_user.id))


@router.post("/users/{user_id}/unblock", response_model=UserResponse)
def unblock_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)
    target_user.is_active = True
    db.commit()
    db.refresh(target_user)
    return serialize_user(get_user_or_404(db, target_user.id))


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)
    db.delete(target_user)
    db.commit()

    return {"message": "Пользователь успешно удален"}
