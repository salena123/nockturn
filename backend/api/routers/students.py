from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin, require_staff
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.entityChangeLog import EntityChangeLog
from models.lesson import Lesson
from models.lessonStudent import LessonStudent
from models.parent import Parent
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.subscription import Subscription
from models.teacher import Teacher
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


def is_teacher_user(user: User) -> bool:
    return getattr(getattr(user, "role", None), "name", None) == "teacher"


def get_teacher_for_current_user(db: Session, current_user: User) -> Teacher | None:
    if not is_teacher_user(current_user):
        return None

    return db.query(Teacher).filter(Teacher.user_id == current_user.id).first()


def apply_teacher_student_scope(query, teacher: Teacher | None):
    if teacher is None:
        return query

    return (
        query.join(Student.lesson_students)
        .join(LessonStudent.lesson)
        .join(Lesson.schedule)
        .filter(ScheduleEvent.teacher_id == teacher.id)
        .distinct()
    )


def validate_student_payload(data: StudentCreate | StudentUpdate, is_create: bool = False) -> None:
    if getattr(data, "level", None) is not None:
        normalized_level = data.level.strip().lower() if data.level else None
        data.level = normalized_level
        if normalized_level not in ALLOWED_LEVELS:
            raise HTTPException(
                status_code=400,
                detail=f"Некорректный уровень подготовки. Допустимые значения: {', '.join(sorted(ALLOWED_LEVELS))}",
            )

    if getattr(data, "status", None) is not None:
        normalized_status = data.status.strip().lower() if data.status else None
        data.status = normalized_status
        if normalized_status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Некорректный статус ученика. Допустимые значения: {', '.join(sorted(ALLOWED_STATUSES))}",
            )

    if is_create and not (data.phone or data.parent_phone):
        raise HTTPException(status_code=400, detail="Нужно указать основной номер телефона")

    age = get_age(getattr(data, "birth_date", None))
    if age is not None and age < 18:
        if not getattr(data, "has_parent", False):
            raise HTTPException(
                status_code=400,
                detail="Для несовершеннолетнего ученика нужно указать ответственное лицо",
            )
        if not getattr(data, "parent_name", None):
            raise HTTPException(
                status_code=400,
                detail="Для несовершеннолетнего ученика нужно указать ФИО ответственного лица",
            )


def get_or_create_parent(
    db: Session,
    name: str,
    phone: str | None,
    telegram_id: int | None = None,
) -> Parent:
    if not name:
        raise HTTPException(status_code=400, detail="Нужно указать ФИО ответственного лица")

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


def ensure_student_access(db: Session, current_user: User, student_id: int) -> Student:
    student = get_student_or_404(db, student_id)
    teacher = get_teacher_for_current_user(db, current_user)

    if teacher is None:
        return student

    is_accessible = (
        db.query(LessonStudent.id)
        .join(LessonStudent.lesson)
        .join(Lesson.schedule)
        .filter(LessonStudent.student_id == student_id)
        .filter(ScheduleEvent.teacher_id == teacher.id)
        .first()
    )

    if not is_accessible:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому ученику")

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
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student",
        entity_id=new_student.id,
        action="create",
        new_value={
            "fio": new_student.fio,
            "phone": new_student.phone,
            "email": new_student.email,
            "has_parent": new_student.has_parent,
            "parent_id": new_student.parent_id,
            "parent_name": new_student.parent_name,
            "address": new_student.address,
            "level": new_student.level,
            "status": new_student.status,
            "comment": new_student.comment,
            "first_contact_date": new_student.first_contact_date,
            "birth_date": new_student.birth_date,
        },
    )
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
    require_staff(current_user)

    query = db.query(Student).options(joinedload(Student.parent))
    query = apply_teacher_student_scope(query, get_teacher_for_current_user(db, current_user))

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
    require_staff(current_user)
    return serialize_student(ensure_student_access(db, current_user, student_id))


@router.get("/students/{student_id}/history")
def get_student_history(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_student_access(db, current_user, student_id)
    return (
        db.query(EntityChangeLog)
        .filter(EntityChangeLog.entity == "student")
        .filter(EntityChangeLog.entity_id == student_id)
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )


@router.get("/students/{student_id}/subscriptions", response_model=list[SubscriptionResponse])
def get_student_subscriptions(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_student_access(db, current_user, student_id)

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
    changes: dict[str, tuple[object, object]] = {}

    if data.fio is not None:
        changes["fio"] = (student.fio, data.fio)
        student.fio = data.fio
    if data.phone is not None:
        changes["phone"] = (student.phone, data.phone)
        student.phone = data.phone
    if data.email is not None:
        changes["email"] = (student.email, data.email)
        student.email = data.email
    if data.address is not None:
        changes["address"] = (student.address, data.address)
        student.address = data.address
    if data.level is not None:
        changes["level"] = (student.level, data.level)
        student.level = data.level
    if data.status is not None:
        changes["status"] = (student.status, data.status)
        student.status = data.status
    if data.comment is not None:
        changes["comment"] = (student.comment, data.comment)
        student.comment = data.comment
    if data.first_contact_date is not None:
        changes["first_contact_date"] = (student.first_contact_date, data.first_contact_date)
        student.first_contact_date = data.first_contact_date
    if data.birth_date is not None:
        changes["birth_date"] = (student.birth_date, data.birth_date)
        student.birth_date = data.birth_date

    if data.has_parent is not None:
        changes["has_parent"] = (student.has_parent, data.has_parent)
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
            raise HTTPException(status_code=400, detail="Нужно указать ФИО ответственного лица")

        if student.parent_id:
            existing_parent = db.query(Parent).filter(Parent.id == student.parent_id).first()
            if existing_parent:
                changes["parent_name"] = (student.parent_name, parent_name)
                changes["parent_phone"] = (existing_parent.phone, parent_phone)
                existing_parent.full_name = parent_name
                existing_parent.phone = parent_phone
                if data.parent_telegram_id is not None:
                    existing_parent.telegram_id = data.parent_telegram_id
                student.parent_name = existing_parent.full_name
            else:
                parent = get_or_create_parent(db, parent_name, parent_phone, parent_telegram_id)
                changes["parent_id"] = (student.parent_id, parent.id)
                changes["parent_name"] = (student.parent_name, parent.full_name)
                student.parent_id = parent.id
                student.parent_name = parent.full_name
        else:
            parent = get_or_create_parent(db, parent_name, parent_phone, parent_telegram_id)
            changes["parent_id"] = (student.parent_id, parent.id)
            changes["parent_name"] = (student.parent_name, parent.full_name)
            student.parent_id = parent.id
            student.parent_name = parent.full_name

        if data.phone is None and parent_phone and not student.phone:
            changes["phone"] = (student.phone, parent_phone)
            student.phone = parent_phone
    else:
        changes["parent_id"] = (student.parent_id, None)
        changes["parent_name"] = (student.parent_name, None)
        student.parent_id = None
        student.parent_name = None

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="student",
        entity_id=student.id,
        changes=changes,
    )
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
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student",
        entity_id=student.id,
        action="delete",
        old_value={
            "fio": student.fio,
            "phone": student.phone,
            "email": student.email,
            "parent_id": student.parent_id,
            "parent_name": student.parent_name,
            "status": student.status,
        },
    )
    db.delete(student)
    db.commit()

    return {"message": "Ученик успешно удален"}
