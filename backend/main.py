from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routers import attendance, auth, payments, students, subscriptions, users, schedule, disciplines, rooms, tariffs, discounts
from db.session import engine
from models import Base


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
app.include_router(subscriptions.router)
app.include_router(payments.router)
app.include_router(attendance.router)
app.include_router(auth.router)
app.include_router(schedule.router)
app.include_router(disciplines.router)
app.include_router(rooms.router)
app.include_router(tariffs.router)
app.include_router(discounts.router)
