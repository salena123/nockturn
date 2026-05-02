from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin, require_staff
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.lesson import Lesson
from models.lessonStudent import LessonStudent
from models.role import Role
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.teacher import Teacher
from models.user import User

router = APIRouter(prefix="/api/teachers")


def serialize_teacher_with_details(
    teacher: Teacher,
    include_schedule: bool = False,
    db: Session | None = None,
) -> dict:
    result = {
        "id": teacher.id,
        "user_id": teacher.user_id,
        "bio": teacher.bio,
        "experience_years": teacher.experience_years,
        "specialization": teacher.specialization,
        "created_at": teacher.created_at,
        "updated_at": teacher.updated_at,
        "user": {
            "id": teacher.user.id,
            "login": teacher.user.login,
            "full_name": teacher.user.full_name,
            "phone": teacher.user.phone,
            "is_active": teacher.user.is_active,
            "hire_date": teacher.user.hire_date,
            "created_at": teacher.user.created_at,
            "consent_received": teacher.user.consent_received,
            "consent_received_at": teacher.user.consent_received_at,
        }
        if teacher.user
        else None,
    }

    if include_schedule and db:
        start_date = datetime.now()
        end_date = start_date + timedelta(days=7)

        lessons = (
            db.query(ScheduleEvent)
            .filter(ScheduleEvent.teacher_id == teacher.id)
            .filter(ScheduleEvent.start_time >= start_date)
            .filter(ScheduleEvent.start_time <= end_date)
            .order_by(ScheduleEvent.start_time)
            .all()
        )

        result["upcoming_lessons"] = [
            {
                "id": lesson.id,
                "start_time": lesson.start_time,
                "end_time": lesson.end_time,
                "type": lesson.type,
                "discipline": lesson.discipline.name if lesson.discipline else None,
                "room": lesson.room.name if lesson.room else None,
            }
            for lesson in lessons
        ]

        total_lessons = (
            db.query(ScheduleEvent)
            .filter(ScheduleEvent.teacher_id == teacher.id)
            .count()
        )

        result["statistics"] = {
            "total_lessons": total_lessons,
            "upcoming_lessons_count": len(lessons),
        }

    return result


def get_teacher_or_404(db: Session, teacher_id: int) -> Teacher:
    teacher = (
        db.query(Teacher)
        .options(joinedload(Teacher.user).joinedload(User.role))
        .filter(Teacher.id == teacher_id)
        .first()
    )
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    return teacher


@router.get("/")
def get_teachers(
    include_schedule: bool = False,
    is_active: bool | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_staff(current_user)

    teachers = (
        db.query(Teacher)
        .options(joinedload(Teacher.user).joinedload(User.role))
        .join(User)
        .join(Role)
        .filter(Role.name == "teacher")
        .all()
    )

    if is_active is not None:
        teachers = [
            teacher
            for teacher in teachers
            if bool(getattr(teacher.user, "is_active", False)) == is_active
        ]

    if search:
        search_term = search.strip().lower()
        teachers = [
            teacher
            for teacher in teachers
            if search_term in (teacher.user.full_name or "").lower()
            or search_term in (teacher.specialization or "").lower()
            or search_term in (teacher.user.login or "").lower()
        ]

    teachers.sort(
        key=lambda teacher: (
            (teacher.user.full_name or "").lower(),
            (teacher.user.login or "").lower(),
            teacher.id,
        )
    )

    return [
        serialize_teacher_with_details(teacher, include_schedule, db)
        for teacher in teachers
    ]


@router.get("/{teacher_id}")
def get_teacher(
    teacher_id: int,
    include_schedule: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_staff(current_user)
    teacher = get_teacher_or_404(db, teacher_id)
    return serialize_teacher_with_details(teacher, include_schedule, db)


@router.post("/")
def create_teacher(
    teacher_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    teacher_role = db.query(Role).filter(Role.name == "teacher").first()
    if not teacher_role:
        raise HTTPException(status_code=404, detail="Роль преподавателя не найдена")

    user = db.query(User).filter(User.id == teacher_data["user_id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    existing_teacher = db.query(Teacher).filter(Teacher.user_id == teacher_data["user_id"]).first()
    if existing_teacher:
        raise HTTPException(status_code=400, detail="Пользователь уже является преподавателем")

    user.role_id = teacher_role.id

    new_teacher = Teacher(
        user_id=teacher_data["user_id"],
        bio=teacher_data.get("bio"),
        experience_years=teacher_data.get("experience_years"),
        specialization=teacher_data.get("specialization"),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(new_teacher)
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="teacher",
        entity_id=new_teacher.id,
        action="create",
        new_value={
            "user_id": new_teacher.user_id,
            "bio": new_teacher.bio,
            "experience_years": new_teacher.experience_years,
            "specialization": new_teacher.specialization,
        },
    )
    db.commit()
    return serialize_teacher_with_details(get_teacher_or_404(db, new_teacher.id), False, db)


@router.put("/{teacher_id}")
def update_teacher(
    teacher_id: int,
    teacher_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    teacher = get_teacher_or_404(db, teacher_id)

    changes: dict[str, tuple[object, object]] = {}
    if "bio" in teacher_data:
        changes["bio"] = (teacher.bio, teacher_data["bio"])
        teacher.bio = teacher_data["bio"]
    if "experience_years" in teacher_data:
        changes["experience_years"] = (teacher.experience_years, teacher_data["experience_years"])
        teacher.experience_years = teacher_data["experience_years"]
    if "specialization" in teacher_data:
        changes["specialization"] = (teacher.specialization, teacher_data["specialization"])
        teacher.specialization = teacher_data["specialization"]

    teacher.updated_at = datetime.utcnow()
    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="teacher",
        entity_id=teacher.id,
        changes=changes,
    )
    db.commit()
    return serialize_teacher_with_details(get_teacher_or_404(db, teacher.id), False, db)


@router.delete("/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    teacher = get_teacher_or_404(db, teacher_id)

    upcoming_lessons = (
        db.query(ScheduleEvent)
        .filter(ScheduleEvent.teacher_id == teacher_id)
        .filter(ScheduleEvent.start_time >= datetime.now())
        .count()
    )
    if upcoming_lessons > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя удалить преподавателя с предстоящими занятиями ({upcoming_lessons} занятий)",
        )

    user = teacher.user
    default_role = db.query(Role).filter(Role.name == "user").first()
    if default_role and user:
        user.role_id = default_role.id

    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="teacher",
        entity_id=teacher.id,
        action="delete",
        old_value={
            "user_id": teacher.user_id,
            "bio": teacher.bio,
            "experience_years": teacher.experience_years,
            "specialization": teacher.specialization,
        },
    )
    db.delete(teacher)
    db.commit()

    return {"message": "Преподаватель успешно удален"}


@router.get("/{teacher_id}/schedule")
def get_teacher_schedule(
    teacher_id: int,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_staff(current_user)
    get_teacher_or_404(db, teacher_id)

    query = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room),
            joinedload(ScheduleEvent.lessons)
            .joinedload(Lesson.lesson_students)
            .joinedload(LessonStudent.student),
        )
        .filter(ScheduleEvent.teacher_id == teacher_id)
    )

    if start_date:
        query = query.filter(ScheduleEvent.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(ScheduleEvent.end_time <= datetime.fromisoformat(end_date))

    events = query.order_by(ScheduleEvent.start_time).all()
    result = []
    for event in events:
        lesson_data = None
        if event.lessons:
            lesson = event.lessons[0]
            lesson_data = {
                "id": lesson.id,
                "lesson_type": lesson.lesson_type,
                "max_students": lesson.max_students,
                "students": [
                    {"id": link.student.id, "name": link.student.fio}
                    for link in lesson.lesson_students
                    if link.student
                ],
            }

        result.append(
            {
                "id": event.id,
                "start_time": event.start_time,
                "end_time": event.end_time,
                "type": event.type,
                "discipline": {
                    "id": event.discipline.id,
                    "name": event.discipline.name,
                }
                if event.discipline
                else None,
                "room": {"id": event.room.id, "name": event.room.name} if event.room else None,
                "lesson": lesson_data,
            }
        )

    return result
