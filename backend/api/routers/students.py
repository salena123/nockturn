from fastapi import APIRouter
from schemas.students import StudentCreate

router = APIRouter()

fake_db = []

@router.post("/students")
def create_student(data: StudentCreate):
    student = data.dict()
    student["id"] = len(fake_db) + 1
    fake_db.append(student)
    return student

@router.get("/students")
def get_stidents():
    return fake_db

@router.get("students/{id}")
def get_students(student_id: int):
    for student in fake_db:
        if student[student_id] == id:
            return student
        return {"error": "ученик не найден"}
    
@router.put("/students/{student_id}")
def update_student(student_id: int, data: StudentCreate):
    for student in fake_db:
        if student["id"] == student_id:
            student.update(data.dict())
            return student
    return {"error": "Student not found"}

@router.delete("/students/{student_id}")
def delete_student(student_id: int):
    for i, student in enumerate(fake_db):
        if student["id"] == student_id:
            deleted = fake_db.pop(i)
            return deleted
    return {"error": "Student not found"}