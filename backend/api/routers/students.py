from fastapi import Depends, APIRouter
from schemas.student import StudentCreate
from core.deps import get_current_user

router = APIRouter(prefix="/api")

fake_db = []

@router.post("/students")
def create_student(data: StudentCreate):
    student = data.dict()
    student["id"] = len(fake_db) + 1
    fake_db.append(student)
    return student

@router.get("/students")
def get_students(user=Depends(get_current_user)):
    return fake_db

@router.get("/students/{id}")
def get_student(student_id: int):
    for student in fake_db:
        if student[id] == student_id:
            return student
    return {"error": "ученик не найден"}
    
@router.put("/students/{student_id}")
def update_student(student_id: int, data: StudentCreate):
    for student in fake_db:
        if student["id"] == student_id:
            student.update(data.dict())
            return student
    return {"error": "ученик не найден"}

@router.delete("/students/{student_id}")
def delete_student(student_id: int):
    for i, student in enumerate(fake_db):
        if student["id"] == student_id:
            deleted = fake_db.pop(i)
            return deleted
    return {"error": "ученик не найден"}