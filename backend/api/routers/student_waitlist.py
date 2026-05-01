from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin, require_staff
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.discipline import Discipline
from models.entityChangeLog import EntityChangeLog
from models.student import Student
from models.studentWaitlist import StudentWaitlist
from models.teacher import Teacher
from models.user import User
from schemas.student_waitlist import (
    StudentWaitlistCreate,
    StudentWaitlistResponse,
    StudentWaitlistUpdate,
)


router = APIRouter(prefix="/api")


def get_actor_display_name(actor_user: User | None) -> str | None:
    if actor_user is None:
        return None
    return actor_user.full_name or actor_user.login


def serialize_history_item(item: EntityChangeLog) -> dict:
    return {
        "id": item.id,
        "actor_user_id": item.actor_user_id,
        "ip_address": item.ip_address,
        "actor_user_name": get_actor_display_name(item.actor_user),
        "entity": item.entity,
        "entity_id": item.entity_id,
        "field_name": item.field_name,
        "old_value": item.old_value,
        "new_value": item.new_value,
        "action": item.action,
        "created_at": item.created_at,
    }


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def get_teacher_or_404(db: Session, teacher_id: int) -> Teacher:
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    return teacher


def get_discipline_or_404(db: Session, discipline_id: int) -> Discipline:
    discipline = db.query(Discipline).filter(Discipline.id == discipline_id).first()
    if not discipline:
        raise HTTPException(status_code=404, detail="Дисциплина не найдена")
    return discipline


def get_waitlist_entry_or_404(db: Session, entry_id: int) -> StudentWaitlist:
    entry = db.query(StudentWaitlist).filter(StudentWaitlist.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Запись листа ожидания не найдена")
    return entry


@router.get("/waitlist", response_model=list[StudentWaitlistResponse])
def get_waitlist(
    student_id: int | None = None,
    teacher_id: int | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    query = db.query(StudentWaitlist)
    if student_id is not None:
        query = query.filter(StudentWaitlist.student_id == student_id)
    if teacher_id is not None:
        query = query.filter(StudentWaitlist.teacher_id == teacher_id)
    if status is not None:
        query = query.filter(StudentWaitlist.status == status)
    return query.order_by(StudentWaitlist.created_at.desc(), StudentWaitlist.id.desc()).all()


@router.post("/waitlist", response_model=StudentWaitlistResponse)
def create_waitlist_entry(
    data: StudentWaitlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_student_or_404(db, data.student_id)
    if data.teacher_id is not None:
        get_teacher_or_404(db, data.teacher_id)
    if data.discipline_id is not None:
        get_discipline_or_404(db, data.discipline_id)

    entry = StudentWaitlist(**data.model_dump())
    db.add(entry)
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student_waitlist",
        entity_id=entry.id,
        action="create",
        new_value=data.model_dump(),
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/waitlist/{entry_id}", response_model=StudentWaitlistResponse)
def update_waitlist_entry(
    entry_id: int,
    data: StudentWaitlistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    entry = get_waitlist_entry_or_404(db, entry_id)
    payload = data.model_dump(exclude_unset=True)

    if payload.get("teacher_id") is not None:
        get_teacher_or_404(db, payload["teacher_id"])
    if payload.get("discipline_id") is not None:
        get_discipline_or_404(db, payload["discipline_id"])

    changes: dict[str, tuple[object, object]] = {}
    for field, value in payload.items():
        changes[field] = (getattr(entry, field), value)
        setattr(entry, field, value)

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="student_waitlist",
        entity_id=entry.id,
        changes=changes,
    )
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/waitlist/{entry_id}")
def delete_waitlist_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    entry = get_waitlist_entry_or_404(db, entry_id)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student_waitlist",
        entity_id=entry.id,
        action="delete",
        old_value={
            "student_id": entry.student_id,
            "teacher_id": entry.teacher_id,
            "discipline_id": entry.discipline_id,
            "desired_schedule_text": entry.desired_schedule_text,
            "comment": entry.comment,
            "status": entry.status,
        },
    )
    db.delete(entry)
    db.commit()
    return {"message": "Запись листа ожидания успешно удалена"}


@router.get("/students/{student_id}/waitlist", response_model=list[StudentWaitlistResponse])
def get_student_waitlist(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    get_student_or_404(db, student_id)
    return (
        db.query(StudentWaitlist)
        .filter(StudentWaitlist.student_id == student_id)
        .order_by(StudentWaitlist.created_at.desc(), StudentWaitlist.id.desc())
        .all()
    )


@router.get("/students/{student_id}/waitlist/history")
def get_student_waitlist_history(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    get_student_or_404(db, student_id)
    entry_ids = [
        entry.id
        for entry in db.query(StudentWaitlist.id).filter(StudentWaitlist.student_id == student_id).all()
    ]
    if not entry_ids:
        return []

    history_items = (
        db.query(EntityChangeLog)
        .options(joinedload(EntityChangeLog.actor_user))
        .filter(EntityChangeLog.entity == "student_waitlist")
        .filter(EntityChangeLog.entity_id.in_(entry_ids))
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
    return [serialize_history_item(item) for item in history_items]
