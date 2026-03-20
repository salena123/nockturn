from fastapi import FastAPI
from api.routers import students, users, auth

app = FastAPI()

app.include_router(students.router)
app.include_router(users.router)
app.include_router(auth.router)