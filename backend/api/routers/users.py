from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_current_user, get_db
from schemas.user import UserCreate
from core.security import hash_password
from models.user import User

router = APIRouter(prefix="/api")

@router.get("/users")
def get_users(user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    users = db.query(User).all()
    return [{"id": user.id, "email": user.email, "role": user.role} for user in users]

@router.post("/users")
def create_user(data: UserCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    if user.role not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")
    
    print(f"Создан пользователь: {data.email}")
    
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Такой пользователь уже существует")

    new_user = User(
        email=data.email,
        password=hash_password(data.password),
        role=data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"Создан пользователь: {new_user.email}")
    return {"message": "Пользователь успешно создан", "пользователь": {"id": new_user.id, "email": new_user.email, "role": new_user.role}}

