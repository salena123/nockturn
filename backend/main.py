from fastapi import FastAPI
from api.routers import students

app = FastAPI()

app.include_router(students.router)
