from datetime import date
from typing import Optional, List, Dict
from models.parent import Parent
from models.user import User
from fastapi import Depends, APIRouter, HTTPException
from sqlalchemy.orm import Session, joinedload
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
from core.deps import get_current_user, get_db
from models.student import Student

router = APIRouter(prefix="/api")

def get_or_create_parent(db: Session, name: str, phone: str, telegram_id: Optional[int] = None) -> Parent:
    if not name:
        raise HTTPException(status_code=400, detail="имя родителя обязательно")
    
    parent = None
    
    # Ищем родителя по telegram_id если он есть
    if telegram_id:
        parent = db.query(Parent).filter(
            Parent.telegram_id == telegram_id
        ).first()
    
    # Если не нашли по telegram_id, ищем по имени и телефону
    if not parent:
        parent = db.query(Parent).filter(
            Parent.full_name == name,
            Parent.phone == phone
        ).first()
    
    # Если все равно не нашли, создаем нового
    if not parent:
        parent = Parent(
            full_name=name,
            phone=phone,
            telegram_id=telegram_id
        )
        db.add(parent)
        db.flush()

    return parent

@router.post("/students", response_model=StudentResponse)
def create_student(data: StudentCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StudentResponse:
    try:
        parent = None

        if data.has_parent:
            parent = get_or_create_parent(
                db,
                data.parent_name,
                data.parent_phone,
                data.parent_telegram_id
            )

        new_student = Student(
            fio=data.fio,
            phone=data.phone,
            email=data.email,
            has_parent=data.has_parent,
            parent_id=parent.id if parent else None,
            parent_name=parent.full_name if parent else None,
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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating student: {str(e)}")

@router.get("/students", response_model=list[StudentResponse])
def get_students(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[StudentResponse]:
    students = db.query(Student).options(joinedload(Student.parent)).all()
    return students

@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StudentResponse:
    student = db.query(Student).options(joinedload(Student.parent)).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student
    
@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student(student_id: int, data: StudentUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> StudentResponse:
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Ученик не найден")

        for field in [ "fio", "phone", "email", "address", "level", "status", "comment", "first_contact_date", "birth_date" ]:
            value = getattr(data, field)
            if value is not None:
                setattr(student, field, value)

        if data.has_parent is not None:
            student.has_parent = data.has_parent

        has_parent = student.has_parent

        if has_parent:
            # Если у студента уже есть родитель, обновляем его данные
            if student.parent_id:
                existing_parent = db.query(Parent).filter(Parent.id == student.parent_id).first()
                if existing_parent:
                    existing_parent.full_name = data.parent_name or existing_parent.full_name
                    existing_parent.phone = data.parent_phone or existing_parent.phone
                    if data.parent_telegram_id:
                        existing_parent.telegram_id = data.parent_telegram_id
                    student.parent_name = existing_parent.full_name
                else:
                    # Если родитель не найден по ID, ищем/создаем по данным
                    parent = get_or_create_parent(
                        db,
                        data.parent_name,
                        data.parent_phone,
                        data.parent_telegram_id
                    )
                    student.parent_id = parent.id
                    student.parent_name = parent.full_name
            else:
                # Если родителя не было, ищем/создаем нового
                parent = get_or_create_parent(
                    db,
                    data.parent_name,
                    data.parent_phone,
                    data.parent_telegram_id
                )
                student.parent_id = parent.id
                student.parent_name = parent.full_name
        else:
            student.parent_id = None
            student.parent_name = None

        db.commit()
        db.refresh(student)
        return student
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating student: {str(e)}")

@router.delete("/students/{student_id}")
def delete_student(student_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Dict[str, str]:
    try:
        student = db.query(Student).filter(Student.id == student_id).first()
        if not student:
            raise HTTPException(status_code=404, detail="Ученик не найден")
        
        db.delete(student)
        db.commit()
        return {"message": "Ученик успешно удален"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting student: {str(e)}")