from datetime import date, datetime, time, timedelta
from io import BytesIO
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.discipline import Discipline
from models.entityChangeLog import EntityChangeLog
from models.lesson import Lesson
from models.lessonIssue import LessonIssue
from models.lessonStudent import LessonStudent
from models.room import Room
from models.scheduleEvent import ScheduleEvent
from models.scheduleHistory import ScheduleHistory
from models.scheduleRecurring import ScheduleRecurring
from models.student import Student
from models.teacher import Teacher
from models.user import User
from schemas.schedule import (
    LessonCreate,
    LessonUpdate,
    BulkTeacherRescheduleRequest,
    ScheduleEntryCreate,
    ScheduleEventCreate,
    ScheduleEventUpdate,
    ScheduleRecurringRule,
)

router = APIRouter(prefix="/api/schedule")

WORKDAY_START_HOUR = 9
HOLIDAY_START_HOUR = 11
WORKDAY_END_HOUR = 23
LUNCH_BREAK_START = "13:00"
LUNCH_BREAK_END = "15:00"
MAX_RECURRING_OCCURRENCES = 366
DISALLOWED_STUDENT_STATUSES_FOR_SCHEDULE = {"заморожен", "отказался"}


def format_conflict_time(start_time: datetime, end_time: datetime) -> str:
    return f"{start_time.strftime('%d.%m.%Y %H:%M')} - {end_time.strftime('%H:%M')}"


def get_current_teacher(db: Session, current_user: User) -> Teacher | None:
    if getattr(getattr(current_user, "role", None), "name", None) != "teacher":
        return None
    return db.query(Teacher).filter(Teacher.user_id == current_user.id).first()


def ensure_teacher_can_manage_teacher(
    db: Session,
    current_user: User,
    teacher_id: int,
) -> None:
    teacher = get_current_teacher(db, current_user)
    if teacher and teacher.id != teacher_id:
        raise HTTPException(
            status_code=403,
            detail="Преподаватель может управлять только своим расписанием",
        )


def ensure_teacher_can_manage_event(
    db: Session,
    current_user: User,
    event: ScheduleEvent,
) -> None:
    teacher = get_current_teacher(db, current_user)
    if teacher and event.teacher_id != teacher.id:
        raise HTTPException(
            status_code=403,
            detail="Недостаточно прав для изменения этого занятия",
        )


def ensure_event_not_started(event: ScheduleEvent) -> None:
    if event.start_time <= datetime.now():
        raise HTTPException(
            status_code=400,
            detail="Нельзя перенести или изменить занятие, которое уже началось или прошло",
        )


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Некорректная дата") from exc


def get_range_for_view(start_date: str, view: str) -> tuple[datetime, datetime]:
    base_date = parse_iso_date(start_date)

    if view == "day":
        range_start = datetime.combine(base_date, time.min)
        range_end = range_start + timedelta(days=1)
        return range_start, range_end

    if view == "month":
        range_start = datetime.combine(base_date.replace(day=1), time.min)
        if range_start.month == 12:
            next_month = range_start.replace(year=range_start.year + 1, month=1)
        else:
            next_month = range_start.replace(month=range_start.month + 1)
        return range_start, next_month

    monday = base_date - timedelta(days=base_date.weekday())
    range_start = datetime.combine(monday, time.min)
    range_end = range_start + timedelta(days=7)
    return range_start, range_end


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
            (ScheduleEvent.teacher_id == event_data["teacher_id"])
            | (ScheduleEvent.room_id == event_data["room_id"])
        )
    )

    if exclude_id is not None:
        query = query.filter(ScheduleEvent.id != exclude_id)

    conflicts = query.all()

    return {
        "teacher_conflicts": [
            serialize_schedule_conflict(event)
            for event in conflicts
            if event.teacher_id == event_data["teacher_id"]
        ],
        "room_conflicts": [
            serialize_schedule_conflict(event)
            for event in conflicts
            if event.room_id == event_data["room_id"]
        ],
    }


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


def validate_recurrence(recurrence: ScheduleRecurringRule, start_time: datetime) -> None:
    if recurrence.repeat_type == "none":
        return

    if recurrence.repeat_until is None:
        raise HTTPException(
            status_code=400,
            detail="Для повторяющихся занятий нужно указать дату окончания повторений",
        )

    if recurrence.repeat_until < start_time.date():
        raise HTTPException(
            status_code=400,
            detail="Дата окончания повторений не может быть раньше первого занятия",
        )

    if recurrence.repeat_type == "weekdays":
        invalid_values = [value for value in recurrence.weekdays if value < 0 or value > 6]
        if invalid_values:
            raise HTTPException(
                status_code=400,
                detail="Дни недели должны быть в диапазоне от 0 до 6",
            )
        if not recurrence.weekdays:
            raise HTTPException(
                status_code=400,
                detail="Для повторения по выбранным дням недели нужно указать хотя бы один день",
            )


def generate_occurrence_starts(
    start_time: datetime,
    recurrence: ScheduleRecurringRule,
) -> list[datetime]:
    validate_recurrence(recurrence, start_time)

    if recurrence.repeat_type == "none":
        return [start_time]

    repeat_until = recurrence.repeat_until
    assert repeat_until is not None

    occurrences: list[datetime] = []
    current = start_time

    if recurrence.repeat_type == "weekly":
        while current.date() <= repeat_until:
            occurrences.append(current)
            current = current + timedelta(days=7)
    elif recurrence.repeat_type == "daily":
        while current.date() <= repeat_until:
            occurrences.append(current)
            current = current + timedelta(days=1)
    else:
        allowed_weekdays = set(recurrence.weekdays)
        while current.date() <= repeat_until:
            if current.weekday() in allowed_weekdays:
                occurrences.append(current)
            current = current + timedelta(days=1)

    if len(occurrences) > MAX_RECURRING_OCCURRENCES:
        raise HTTPException(
            status_code=400,
            detail="Слишком много повторений. Уменьшите период серии",
        )

    return occurrences


def serialize_recurring(event: ScheduleEvent) -> dict | None:
    recurring = event.recurring[0] if getattr(event, "recurring", None) else None
    if not recurring:
        return None
    return {
        "id": recurring.id,
        "repeat_type": recurring.repeat_type,
        "repeat_until": recurring.repeat_until,
    }


def serialize_calendar_event(db: Session, event: ScheduleEvent) -> dict:
    lesson_data = None
    if event.lessons:
        lesson = event.lessons[0]
        lesson_data = {
            "id": lesson.id,
            "lesson_date": lesson.lesson_date,
            "lesson_type": lesson.lesson_type,
            "max_students": lesson.max_students,
            "students": [
                {"id": link.student.id, "name": link.student.fio}
                for link in lesson.lesson_students
                if link.student
            ],
        }

    conflicts = build_schedule_conflicts(
        db,
        {
            "teacher_id": event.teacher_id,
            "discipline_id": event.discipline_id,
            "room_id": event.room_id,
            "start_time": event.start_time,
            "end_time": event.end_time,
        },
        exclude_id=event.id,
    )

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
            "full_name": event.teacher.user.full_name if event.teacher and event.teacher.user else None,
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
        "recurring": serialize_recurring(event),
        "has_conflict": bool(conflicts["teacher_conflicts"] or conflicts["room_conflicts"]),
        "conflicts": conflicts,
    }


def serialize_lesson_with_details(db: Session, lesson: Lesson) -> dict:
    schedule = lesson.schedule
    teacher = schedule.teacher if schedule else None
    teacher_user = teacher.user if teacher else None

    return {
        "id": lesson.id,
        "schedule_id": lesson.schedule_id,
        "lesson_date": lesson.lesson_date,
        "status": lesson.status,
        "lesson_type": lesson.lesson_type,
        "max_students": lesson.max_students,
        "created_at": lesson.created_at,
        "schedule": serialize_calendar_event(db, schedule) if schedule else None,
        "students": [
            {
                "id": link.student.id,
                "fio": link.student.fio,
                "phone": link.student.phone,
                "status": link.student.status,
            }
            for link in lesson.lesson_students
            if link.student
        ],
        "issues": [
            {
                "id": issue.id,
                "description": issue.description,
                "created_at": issue.created_at,
            }
            for issue in lesson.issues
        ],
        "teacher_name": (teacher_user.full_name or teacher_user.login) if teacher_user else None,
    }


def normalize_student_ids(student_ids: list[int]) -> list[int]:
    normalized_ids: list[int] = []
    seen_ids: set[int] = set()
    for student_id in student_ids:
        if student_id is None or student_id in seen_ids:
            continue
        seen_ids.add(student_id)
        normalized_ids.append(student_id)
    return normalized_ids


def validate_students_for_lesson(
    db: Session,
    lesson_type: str,
    max_students: int,
    student_ids: list[int],
    schedule_id: int,
    lesson_id: int | None = None,
    require_student_for_individual: bool = True,
) -> list[int]:
    normalized_ids = normalize_student_ids(student_ids)

    if lesson_type == "individual" and len(normalized_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Для индивидуального занятия можно выбрать только одного ученика",
        )

    if lesson_type == "individual" and require_student_for_individual and not normalized_ids:
        raise HTTPException(
            status_code=400,
            detail="Для индивидуального занятия нужно выбрать ученика",
        )

    if lesson_type == "group" and max_students and len(normalized_ids) > max_students:
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

    blocked_students = [
        student.fio
        for student in existing_students
        if str(student.status or "").strip().lower() in DISALLOWED_STUDENT_STATUSES_FOR_SCHEDULE
    ]
    if blocked_students:
        raise HTTPException(
            status_code=400,
            detail=(
                "Нельзя добавить в расписание учеников со статусом "
                f"«заморожен» или «отказался»: {', '.join(blocked_students)}"
            ),
        )

    schedule = db.query(ScheduleEvent).filter(ScheduleEvent.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Событие расписания для урока не найдено")

    student_conflicts = build_student_conflicts(
        db,
        normalized_ids,
        schedule.start_time,
        schedule.end_time,
        exclude_lesson_id=lesson_id,
    )
    if student_conflicts:
        raise_detailed_conflict(
            "У одного или нескольких учеников уже есть занятие в это время.",
            student_conflicts=student_conflicts,
        )

    return normalized_ids


def sync_lesson_students(db: Session, lesson: Lesson, student_ids: list[int]) -> None:
    normalized_ids = validate_students_for_lesson(
        db,
        lesson.lesson_type,
        lesson.max_students,
        student_ids,
        lesson.schedule_id,
        lesson.id,
    )

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
    ignore_conflicts: bool,
) -> None:
    if ignore_conflicts or not event.lessons:
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
    if student_conflicts:
        raise_detailed_conflict(
            "У одного или нескольких учеников уже есть занятие в это время.",
            student_conflicts=student_conflicts,
        )


def create_schedule_history_record(
    db: Session,
    schedule_id: int,
    changed_by: int,
    old_start: datetime,
    new_start: datetime,
) -> None:
    db.add(
        ScheduleHistory(
            schedule_id=schedule_id,
            changed_by=changed_by,
            old_start=old_start,
            new_start=new_start,
            changed_at=datetime.now(),
        )
    )


def get_teacher_display(db: Session, teacher_id: int | None) -> str | None:
    if teacher_id is None:
        return None
    teacher = (
        db.query(Teacher)
        .options(joinedload(Teacher.user))
        .filter(Teacher.id == teacher_id)
        .first()
    )
    if not teacher:
        return str(teacher_id)
    if teacher.user:
        return teacher.user.full_name or teacher.user.login or str(teacher.id)
    return teacher.specialization or str(teacher.id)


def get_room_display(db: Session, room_id: int | None) -> str | None:
    if room_id is None:
        return None
    room = db.query(Room).filter(Room.id == room_id).first()
    return room.name if room else str(room_id)


def get_discipline_display(db: Session, discipline_id: int | None) -> str | None:
    if discipline_id is None:
        return None
    discipline = db.query(Discipline).filter(Discipline.id == discipline_id).first()
    return discipline.name if discipline else str(discipline_id)


def get_student_names(db: Session, student_ids: list[int]) -> list[str]:
    normalized_ids = normalize_student_ids(student_ids)
    if not normalized_ids:
        return []
    students = db.query(Student).filter(Student.id.in_(normalized_ids)).all()
    names_by_id = {student.id: student.fio for student in students}
    return [names_by_id.get(student_id, str(student_id)) for student_id in normalized_ids]


def serialize_student_names(db: Session, student_ids: list[int]) -> str | None:
    names = get_student_names(db, student_ids)
    return ", ".join(names) if names else None


def get_schedule_field_display(db: Session, field_name: str, value):
    if field_name == "teacher_id":
        return get_teacher_display(db, value)
    if field_name == "room_id":
        return get_room_display(db, value)
    if field_name == "discipline_id":
        return get_discipline_display(db, value)
    return value


def get_lesson_field_display(db: Session, field_name: str, value):
    if field_name == "student_ids":
        return serialize_student_names(db, value or [])
    return value


def build_schedule_event_changes(db: Session, event: ScheduleEvent, update_data: dict) -> dict[str, tuple[object, object]]:
    changes: dict[str, tuple[object, object]] = {}
    tracked_fields = ("teacher_id", "discipline_id", "room_id", "start_time", "end_time", "type")
    for field_name in tracked_fields:
        if field_name not in update_data:
            continue
        old_value = getattr(event, field_name)
        new_value = update_data[field_name]
        if old_value == new_value:
            continue
        changes[field_name] = (
            get_schedule_field_display(db, field_name, old_value),
            get_schedule_field_display(db, field_name, new_value),
        )
    return changes


def build_lesson_changes(
    db: Session,
    lesson: Lesson,
    update_data: dict,
    student_ids: list[int] | None,
) -> dict[str, tuple[object, object]]:
    changes: dict[str, tuple[object, object]] = {}

    for field_name in ("lesson_type", "max_students"):
        if field_name not in update_data:
            continue
        old_value = getattr(lesson, field_name)
        new_value = update_data[field_name]
        if old_value != new_value:
            changes[field_name] = (old_value, new_value)

    if student_ids is not None:
        old_student_ids = [link.student_id for link in lesson.lesson_students]
        new_student_ids = normalize_student_ids(student_ids)
        if normalize_student_ids(old_student_ids) != new_student_ids:
            changes["student_ids"] = (
                get_lesson_field_display(db, "student_ids", old_student_ids),
                get_lesson_field_display(db, "student_ids", new_student_ids),
            )

    return changes


def build_event_payloads_for_series(
    data: ScheduleEntryCreate,
) -> list[dict]:
    recurrence = data.recurrence or ScheduleRecurringRule()
    start_times = generate_occurrence_starts(data.start_time, recurrence)
    duration = data.end_time - data.start_time

    return [
        {
            "teacher_id": data.teacher_id,
            "discipline_id": data.discipline_id,
            "room_id": data.room_id,
            "start_time": occurrence_start,
            "end_time": occurrence_start + duration,
            "type": data.type,
        }
        for occurrence_start in start_times
    ]


def create_schedule_entry_series(
    db: Session,
    current_user: User,
    data: ScheduleEntryCreate,
) -> list[ScheduleEvent]:
    ensure_teacher_can_manage_teacher(db, current_user, data.teacher_id)

    created_events: list[ScheduleEvent] = []
    event_payloads = build_event_payloads_for_series(data)

    for payload in event_payloads:
        conflicts = build_schedule_conflicts(db, payload)
        student_conflicts = build_student_conflicts(
            db,
            normalize_student_ids(data.student_ids),
            payload["start_time"],
            payload["end_time"],
        )

        if not data.ignore_conflicts and (
            conflicts["teacher_conflicts"]
            or conflicts["room_conflicts"]
            or student_conflicts
        ):
            raise_detailed_conflict(
                "Обнаружены конфликты расписания.",
                teacher_conflicts=conflicts["teacher_conflicts"],
                room_conflicts=conflicts["room_conflicts"],
                student_conflicts=student_conflicts,
            )

        db_event = ScheduleEvent(**payload)
        db.add(db_event)
        db.flush()

        db_lesson = Lesson(
            schedule_id=db_event.id,
            lesson_date=payload["start_time"].date(),
            status="planned",
            lesson_type=data.lesson_type,
            max_students=data.max_students,
        )
        db.add(db_lesson)
        db.flush()

        normalized_ids = validate_students_for_lesson(
            db,
            data.lesson_type,
            data.max_students,
            data.student_ids,
            db_event.id,
            db_lesson.id,
        )
        for student_id in normalized_ids:
            db.add(
                LessonStudent(
                    lesson_id=db_lesson.id,
                    student_id=student_id,
                    enrolled_at=datetime.utcnow(),
                )
            )

        log_entity_change(
            db,
            actor_user_id=current_user.id,
            entity="schedule_event",
            entity_id=db_event.id,
            action="create",
            old_value=None,
            new_value=(
                f"Создано занятие: {payload['start_time'].strftime('%d.%m.%Y %H:%M')} - "
                f"{payload['end_time'].strftime('%H:%M')}"
            ),
        )
        log_model_updates(
            db,
            actor_user_id=current_user.id,
            entity="schedule_event",
            entity_id=db_event.id,
            changes={
                "teacher_id": (None, get_teacher_display(db, payload["teacher_id"])),
                "discipline_id": (None, get_discipline_display(db, payload["discipline_id"])),
                "room_id": (None, get_room_display(db, payload["room_id"])),
                "type": (None, payload["type"]),
                "start_time": (None, payload["start_time"]),
                "end_time": (None, payload["end_time"]),
            },
            action="create",
        )
        log_model_updates(
            db,
            actor_user_id=current_user.id,
            entity="lesson",
            entity_id=db_lesson.id,
            changes={
                "lesson_type": (None, data.lesson_type),
                "max_students": (None, data.max_students),
                "student_ids": (None, serialize_student_names(db, normalized_ids)),
            },
            action="create",
        )

        recurrence = data.recurrence or ScheduleRecurringRule()
        if recurrence.repeat_type != "none":
            db.add(
                ScheduleRecurring(
                    schedule_id=db_event.id,
                    repeat_type=recurrence.repeat_type,
                    repeat_until=recurrence.repeat_until,
                )
            )

        created_events.append(db_event)

    db.commit()
    for event in created_events:
        db.refresh(event)
    return created_events


def get_scoped_events_query(
    db: Session,
    current_user: User,
):
    query = db.query(ScheduleEvent).options(
        joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
        joinedload(ScheduleEvent.discipline),
        joinedload(ScheduleEvent.room),
        joinedload(ScheduleEvent.lessons)
        .joinedload(Lesson.lesson_students)
        .joinedload(LessonStudent.student),
        joinedload(ScheduleEvent.recurring),
    )

    teacher = get_current_teacher(db, current_user)
    if teacher:
        query = query.filter(ScheduleEvent.teacher_id == teacher.id)

    return query


def get_events_for_range(
    db: Session,
    current_user: User,
    start_date: str,
    view: str,
    teacher_id: int | None,
    room_id: int | None,
) -> list[ScheduleEvent]:
    range_start, range_end = get_range_for_view(start_date, view)
    query = get_scoped_events_query(db, current_user)
    query = query.filter(ScheduleEvent.start_time < range_end).filter(ScheduleEvent.end_time > range_start)

    if teacher_id:
        query = query.filter(ScheduleEvent.teacher_id == teacher_id)
    if room_id:
        query = query.filter(ScheduleEvent.room_id == room_id)

    return query.order_by(ScheduleEvent.start_time, ScheduleEvent.id).all()


def build_ics_text(events: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Nockturn CRM//Schedule//RU",
        "CALSCALE:GREGORIAN",
    ]
    now_stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    if any(event.start_time <= datetime.now() for event in events):
        raise HTTPException(
            status_code=400,
            detail="Нельзя массово перенести занятия, которые уже начались или прошли",
        )

    for event in events:
        start_time = event["start_time"].strftime("%Y%m%dT%H%M%S")
        end_time = event["end_time"].strftime("%Y%m%dT%H%M%S")
        teacher_name = event["teacher"]["full_name"] if event.get("teacher") else ""
        discipline_name = event["discipline"]["name"] if event.get("discipline") else "Занятие"
        room_name = event["room"]["name"] if event.get("room") else ""
        student_names = ", ".join(student["name"] for student in event.get("lesson", {}).get("students", []))

        description_parts = [
            f"Тип: {event.get('type') or 'lesson'}",
            f"Преподаватель: {teacher_name or '—'}",
            f"Кабинет: {room_name or '—'}",
        ]
        if student_names:
            description_parts.append(f"Ученики: {student_names}")

        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:schedule-{event['id']}@nockturn",
                f"DTSTAMP:{now_stamp}",
                f"DTSTART:{start_time}",
                f"DTEND:{end_time}",
                f"SUMMARY:{discipline_name}",
                f"LOCATION:{room_name}",
                f"DESCRIPTION:{' | '.join(description_parts)}",
                "END:VEVENT",
            ]
        )

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def build_xlsx_bytes(rows: list[list[str | int | float]]) -> bytes:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Расписание" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""

    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Nockturn CRM</Application>
</Properties>"""

    created = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Nockturn CRM</dc:creator>
  <cp:lastModifiedBy>Nockturn CRM</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>"""

    def column_name(index: int) -> str:
        result = ""
        current = index
        while current >= 0:
            result = chr(current % 26 + 65) + result
            current = current // 26 - 1
        return result

    sheet_rows: list[str] = []
    for row_index, row in enumerate(rows, start=1):
        cells: list[str] = []
        for column_index, value in enumerate(row):
            cell_ref = f"{column_name(column_index)}{row_index}"
            value_str = escape("" if value is None else str(value))
            cells.append(
                f'<c r="{cell_ref}" t="inlineStr"><is><t>{value_str}</t></is></c>'
            )
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    worksheet = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {''.join(sheet_rows)}
  </sheetData>
</worksheet>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as zip_file:
        zip_file.writestr("[Content_Types].xml", content_types)
        zip_file.writestr("_rels/.rels", rels)
        zip_file.writestr("docProps/app.xml", app)
        zip_file.writestr("docProps/core.xml", core)
        zip_file.writestr("xl/workbook.xml", workbook)
        zip_file.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zip_file.writestr("xl/styles.xml", styles)
        zip_file.writestr("xl/worksheets/sheet1.xml", worksheet)

    buffer.seek(0)
    return buffer.getvalue()


@router.get("/events")
def get_schedule_events(
    start_date: str | None = None,
    end_date: str | None = None,
    teacher_id: int | None = None,
    room_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = get_scoped_events_query(db, current_user)

    if start_date:
        query = query.filter(ScheduleEvent.start_time >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(ScheduleEvent.end_time <= datetime.fromisoformat(end_date))
    if teacher_id:
        query = query.filter(ScheduleEvent.teacher_id == teacher_id)
    if room_id:
        query = query.filter(ScheduleEvent.room_id == room_id)

    events = query.order_by(ScheduleEvent.start_time, ScheduleEvent.id).all()
    return [serialize_calendar_event(db, event) for event in events]


@router.get("/calendar")
def get_calendar_events(
    start_date: str,
    view: str = "week",
    teacher_id: int | None = None,
    room_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = get_events_for_range(db, current_user, start_date, view, teacher_id, room_id)
    return [serialize_calendar_event(db, event) for event in events]


@router.get("/events/{event_id}")
def get_schedule_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = (
        get_scoped_events_query(db, current_user)
        .filter(ScheduleEvent.id == event_id)
        .first()
    )
    if not event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")
    return serialize_calendar_event(db, event)


@router.post("/events")
def create_schedule_event(
    event_data: ScheduleEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_teacher_can_manage_teacher(db, current_user, event_data.teacher_id)

    payload = event_data.model_dump(exclude={"ignore_conflicts"})
    conflicts = build_schedule_conflicts(db, payload)
    if not event_data.ignore_conflicts and (conflicts["teacher_conflicts"] or conflicts["room_conflicts"]):
        raise_detailed_conflict(
            "Обнаружены конфликты расписания.",
            teacher_conflicts=conflicts["teacher_conflicts"],
            room_conflicts=conflicts["room_conflicts"],
        )

    db_event = ScheduleEvent(**payload)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.post("/entries")
def create_schedule_entries(
    payload: ScheduleEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    created_events = create_schedule_entry_series(db, current_user, payload)
    events = (
        get_scoped_events_query(db, current_user)
        .filter(ScheduleEvent.id.in_([event.id for event in created_events]))
        .all()
    )
    return {
        "count": len(events),
        "events": [serialize_calendar_event(db, event) for event in events],
    }


@router.put("/events/{event_id}")
def update_schedule_event(
    event_id: int,
    event_data: ScheduleEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_event = (
        get_scoped_events_query(db, current_user)
        .filter(ScheduleEvent.id == event_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")

    ensure_teacher_can_manage_event(db, current_user, db_event)
    ensure_event_not_started(db_event)

    update_data = event_data.model_dump(exclude_unset=True, exclude={"ignore_conflicts"})
    ignore_conflicts = event_data.ignore_conflicts
    event_changes = build_schedule_event_changes(db, db_event, update_data) if update_data else {}
    if update_data:
        merged_data = {
            "teacher_id": update_data.get("teacher_id", db_event.teacher_id),
            "discipline_id": update_data.get("discipline_id", db_event.discipline_id),
            "room_id": update_data.get("room_id", db_event.room_id),
            "start_time": update_data.get("start_time", db_event.start_time),
            "end_time": update_data.get("end_time", db_event.end_time),
            "type": update_data.get("type", db_event.type),
        }
        conflicts = build_schedule_conflicts(db, merged_data, event_id)
        if not ignore_conflicts and (conflicts["teacher_conflicts"] or conflicts["room_conflicts"]):
            raise_detailed_conflict(
                "Обнаружены конфликты расписания.",
                teacher_conflicts=conflicts["teacher_conflicts"],
                room_conflicts=conflicts["room_conflicts"],
            )
        validate_event_student_conflicts_on_update(db, db_event, update_data, ignore_conflicts)

    old_start = db_event.start_time
    for field, value in update_data.items():
        setattr(db_event, field, value)

    if "start_time" in update_data and db_event.lessons:
        for lesson in db_event.lessons:
            lesson.lesson_date = db_event.start_time.date()

    if update_data:
        create_schedule_history_record(
            db,
            db_event.id,
            current_user.id,
            old_start,
            db_event.start_time,
        )
        log_model_updates(
            db,
            actor_user_id=current_user.id,
            entity="schedule_event",
            entity_id=db_event.id,
            changes=event_changes,
        )

    db.commit()
    db.refresh(db_event)
    return db_event


@router.delete("/events/{event_id}")
def delete_schedule_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_event = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.lessons).joinedload(Lesson.lesson_students).joinedload(LessonStudent.student),
            joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room),
        )
        .filter(ScheduleEvent.id == event_id)
        .first()
    )
    if not db_event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")

    ensure_teacher_can_manage_event(db, current_user, db_event)

    student_names = []
    if db_event.lessons:
        for link in db_event.lessons[0].lesson_students:
            if link.student:
                student_names.append(link.student.fio)

    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="schedule_event",
        entity_id=db_event.id,
        action="delete",
        old_value=(
            f"{db_event.start_time.strftime('%d.%m.%Y %H:%M')} - {db_event.end_time.strftime('%H:%M')}, "
            f"преподаватель: {db_event.teacher.user.full_name if db_event.teacher and db_event.teacher.user else '—'}, "
            f"кабинет: {db_event.room.name if db_event.room else '—'}, "
            f"ученики: {', '.join(student_names) if student_names else '—'}"
        ),
        new_value=None,
    )

    lessons = db.query(Lesson).filter(Lesson.schedule_id == event_id).all()
    for lesson in lessons:
        db.query(LessonStudent).filter(LessonStudent.lesson_id == lesson.id).delete()
        db.query(LessonIssue).filter(LessonIssue.lesson_id == lesson.id).delete()
        db.delete(lesson)

    db.query(ScheduleRecurring).filter(ScheduleRecurring.schedule_id == event_id).delete()
    db.delete(db_event)
    db.commit()
    return {"message": "Событие расписания удалено"}


@router.post("/bulk-reschedule")
def bulk_reschedule_teacher_lessons(
    payload: BulkTeacherRescheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)

    teacher = db.query(Teacher).filter(Teacher.id == payload.teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")

    source_start = datetime.combine(payload.source_date, time.min)
    source_end = source_start + timedelta(days=1)
    day_shift = (payload.target_date - payload.source_date).days

    events = (
        db.query(ScheduleEvent)
        .options(
            joinedload(ScheduleEvent.lessons).joinedload(Lesson.lesson_students),
            joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
            joinedload(ScheduleEvent.room),
            joinedload(ScheduleEvent.discipline),
        )
        .filter(ScheduleEvent.teacher_id == payload.teacher_id)
        .filter(ScheduleEvent.start_time >= source_start)
        .filter(ScheduleEvent.start_time < source_end)
        .all()
    )

    if not events:
        raise HTTPException(status_code=404, detail="На выбранную дату у преподавателя нет занятий")

    if any(event.start_time <= datetime.now() for event in events):
        raise HTTPException(
            status_code=400,
            detail="Нельзя массово перенести занятия, которые уже начались или прошли",
        )

    for event in events:
        update_data = {
            "start_time": event.start_time + timedelta(days=day_shift),
            "end_time": event.end_time + timedelta(days=day_shift),
        }
        merged_data = {
            "teacher_id": event.teacher_id,
            "discipline_id": event.discipline_id,
            "room_id": event.room_id,
            "start_time": update_data["start_time"],
            "end_time": update_data["end_time"],
            "type": event.type,
        }
        conflicts = build_schedule_conflicts(db, merged_data, event.id)
        validate_event_student_conflicts_on_update(db, event, update_data, payload.ignore_conflicts)
        if not payload.ignore_conflicts and (conflicts["teacher_conflicts"] or conflicts["room_conflicts"]):
            raise_detailed_conflict(
                "Обнаружены конфликты при массовом переносе занятий преподавателя.",
                teacher_conflicts=conflicts["teacher_conflicts"],
                room_conflicts=conflicts["room_conflicts"],
            )

    for event in events:
        old_start = event.start_time
        update_data = {
            "start_time": event.start_time + timedelta(days=day_shift),
            "end_time": event.end_time + timedelta(days=day_shift),
        }
        event_changes = build_schedule_event_changes(db, event, update_data)
        event.start_time = update_data["start_time"]
        event.end_time = update_data["end_time"]
        for lesson in event.lessons:
            lesson.lesson_date = event.start_time.date()

        create_schedule_history_record(
            db,
            event.id,
            current_user.id,
            old_start,
            event.start_time,
        )
        log_model_updates(
            db,
            actor_user_id=current_user.id,
            entity="schedule_event",
            entity_id=event.id,
            changes=event_changes,
        )

    db.commit()
    return {"message": "Занятия преподавателя успешно перенесены", "count": len(events)}


@router.get("/history")
def get_schedule_history(
    event_id: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    teacher = get_current_teacher(db, current_user)

    schedule_query = get_scoped_events_query(db, current_user)
    if event_id:
        schedule_query = schedule_query.filter(ScheduleEvent.id == event_id)

    schedule_events = schedule_query.all()
    schedule_ids = [event.id for event in schedule_events]
    lesson_ids = [event.lessons[0].id for event in schedule_events if event.lessons]

    if event_id and not schedule_ids:
        return []

    entity_query = db.query(EntityChangeLog).options(joinedload(EntityChangeLog.actor_user))
    if start_date:
        entity_query = entity_query.filter(EntityChangeLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        entity_query = entity_query.filter(EntityChangeLog.created_at <= datetime.fromisoformat(end_date))

    if schedule_ids or lesson_ids:
        filters = []
        if schedule_ids:
            filters.append(
                (EntityChangeLog.entity == "schedule_event") & (EntityChangeLog.entity_id.in_(schedule_ids))
            )
        if lesson_ids:
            filters.append(
                (EntityChangeLog.entity == "lesson") & (EntityChangeLog.entity_id.in_(lesson_ids))
            )
        entity_logs = entity_query.filter(or_(*filters)).all()
    else:
        entity_logs = []

    legacy_query = (
        db.query(ScheduleHistory)
        .options(
            joinedload(ScheduleHistory.schedule)
            .joinedload(ScheduleEvent.teacher)
            .joinedload(Teacher.user),
            joinedload(ScheduleHistory.schedule).joinedload(ScheduleEvent.room),
            joinedload(ScheduleHistory.schedule).joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleHistory.changed_by_user),
        )
    )
    if event_id:
        legacy_query = legacy_query.filter(ScheduleHistory.schedule_id == event_id)
    elif teacher:
        legacy_query = legacy_query.join(ScheduleHistory.schedule).filter(ScheduleEvent.teacher_id == teacher.id)
    if start_date:
        legacy_query = legacy_query.filter(ScheduleHistory.changed_at >= datetime.fromisoformat(start_date))
    if end_date:
        legacy_query = legacy_query.filter(ScheduleHistory.changed_at <= datetime.fromisoformat(end_date))

    legacy_records = legacy_query.all()

    history_rows = [
        {
            "id": f"entity-{record.id}",
            "schedule_id": event_id if record.entity == "lesson" and event_id else record.entity_id,
            "entity": record.entity,
            "action": record.action,
            "field_name": record.field_name,
            "changed_at": record.created_at,
            "old_value": record.old_value,
            "new_value": record.new_value,
            "changed_by": {
                "id": record.actor_user.id,
                "full_name": record.actor_user.full_name,
                "login": record.actor_user.login,
            }
            if record.actor_user
            else None,
        }
        for record in entity_logs
    ]

    history_rows.extend(
        [
            {
                "id": f"legacy-{record.id}",
                "schedule_id": record.schedule_id,
                "entity": "schedule_event",
                "action": "move",
                "field_name": "start_time",
                "changed_at": record.changed_at,
                "old_value": record.old_start.isoformat() if record.old_start else None,
                "new_value": record.new_start.isoformat() if record.new_start else None,
                "changed_by": {
                    "id": record.changed_by_user.id,
                    "full_name": record.changed_by_user.full_name,
                    "login": record.changed_by_user.login,
                }
                if record.changed_by_user
                else None,
            }
            for record in legacy_records
        ]
    )

    history_rows.sort(
        key=lambda row: (
            row["changed_at"] or datetime.min,
            str(row["id"]),
        ),
        reverse=True,
    )
    return history_rows


@router.get("/non-working-periods")
def get_non_working_periods(
    current_user: User = Depends(get_current_user),
):
    return {
        "workday_start_hour": WORKDAY_START_HOUR,
        "holiday_start_hour": HOLIDAY_START_HOUR,
        "workday_end_hour": WORKDAY_END_HOUR,
        "lunch_breaks": [
            {
                "name": "Дневной перерыв",
                "start_time": LUNCH_BREAK_START,
                "end_time": LUNCH_BREAK_END,
                "weekdays": [0, 1, 2, 3, 4, 5],
            }
        ],
        "weekends": [6],
    }


@router.get("/export/ics")
def export_schedule_ics(
    start_date: str,
    view: str = "week",
    teacher_id: int | None = None,
    room_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = get_events_for_range(db, current_user, start_date, view, teacher_id, room_id)
    serialized = [serialize_calendar_event(db, event) for event in events]
    content = build_ics_text(serialized)
    buffer = BytesIO(content.encode("utf-8"))
    return StreamingResponse(
        buffer,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="schedule.ics"'},
    )


@router.get("/export/xlsx")
def export_schedule_xlsx(
    start_date: str,
    view: str = "week",
    teacher_id: int | None = None,
    room_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    events = get_events_for_range(db, current_user, start_date, view, teacher_id, room_id)
    serialized = [serialize_calendar_event(db, event) for event in events]
    rows: list[list[str]] = [[
        "Дата",
        "Начало",
        "Окончание",
        "Тип",
        "Преподаватель",
        "Дисциплина",
        "Кабинет",
        "Ученики",
        "Повторяемость",
        "Есть конфликт",
    ]]

    for event in serialized:
        recurring = event.get("recurring") or {}
        students = ", ".join(student["name"] for student in event.get("lesson", {}).get("students", []))
        rows.append(
            [
                event["start_time"].strftime("%d.%m.%Y"),
                event["start_time"].strftime("%H:%M"),
                event["end_time"].strftime("%H:%M"),
                str(event.get("type") or ""),
                event["teacher"]["full_name"] if event.get("teacher") else "",
                event["discipline"]["name"] if event.get("discipline") else "",
                event["room"]["name"] if event.get("room") else "",
                students,
                recurring.get("repeat_type") or "нет",
                "да" if event.get("has_conflict") else "нет",
            ]
        )

    output = BytesIO(build_xlsx_bytes(rows))
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="schedule.xlsx"'},
    )


@router.get("/lessons")
def get_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Lesson)
        .options(
            joinedload(Lesson.schedule)
            .joinedload(ScheduleEvent.teacher)
            .joinedload(Teacher.user),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.discipline),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.room),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.recurring),
            joinedload(Lesson.lesson_students).joinedload(LessonStudent.student),
            joinedload(Lesson.issues),
        )
    )

    teacher = get_current_teacher(db, current_user)
    if teacher:
        query = query.join(Lesson.schedule).filter(ScheduleEvent.teacher_id == teacher.id)

    lessons = query.order_by(Lesson.lesson_date.desc(), Lesson.id.desc()).all()
    return [serialize_lesson_with_details(db, lesson) for lesson in lessons]


@router.post("/lessons")
def create_lesson(
    lesson_data: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = db.query(ScheduleEvent).filter(ScheduleEvent.id == lesson_data.schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")

    ensure_teacher_can_manage_event(db, current_user, schedule)

    lesson_dict = lesson_data.model_dump()
    student_ids = lesson_dict.pop("student_ids", [])

    db_lesson = Lesson(**lesson_dict)
    db.add(db_lesson)
    db.flush()
    sync_lesson_students(db, db_lesson, student_ids)
    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="lesson",
        entity_id=db_lesson.id,
        changes={
            "lesson_type": (None, db_lesson.lesson_type),
            "max_students": (None, db_lesson.max_students),
            "student_ids": (None, serialize_student_names(db, student_ids)),
        },
        action="create",
    )
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
    db_lesson = db.query(Lesson).options(joinedload(Lesson.schedule)).filter(Lesson.id == lesson_id).first()
    if not db_lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    ensure_teacher_can_manage_event(db, current_user, db_lesson.schedule)

    update_data = lesson_data.model_dump(exclude_unset=True)
    student_ids = update_data.pop("student_ids", None)
    lesson_changes = build_lesson_changes(db, db_lesson, update_data, student_ids)

    for field, value in update_data.items():
        setattr(db_lesson, field, value)

    if student_ids is not None:
        sync_lesson_students(db, db_lesson, student_ids)

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="lesson",
        entity_id=db_lesson.id,
        changes=lesson_changes,
    )

    db.commit()
    db.refresh(db_lesson)
    return db_lesson


@router.delete("/lessons/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_lesson = db.query(Lesson).options(joinedload(Lesson.schedule)).filter(Lesson.id == lesson_id).first()
    if not db_lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")

    ensure_teacher_can_manage_event(db, current_user, db_lesson.schedule)
    db.delete(db_lesson)
    db.commit()
    return {"message": "Занятие удалено"}
