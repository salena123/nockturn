from fastapi import FastAPI
from api.routers import students

app = FastAPI()

app.include_router(students.router)

@app.get("/")
def students():
    return {"students": "student1"}