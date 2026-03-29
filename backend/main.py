from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import students, users, auth
from db.session import engine
from models.user import Base

Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(users.router)
app.include_router(auth.router)