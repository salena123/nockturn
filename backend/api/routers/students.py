from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from schemas.student import StudentCreate, StudentResponse
from core.deps import get_current_user, get_db
from models.student import Student
from pydantic import BaseModel

class StudentUpdate(BaseModel):
    fio: str = None
    phone: str = None
    email: str = None
    has_parent: bool = None
    parent_id: int = None

router = APIRouter(prefix="/api")

@router.post("/students", response_model=StudentResponse)
def create_student(data: StudentCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    new_student = Student(
        fio=data.fio,
        phone=data.phone,
        email=data.email,
        has_parent=data.has_parent,
        parent_id=data.parent_id
    )
    
    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    
    return new_student

@router.get("/students", response_model=list[StudentResponse])
def get_students(user=Depends(get_current_user), db: Session = Depends(get_db)):
    students = db.query(Student).all()
    return students

@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student
    
@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student(student_id: int, data: StudentUpdate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    
    if data.fio is not None:
        student.fio = data.fio
    if data.phone is not None:
        student.phone = data.phone
    if data.email is not None:
        student.email = data.email
    if data.has_parent is not None:
        student.has_parent = data.has_parent
    if data.parent_id is not None:
        student.parent_id = data.parent_id
    
    db.commit()
    db.refresh(student)
    return student

@router.delete("/students/{student_id}")
def delete_student(student_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    
    db.delete(student)
    db.commit()
    return {"message": "Ученик успешно удален"}