from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.deps import get_current_user, get_db
from models.lesson import Lesson
from models.lessonIssue import LessonIssue
from models.lessonStudent import LessonStudent
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.teacher import Teacher
from models.user import User
from schemas.schedule import (
    LessonCreate,
    LessonUpdate,
    LessonWithDetails,
    ScheduleEventCreate,
    ScheduleEventUpdate,
    ScheduleEventWithDetails,
)

router = APIRouter(prefix="/api/schedule")


def format_conflict_time(start_time: datetime, end_time: datetime) -> str:
    return f"{start_time.strftime('%d.%m.%Y %H:%M')} - {end_time.strftime('%H:%M')}"


def serialize_schedule_conflict(event: ScheduleEvent) -> dict:
    teacher_name = None
    if event.teacher and event.teacher.user:
        teacher_name = event.teacher.user.full_name or event.teacher.user.login

    return {
        "event_id": event.id,
        "time": format_conflict_time(event.start_time, event.end_time),
        "teacher_id": event.teacher_id,
        "teacher_name": teacher_name,
        "room_id": event.room_id,
        "room_name": event.room.name if event.room else None,
        "discipline_id": event.discipline_id,
        "discipline_name": event.discipline.name if event.discipline else None,
    }


def raise_detailed_conflict(
    message: str,
    *,
    teacher_conflicts: list[dict] | None = None,
    room_conflicts: list[dict] | None = None,
    student_conflicts: list[dict] | None = None,
) -> None:
    raise HTTPException(
        status_code=409,
        detail={
            "message": message,
            "teacher_conflicts": teacher_conflicts or [],
            "room_conflicts": room_conflicts or [],
            "student_conflicts": student_conflicts or [],
        },
    )


def build_schedule_conflicts(db: Session, event_data: dict, exclude_id: int | None = None) -> dict:
    query = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
            joinedload(ScheduleEvent.room),
            joinedload(ScheduleEvent.discipline),
        )
        .filter(ScheduleEvent.start_time < event_data["end_time"])
        .filter(ScheduleEvent.end_time > event_data["start_time"])
        .filter(
            (ScheduleEvent.teacher_id == event_data["teacher_id"]) |
            (ScheduleEvent.room_id == event_data["room_id"])
        )
    )

    if exclude_id is not None:
        query = query.filter(ScheduleEvent.id != exclude_id)

    conflicts = query.all()

    teacher_conflicts = [
        serialize_schedule_conflict(event)
        for event in conflicts
        if event.teacher_id == event_data["teacher_id"]
    ]
    room_conflicts = [
        serialize_schedule_conflict(event)
        for event in conflicts
        if event.room_id == event_data["room_id"]
    ]

    return {
        "teacher_conflicts": teacher_conflicts,
        "room_conflicts": room_conflicts,
    }


def raise_schedule_conflicts_if_needed(conflicts: dict) -> None:
    teacher_conflicts = conflicts["teacher_conflicts"]
    room_conflicts = conflicts["room_conflicts"]

    if not teacher_conflicts and not room_conflicts:
        return

    messages = []
    if teacher_conflicts:
        messages.append("Преподаватель уже занят в это время.")
    if room_conflicts:
        messages.append("Кабинет уже занят в это время.")

    raise_detailed_conflict(
        " ".join(messages) or "Обнаружены конфликты расписания.",
        teacher_conflicts=teacher_conflicts,
        room_conflicts=room_conflicts,
    )


def build_student_conflicts(
    db: Session,
    student_ids: list[int],
    start_time: datetime,
    end_time: datetime,
    exclude_lesson_id: int | None = None,
) -> list[dict]:
    if not student_ids:
        return []

    query = (
        db.query(LessonStudent)
        .options(
            joinedload(LessonStudent.student),
            joinedload(LessonStudent.lesson)
            .joinedload(Lesson.schedule)
            .joinedload(ScheduleEvent.teacher)
            .joinedload(Teacher.user),
            joinedload(LessonStudent.lesson)
            .joinedload(Lesson.schedule)
            .joinedload(ScheduleEvent.room),
            joinedload(LessonStudent.lesson)
            .joinedload(Lesson.schedule)
            .joinedload(ScheduleEvent.discipline),
        )
        .join(LessonStudent.lesson)
        .join(Lesson.schedule)
        .filter(LessonStudent.student_id.in_(student_ids))
        .filter(ScheduleEvent.start_time < end_time)
        .filter(ScheduleEvent.end_time > start_time)
    )

    if exclude_lesson_id is not None:
        query = query.filter(Lesson.id != exclude_lesson_id)

    conflicts = []
    seen = set()

    for row in query.all():
        schedule = row.lesson.schedule if row.lesson else None
        student = row.student
        if not schedule or not student:
            continue

        key = (student.id, schedule.id)
        if key in seen:
            continue
        seen.add(key)

        teacher_name = None
        if schedule.teacher and schedule.teacher.user:
            teacher_name = schedule.teacher.user.full_name or schedule.teacher.user.login

        conflicts.append(
            {
                "student_id": student.id,
                "student_name": student.fio,
                "lesson_id": row.lesson.id if row.lesson else None,
                "event_id": schedule.id,
                "time": format_conflict_time(schedule.start_time, schedule.end_time),
                "teacher_name": teacher_name,
                "room_name": schedule.room.name if schedule.room else None,
                "discipline_name": schedule.discipline.name if schedule.discipline else None,
            }
        )

    return conflicts


def raise_student_conflicts_if_needed(conflicts: list[dict]) -> None:
    if not conflicts:
        return

    raise_detailed_conflict(
        "У одного или нескольких учеников уже есть занятие в это время.",
        student_conflicts=conflicts,
    )


def validate_students_for_lesson(
    db: Session,
    lesson: Lesson,
    student_ids: list[int],
    *,
    require_student_for_individual: bool = True,
) -> list[int]:
    normalized_ids: list[int] = []
    seen_ids: set[int] = set()

    for student_id in student_ids:
        if student_id is None or student_id in seen_ids:
            continue
        seen_ids.add(student_id)
        normalized_ids.append(student_id)

    if lesson.lesson_type == "individual" and len(normalized_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Для индивидуального занятия можно выбрать только одного ученика",
        )

    if lesson.lesson_type == "individual" and require_student_for_individual and not normalized_ids:
        raise HTTPException(
            status_code=400,
            detail="Для индивидуального занятия нужно выбрать ученика",
        )

    if lesson.lesson_type == "group" and lesson.max_students and len(normalized_ids) > lesson.max_students:
        raise HTTPException(
            status_code=400,
            detail="Количество выбранных учеников превышает лимит группы",
        )

    existing_students = (
        db.query(Student).filter(Student.id.in_(normalized_ids)).all()
        if normalized_ids
        else []
    )
    existing_ids = {student.id for student in existing_students}
    missing_ids = [student_id for student_id in normalized_ids if student_id not in existing_ids]
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"Ученики не найдены: {', '.join(str(student_id) for student_id in missing_ids)}",
        )

    schedule = db.query(ScheduleEvent).filter(ScheduleEvent.id == lesson.schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Событие расписания для урока не найдено")

    student_conflicts = build_student_conflicts(
        db,
        normalized_ids,
        schedule.start_time,
        schedule.end_time,
        exclude_lesson_id=lesson.id,
    )
    raise_student_conflicts_if_needed(student_conflicts)

    return normalized_ids


def sync_lesson_students(db: Session, lesson: Lesson, student_ids: list[int]) -> None:
    normalized_ids = validate_students_for_lesson(db, lesson, student_ids)

    current_links = db.query(LessonStudent).filter(LessonStudent.lesson_id == lesson.id).all()
    current_ids = {link.student_id for link in current_links}

    for link in current_links:
        if link.student_id not in normalized_ids:
            db.delete(link)

    for student_id in normalized_ids:
        if student_id not in current_ids:
            db.add(
                LessonStudent(
                    lesson_id=lesson.id,
                    student_id=student_id,
                    enrolled_at=datetime.utcnow(),
                )
            )


def validate_event_student_conflicts_on_update(
    db: Session,
    event: ScheduleEvent,
    update_data: dict,
) -> None:
    if not event.lessons:
        return

    lesson = event.lessons[0]
    student_ids = [link.student_id for link in lesson.lesson_students]
    if not student_ids:
        return

    new_start = update_data.get("start_time", event.start_time)
    new_end = update_data.get("end_time", event.end_time)

    student_conflicts = build_student_conflicts(
        db,
        student_ids,
        new_start,
        new_end,
        exclude_lesson_id=lesson.id,
    )
    raise_student_conflicts_if_needed(student_conflicts)


@router.get("/events")
def get_schedule_events(
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.teacher),
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room),
        )
    )

    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.filter(ScheduleEvent.start_time >= start_dt)

    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        query = query.filter(ScheduleEvent.end_time <= end_dt)

    events = query.all()

    result = []
    for event in events:
        result.append(
            {
                "id": event.id,
                "teacher_id": event.teacher_id,
                "discipline_id": event.discipline_id,
                "room_id": event.room_id,
                "start_time": event.start_time,
                "end_time": event.end_time,
                "type": event.type,
                "created_at": event.created_at,
                "teacher": {
                    "id": event.teacher.id,
                    "user_id": event.teacher.user_id,
                    "specialization": event.teacher.specialization,
                }
                if event.teacher
                else None,
                "discipline": {
                    "id": event.discipline.id,
                    "name": event.discipline.name,
                }
                if event.discipline
                else None,
                "room": {
                    "id": event.room.id,
                    "name": event.room.name,
                }
                if event.room
                else None,
            }
        )

    return result


@router.get("/calendar")
def get_calendar_events(
    start_date: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start_dt = datetime.fromisoformat(start_date)
    end_dt = start_dt + timedelta(days=7)

    events = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.teacher),
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room),
            joinedload(ScheduleEvent.lessons)
            .joinedload(Lesson.lesson_students)
            .joinedload(LessonStudent.student),
        )
        .filter(ScheduleEvent.start_time >= start_dt)
        .filter(ScheduleEvent.start_time < end_dt)
        .all()
    )

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
                    {
                        "id": link.student.id,
                        "name": link.student.fio,
                    }
                    for link in lesson.lesson_students
                    if link.student
                ],
            }

        result.append(
            {
                "id": event.id,
                "teacher_id": event.teacher_id,
                "discipline_id": event.discipline_id,
                "room_id": event.room_id,
                "start_time": event.start_time,
                "end_time": event.end_time,
                "type": event.type,
                "created_at": event.created_at,
                "teacher": {
                    "id": event.teacher.id,
                    "user_id": event.teacher.user_id,
                    "specialization": event.teacher.specialization,
                }
                if event.teacher
                else None,
                "discipline": {
                    "id": event.discipline.id,
                    "name": event.discipline.name,
                }
                if event.discipline
                else None,
                "room": {
                    "id": event.room.id,
                    "name": event.room.name,
                }
                if event.room
                else None,
                "lesson": lesson_data,
            }
        )

    return result


@router.get("/events/{event_id}")
def get_schedule_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.teacher),
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room),
        )
        .filter(ScheduleEvent.id == event_id)
        .first()
    )

    if not event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")

    return {
        "id": event.id,
        "teacher_id": event.teacher_id,
        "discipline_id": event.discipline_id,
        "room_id": event.room_id,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "type": event.type,
        "created_at": event.created_at,
        "teacher": {
            "id": event.teacher.id,
            "user_id": event.teacher.user_id,
            "specialization": event.teacher.specialization,
        }
        if event.teacher
        else None,
        "discipline": {
            "id": event.discipline.id,
            "name": event.discipline.name,
        }
        if event.discipline
        else None,
        "room": {
            "id": event.room.id,
            "name": event.room.name,
        }
        if event.room
        else None,
    }


@router.post("/events")
def create_schedule_event(
    event_data: ScheduleEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conflicts = build_schedule_conflicts(db, event_data.dict())
    raise_schedule_conflicts_if_needed(conflicts)

    db_event = ScheduleEvent(**event_data.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    return db_event


@router.put("/events/{event_id}")
def update_schedule_event(
    event_id: int,
    event_data: ScheduleEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_event = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.lessons).joinedload(Lesson.lesson_students),
        )
        .filter(ScheduleEvent.id == event_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")

    update_data = event_data.dict(exclude_unset=True)
    if update_data:
        conflicts = build_schedule_conflicts(db, {**db_event.__dict__, **update_data}, event_id)
        raise_schedule_conflicts_if_needed(conflicts)
        validate_event_student_conflicts_on_update(db, db_event, update_data)

    for field, value in update_data.items():
        setattr(db_event, field, value)

    db.commit()
    db.refresh(db_event)

    return db_event


@router.delete("/events/{event_id}")
def delete_schedule_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_event = db.query(ScheduleEvent).filter(ScheduleEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")

    lessons = db.query(Lesson).filter(Lesson.schedule_id == event_id).all()
    for lesson in lessons:
        db.query(LessonStudent).filter(LessonStudent.lesson_id == lesson.id).delete()
        db.query(LessonIssue).filter(LessonIssue.lesson_id == lesson.id).delete()
        db.delete(lesson)

    db.delete(db_event)
    db.commit()

    return {"message": "Событие расписания удалено"}


@router.get("/lessons")
def get_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Lesson).options(joinedload(Lesson.schedule)).all()


@router.post("/lessons")
def create_lesson(
    lesson_data: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    lesson_dict = lesson_data.dict()
    student_ids = lesson_dict.pop("student_ids", [])

    db_lesson = Lesson(**lesson_dict)
    db.add(db_lesson)
    db.flush()
    sync_lesson_students(db, db_lesson, student_ids)
    db.commit()
    db.refresh(db_lesson)

    return db_lesson


@router.put("/lessons/{lesson_id}")
def update_lesson(
    lesson_id: int,
    lesson_data: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not db_lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    update_data = lesson_data.dict(exclude_unset=True)
    student_ids = update_data.pop("student_ids", None)

    for field, value in update_data.items():
        setattr(db_lesson, field, value)

    if student_ids is not None:
        sync_lesson_students(db, db_lesson, student_ids)

    db.commit()
    db.refresh(db_lesson)

    return db_lesson


@router.delete("/lessons/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not db_lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    db.delete(db_lesson)
    db.commit()

    return {"message": "Занятие удалено"}
