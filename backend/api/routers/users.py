from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from core.deps import get_current_user, get_db
from schemas.user import UserCreate
from core.security import hash_password
from models.user import User
from pydantic import BaseModel

class UserUpdate(BaseModel):
    login: str = None
    password: str = None
    role_id: int = None

class UserResponse(BaseModel):
    id: int
    login: str
    role: str

    class Config:
        orm_mode = True

router = APIRouter(prefix="/api")

@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "login": current_user.login,
        "role": current_user.role.name
    }

@router.get("/users")
def get_users(user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role.name not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    users = db.query(User).options(joinedload(User.role)).all()
    return [{"id": u.id, "login": u.login, "role": u.role.name} for u in users]

@router.post("/users")
def create_user(data: UserCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role.name not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    print(f"Создан пользователь: {data.login}")
    
    existing_user = db.query(User).filter(User.login == data.login).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Такой пользователь уже существует")

    new_user = User(
        login=data.login,
        password=hash_password(data.password),
        role_id=data.role_id
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"Создан пользователь: {new_user.login}")
    return {"message": "Пользователь успешно создан", "пользователь": {"id": new_user.id, "login": new_user.login, "role": new_user.role.name}}

@router.put("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):

    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if current_user.role.name == "superadmin":
        pass

    elif current_user.role.name == "admin":
        if target_user.role.name == "superadmin":
            raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")

    elif current_user.id == user_id:
        pass

    else:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")

    if data.login is not None:
        target_user.login = data.login
    if data.password is not None:
        target_user.password = hash_password(data.password)
    if data.role_id is not None:
        target_user.role_id = data.role_id

    db.commit()
    db.refresh(target_user)

    return {
        "message": "Пользователь успешно обновлен",
        "пользователь": {
            "id": target_user.id,
            "login": target_user.login,
            "role": target_user.role.name
        }
    }

@router.delete("/users/{user_id}")
def delete_user(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.id == user_id:
        raise HTTPException(status_code=403, detail="Нельзя удалить самого себя")
    
    if current_user.role.name == "superadmin":
        pass
    elif current_user.role.name == "admin":
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if target_user.role.name == "superadmin":
            raise HTTPException(status_code=403, detail="Нельзя удалять суперадмина")
    else:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    db.delete(target_user)
    db.commit()
    
    return {"message": "Пользователь успешно удален"}

