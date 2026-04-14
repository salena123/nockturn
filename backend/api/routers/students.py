from datetime import date

from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session
from schemas.student import StudentCreate, StudentResponse
from core.deps import get_current_user, get_db
from models.student import Student
from pydantic import BaseModel
from typing import Optional

class StudentUpdate(BaseModel):
    fio: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    has_parent: Optional[bool] = None
    parent_id: Optional[int] = None
    parent_name: Optional[str] = None
    address: Optional[str] = None
    level: Optional[str] = None
    status: Optional[str] = None
    comment: Optional[str] = None
    first_contact_date: Optional[date] = None
    birth_date: Optional[date] = None

router = APIRouter(prefix="/api")

@router.post("/students", response_model=StudentResponse)
def create_student(data: StudentCreate, user=Depends(get_current_user), db: Session = Depends(get_db)):
    parent_id = data.parent_id
    parent_name = data.parent_name
    if not data.has_parent:
        parent_id = None
        parent_name = None
    
    new_student = Student(
        fio=data.fio,
        phone=data.phone,
        email=data.email,
        has_parent=data.has_parent,
        parent_id=parent_id,
        parent_name=parent_name,
        address=data.address,
        level=data.level,
        status=data.status,
        comment=data.comment,
        first_contact_date=data.first_contact_date,
        birth_date=data.birth_date
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
    if data.address is not None:
        student.address = data.address
    if data.level is not None:
        student.level = data.level
    if data.status is not None:
        student.status = data.status
    if data.comment is not None:
        student.comment = data.comment
    if data.first_contact_date is not None:
        student.first_contact_date = data.first_contact_date
    if data.birth_date is not None:
        student.birth_date = data.birth_date

    if data.has_parent is not None:
        student.has_parent = data.has_parent

    has_parent = student.has_parent

    if not has_parent:
        student.parent_id = None
        student.parent_name = None
    else:
        if data.parent_id is not None:
            student.parent_id = data.parent_id
        if data.parent_name is not None:
            student.parent_name = data.parent_name

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