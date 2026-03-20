from fastapi import APIRouter
from schemas.user import UserLogin
from core.security import verify_password, create_access_token
from api.routers.users import users_db

router = APIRouter(prefix="/api/auth")

@router.post("/login")
def login(data: UserLogin):
    for user in users_db:
        if user["email"] == data.email:
            if verify_password(data.password, user["password"]):
                
                token = create_access_token({
                    "sub": user["email"],
                    "role": user["role"]
                })

                return {"access_token": token, "token_type": "bearer"}

    return {"error": "Invalid credentials"}