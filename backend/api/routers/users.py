from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_current_user, get_db
from schemas.user import UserCreate
from core.security import hash_password
from models.user import User
from pydantic import BaseModel

class UserUpdate(BaseModel):
    login: str = None
    password: str = None
    role: str = None

class UserResponse(BaseModel):
    id: int
    login: str
    role: str

    class Config:
        orm_mode = True

router = APIRouter(prefix="/api")

@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users")
def get_users(user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    users = db.query(User).all()
    return [{"id": user.id, "login": user.login, "role": user.role} for user in users]

@router.post("/users")
def create_user(data: UserCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    print(f"Создан пользователь: {data.login}")
    
    existing_user = db.query(User).filter(User.login == data.login).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Такой пользователь уже существует")

    new_user = User(
        login=data.login,
        password=hash_password(data.password),
        role=data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"Создан пользователь: {new_user.login}")
    return {"message": "Пользователь успешно создан", "пользователь": {"id": new_user.id, "login": new_user.login, "role": new_user.role}}

@router.put("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "superadmin":
        pass
    elif current_user.role == "admin":
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if target_user.role not in ["teacher", "admin"] or target_user.id != current_user.id:
            raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    elif current_user.id == user_id:
        pass
    else:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    if data.login is not None:
        target_user.login = data.login
    if data.password is not None:
        target_user.password = hash_password(data.password)
    if data.role is not None:
        target_user.role = data.role
    
    db.commit()
    db.refresh(target_user)
    
    return {"message": "Пользователь успешно обновлен", "пользователь": {"id": target_user.id, "login": target_user.login, "role": target_user.role}}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.id == user_id:
        raise HTTPException(status_code=403, detail="Нельзя удалить самого себя")
    
    if current_user.role == "superadmin":
        pass
    elif current_user.role == "admin":
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")
        if target_user.role == "superadmin":
            raise HTTPException(status_code=403, detail="Нельзя удалять суперадмина")
    else:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    db.delete(target_user)
    db.commit()
    
    return {"message": "Пользователь успешно удален"}

