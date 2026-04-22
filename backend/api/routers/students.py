from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from core.access import require_admin
from core.deps import get_current_user, get_db
from models.parent import Parent
from models.student import Student
from models.subscription import Subscription
from models.user import User
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
from schemas.subscription import SubscriptionResponse


router = APIRouter(prefix="/api")

ALLOWED_LEVELS = {"начальный", "средний", "продвинутый"}
ALLOWED_STATUSES = {"потенциальный", "активный", "заморожен", "отказался"}


def get_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None

    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def validate_student_payload(data: StudentCreate | StudentUpdate, is_create: bool = False) -> None:
    if getattr(data, "level", None) is not None and data.level not in ALLOWED_LEVELS:
        raise HTTPException(status_code=400, detail="Некорректный уровень подготовки")

    if getattr(data, "status", None) is not None and data.status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Некорректный статус клиента")

    if is_create and not (data.phone or data.parent_phone):
        raise HTTPException(status_code=400, detail="Необходимо указать основной номер телефона")

    age = get_age(getattr(data, "birth_date", None))
    if age is not None and age < 18:
        if not getattr(data, "has_parent", False):
            raise HTTPException(
                status_code=400,
                detail="Для несовершеннолетнего ученика нужно указать ответственного",
            )
        if not getattr(data, "parent_name", None):
            raise HTTPException(
                status_code=400,
                detail="Для несовершеннолетнего ученика нужно указать ФИО ответственного",
            )


def get_or_create_parent(
    db: Session,
    name: str,
    phone: str | None,
    telegram_id: int | None = None,
) -> Parent:
    if not name:
        raise HTTPException(status_code=400, detail="Имя родителя обязательно")

    parent = None

    if telegram_id is not None:
        parent = db.query(Parent).filter(Parent.telegram_id == telegram_id).first()

    if not parent:
        query = db.query(Parent).filter(Parent.full_name == name)
        if phone is None:
            query = query.filter(Parent.phone.is_(None))
        else:
            query = query.filter(Parent.phone == phone)
        parent = query.first()

    if not parent:
        parent = Parent(full_name=name, phone=phone, telegram_id=telegram_id)
        db.add(parent)
        db.flush()

    return parent


def serialize_student(student: Student) -> StudentResponse:
    parent = None
    if student.parent:
        parent = {
            "id": student.parent.id,
            "full_name": student.parent.full_name,
            "phone": student.parent.phone,
            "email": student.parent.email,
            "telegram_id": student.parent.telegram_id,
        }

    return StudentResponse(
        id=student.id,
        fio=student.fio,
        phone=student.phone,
        email=student.email,
        has_parent=bool(student.has_parent),
        parent_id=student.parent_id,
        parent_name=student.parent_name,
        parent=parent,
        address=student.address,
        level=student.level,
        status=student.status,
        comment=student.comment,
        first_contact_date=student.first_contact_date,
        birth_date=student.birth_date,
        age=get_age(student.birth_date),
    )


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = (
        db.query(Student)
        .options(joinedload(Student.parent))
        .filter(Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


@router.post("/students", response_model=StudentResponse)
def create_student(
    data: StudentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    validate_student_payload(data, is_create=True)

    parent = None
    status = data.status or "потенциальный"

    if data.has_parent:
        parent = get_or_create_parent(
            db,
            data.parent_name,
            data.parent_phone,
            data.parent_telegram_id,
        )

    new_student = Student(
        fio=data.fio,
        phone=data.phone or data.parent_phone,
        email=data.email,
        has_parent=data.has_parent,
        parent_id=parent.id if parent else None,
        parent_name=parent.full_name if parent else None,
        address=data.address,
        level=data.level,
        status=status,
        comment=data.comment,
        first_contact_date=data.first_contact_date,
        birth_date=data.birth_date,
    )

    db.add(new_student)
    db.commit()
    db.refresh(new_student)
    return serialize_student(get_student_or_404(db, new_student.id))


@router.get("/students", response_model=list[StudentResponse])
def get_students(
    status: str | None = None,
    level: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    query = db.query(Student).options(joinedload(Student.parent))

    if status is not None:
        query = query.filter(Student.status == status)
    if level is not None:
        query = query.filter(Student.level == level)

    students = query.order_by(Student.created_at.desc(), Student.id.desc()).all()
    return [serialize_student(student) for student in students]


@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return serialize_student(get_student_or_404(db, student_id))


@router.get("/students/{student_id}/subscriptions", response_model=list[SubscriptionResponse])
def get_student_subscriptions(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_student_or_404(db, student_id)

    subscriptions = (
        db.query(Subscription)
        .filter(Subscription.student_id == student_id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
        .all()
    )

    return subscriptions


@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    data: StudentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    validate_student_payload(data, is_create=False)

    student = get_student_or_404(db, student_id)

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

    if student.has_parent:
        parent_name = data.parent_name or student.parent_name
        parent_phone = data.parent_phone or (student.parent.phone if student.parent else student.phone)
        parent_telegram_id = (
            data.parent_telegram_id
            if data.parent_telegram_id is not None
            else (student.parent.telegram_id if student.parent else None)
        )

        if not parent_name:
            raise HTTPException(
                status_code=400,
                detail="Для ученика с ответственным лицом нужно указать ФИО родителя",
            )

        if student.parent_id:
            existing_parent = db.query(Parent).filter(Parent.id == student.parent_id).first()
            if existing_parent:
                existing_parent.full_name = parent_name
                existing_parent.phone = parent_phone
                if data.parent_telegram_id is not None:
                    existing_parent.telegram_id = data.parent_telegram_id
                student.parent_name = existing_parent.full_name
            else:
                parent = get_or_create_parent(db, parent_name, parent_phone, parent_telegram_id)
                student.parent_id = parent.id
                student.parent_name = parent.full_name
        else:
            parent = get_or_create_parent(db, parent_name, parent_phone, parent_telegram_id)
            student.parent_id = parent.id
            student.parent_name = parent.full_name

        if data.phone is None and parent_phone and not student.phone:
            student.phone = parent_phone
    else:
        student.parent_id = None
        student.parent_name = None

    db.commit()
    db.refresh(student)
    return serialize_student(get_student_or_404(db, student.id))


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    student = get_student_or_404(db, student_id)
    db.delete(student)
    db.commit()

    return {"message": "Ученик успешно удален"}
