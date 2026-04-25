from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.access import require_staff
from core.deps import get_current_user, get_db
from models.lesson import Lesson
from models.lessonAttendance import LessonAttendance
from models.lessonIssue import LessonIssue
from models.lessonStudent import LessonStudent
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.subscription import Subscription
from models.teacher import Teacher
from models.user import User
from schemas.attendance import AttendanceMark, AttendanceResponse, AttendanceUpdate
from schemas.lesson_issue import LessonIssueCreate, LessonIssueResponse


router = APIRouter(prefix="/api")

CHARGED_STATUSES = {"done", "miss_invalid"}
ALLOWED_STATUSES = {"done", "miss_valid", "miss_invalid"}


def is_teacher_user(user: User) -> bool:
    return getattr(getattr(user, "role", None), "name", None) == "teacher"


def get_teacher_for_current_user(db: Session, current_user: User) -> Teacher | None:
    if not is_teacher_user(current_user):
        return None
    return db.query(Teacher).filter(Teacher.user_id == current_user.id).first()


def get_lesson_query(db: Session):
    return db.query(Lesson).options(
        joinedload(Lesson.schedule).joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
        joinedload(Lesson.schedule).joinedload(ScheduleEvent.room),
        joinedload(Lesson.schedule).joinedload(ScheduleEvent.discipline),
        joinedload(Lesson.lesson_students).joinedload(LessonStudent.student),
    )


def get_attendance_query(db: Session):
    return db.query(LessonAttendance).options(
        joinedload(LessonAttendance.student),
        joinedload(LessonAttendance.subscription),
        joinedload(LessonAttendance.lesson)
        .joinedload(Lesson.schedule)
        .joinedload(ScheduleEvent.teacher)
        .joinedload(Teacher.user),
        joinedload(LessonAttendance.lesson).joinedload(Lesson.schedule).joinedload(ScheduleEvent.room),
        joinedload(LessonAttendance.lesson)
        .joinedload(Lesson.schedule)
        .joinedload(ScheduleEvent.discipline),
    )


def get_attendance_or_404(db: Session, attendance_id: int) -> LessonAttendance:
    attendance = get_attendance_query(db).filter(LessonAttendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Запись посещаемости не найдена")
    return attendance


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def get_lesson_or_404(db: Session, lesson_id: int) -> Lesson:
    lesson = get_lesson_query(db).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


def resolve_student_subscription(
    db: Session,
    student_id: int,
    lesson_date: date | None,
) -> Subscription | None:
    query = db.query(Subscription).filter(Subscription.student_id == student_id)

    if lesson_date is not None:
        query = query.filter(
            (Subscription.start_date.is_(None)) | (Subscription.start_date <= lesson_date)
        ).filter(
            (Subscription.end_date.is_(None)) | (Subscription.end_date >= lesson_date)
        )

    subscriptions = query.order_by(Subscription.created_at.desc(), Subscription.id.desc()).all()
    if not subscriptions:
        return None

    def sort_key(subscription: Subscription):
        return (
            subscription.start_date or date.min,
            subscription.created_at or datetime.min,
            subscription.id or 0,
        )

    active_with_balance = [
        subscription
        for subscription in subscriptions
        if subscription.status == "active"
        and (subscription.balance_lessons is None or subscription.balance_lessons > 0)
    ]
    if active_with_balance:
        return sorted(active_with_balance, key=sort_key, reverse=True)[0]

    active_subscriptions = [
        subscription for subscription in subscriptions if subscription.status == "active"
    ]
    if active_subscriptions:
        return sorted(active_subscriptions, key=sort_key, reverse=True)[0]

    with_balance = [
        subscription
        for subscription in subscriptions
        if subscription.balance_lessons is None or subscription.balance_lessons > 0
    ]
    if with_balance:
        return sorted(with_balance, key=sort_key, reverse=True)[0]

    return sorted(subscriptions, key=sort_key, reverse=True)[0]


def get_lesson_issue_or_404(db: Session, issue_id: int) -> LessonIssue:
    issue = db.query(LessonIssue).filter(LessonIssue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Проблема занятия не найдена")
    return issue


def ensure_status_allowed(status: str) -> None:
    if status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Некорректный статус посещаемости. Допустимые значения: done, miss_valid, miss_invalid",
        )


def should_charge(status: str) -> bool:
    return status in CHARGED_STATUSES


def ensure_subscription_for_charge(status: str, subscription: Subscription | None) -> None:
    if should_charge(status) and subscription is None:
        raise HTTPException(
            status_code=400,
            detail="Для этого занятия не найден подходящий абонемент ученика на дату урока",
        )
    if should_charge(status) and subscription is not None and subscription.price_per_lesson is None:
        raise HTTPException(
            status_code=400,
            detail="В абонементе ученика не указана стоимость занятия по договору",
        )


def charge_subscription(subscription: Subscription) -> None:
    remaining = getattr(subscription, "remaining_lessons", None)
    balance = subscription.balance_lessons

    if remaining is not None and remaining <= 0:
        raise HTTPException(status_code=400, detail="У абонемента не осталось занятий")
    if balance is not None and balance <= 0:
        raise HTTPException(status_code=400, detail="У абонемента не осталось занятий")

    if remaining is not None:
        subscription.remaining_lessons = remaining - 1
    if balance is not None:
        subscription.balance_lessons -= 1


def refund_subscription(subscription: Subscription) -> None:
    remaining = getattr(subscription, "remaining_lessons", None)
    if remaining is not None:
        subscription.remaining_lessons = remaining + 1
    if subscription.balance_lessons is not None:
        subscription.balance_lessons += 1


def resolve_price_per_lesson(subscription: Subscription | None, current_price):
    if subscription is not None and subscription.price_per_lesson is not None:
        return Decimal(str(subscription.price_per_lesson))
    return current_price


def ensure_lesson_access(db: Session, current_user: User, lesson_id: int) -> Lesson:
    lesson = get_lesson_or_404(db, lesson_id)
    teacher = get_teacher_for_current_user(db, current_user)

    if teacher is None:
        return lesson

    if not lesson.schedule or lesson.schedule.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому занятию")

    return lesson


def ensure_attendance_access(db: Session, current_user: User, attendance_id: int) -> LessonAttendance:
    attendance = get_attendance_or_404(db, attendance_id)
    teacher = get_teacher_for_current_user(db, current_user)

    if teacher is None:
        return attendance

    lesson = attendance.lesson
    if not lesson or not lesson.schedule or lesson.schedule.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этой записи посещаемости")

    return attendance


def ensure_student_matches_lesson(lesson: Lesson, student_id: int) -> None:
    lesson_student_ids = [link.student_id for link in lesson.lesson_students]
    if lesson_student_ids and student_id not in lesson_student_ids:
        raise HTTPException(
            status_code=400,
            detail="Ученик не привязан к выбранному занятию",
        )


def ensure_unique_attendance(
    db: Session,
    lesson_id: int,
    student_id: int,
    exclude_attendance_id: int | None = None,
) -> None:
    query = (
        db.query(LessonAttendance)
        .filter(LessonAttendance.lesson_id == lesson_id)
        .filter(LessonAttendance.student_id == student_id)
    )
    if exclude_attendance_id is not None:
        query = query.filter(LessonAttendance.id != exclude_attendance_id)

    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Для этого ученика уже есть отметка посещаемости по выбранному занятию",
        )


def serialize_attendance(attendance: LessonAttendance) -> AttendanceResponse:
    lesson = attendance.lesson
    schedule = lesson.schedule if lesson else None
    teacher = schedule.teacher if schedule else None
    teacher_user = teacher.user if teacher else None

    start_time = schedule.start_time if schedule else None
    end_time = schedule.end_time if schedule else None
    lesson_label = None
    if lesson and schedule and start_time and end_time:
        lesson_label = (
            f"#{lesson.id} • {start_time.strftime('%d.%m.%Y %H:%M')}"
            f" - {end_time.strftime('%H:%M')}"
        )

    return AttendanceResponse(
        id=attendance.id,
        lesson_id=attendance.lesson_id,
        student_id=attendance.student_id,
        subscription_id=attendance.subscription_id,
        status=attendance.status,
        comment=attendance.comment,
        price_per_lesson=attendance.price_per_lesson,
        is_charged=bool(attendance.is_charged),
        student_name=attendance.student.fio if attendance.student else None,
        lesson_label=lesson_label,
        lesson_date=lesson.lesson_date if lesson else None,
        lesson_type=lesson.lesson_type if lesson else None,
        teacher_name=(teacher_user.full_name or teacher_user.login) if teacher_user else None,
        room_name=schedule.room.name if schedule and schedule.room else None,
        discipline_name=schedule.discipline.name if schedule and schedule.discipline else None,
        subscription_balance=attendance.subscription.balance_lessons if attendance.subscription else None,
    )


@router.get("/attendance", response_model=list[AttendanceResponse])
def get_attendance_records(
    student_id: int | None = None,
    subscription_id: int | None = None,
    lesson_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    query = get_attendance_query(db)
    teacher = get_teacher_for_current_user(db, current_user)

    if teacher is not None:
        query = (
            query.join(LessonAttendance.lesson)
            .join(Lesson.schedule)
            .filter(ScheduleEvent.teacher_id == teacher.id)
        )

    if student_id is not None:
        query = query.filter(LessonAttendance.student_id == student_id)
    if subscription_id is not None:
        query = query.filter(LessonAttendance.subscription_id == subscription_id)
    if lesson_id is not None:
        query = query.filter(LessonAttendance.lesson_id == lesson_id)

    records = query.order_by(LessonAttendance.id.desc()).all()
    return [serialize_attendance(record) for record in records]


@router.get("/attendance/{attendance_id}", response_model=AttendanceResponse)
def get_attendance_record(
    attendance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    attendance = ensure_attendance_access(db, current_user, attendance_id)
    return serialize_attendance(attendance)


@router.post("/attendance", response_model=AttendanceResponse)
def create_attendance_record(
    data: AttendanceMark,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_status_allowed(data.status)

    lesson = ensure_lesson_access(db, current_user, data.lesson_id)
    get_student_or_404(db, data.student_id)
    ensure_student_matches_lesson(lesson, data.student_id)
    ensure_unique_attendance(db, data.lesson_id, data.student_id)

    subscription = resolve_student_subscription(db, data.student_id, lesson.lesson_date)
    ensure_subscription_for_charge(data.status, subscription)

    is_charged = should_charge(data.status)
    if is_charged and subscription is not None:
        charge_subscription(subscription)

    attendance = LessonAttendance(
        lesson_id=data.lesson_id,
        student_id=data.student_id,
        subscription_id=subscription.id if subscription else None,
        status=data.status,
        comment=data.comment,
        price_per_lesson=resolve_price_per_lesson(subscription, None),
        is_charged=is_charged,
    )

    db.add(attendance)
    db.commit()
    attendance = get_attendance_or_404(db, attendance.id)
    return serialize_attendance(attendance)


@router.put("/attendance/{attendance_id}", response_model=AttendanceResponse)
def update_attendance_record(
    attendance_id: int,
    data: AttendanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    attendance = ensure_attendance_access(db, current_user, attendance_id)
    old_subscription = attendance.subscription

    new_lesson_id = data.lesson_id if data.lesson_id is not None else attendance.lesson_id
    new_student_id = data.student_id if data.student_id is not None else attendance.student_id
    new_status = data.status if data.status is not None else attendance.status

    ensure_status_allowed(new_status)
    lesson = ensure_lesson_access(db, current_user, new_lesson_id)
    get_student_or_404(db, new_student_id)
    ensure_student_matches_lesson(lesson, new_student_id)
    ensure_unique_attendance(db, new_lesson_id, new_student_id, exclude_attendance_id=attendance.id)

    new_subscription = resolve_student_subscription(db, new_student_id, lesson.lesson_date)
    ensure_subscription_for_charge(new_status, new_subscription)

    if attendance.is_charged and old_subscription is not None:
        refund_subscription(old_subscription)

    new_is_charged = should_charge(new_status)
    if new_is_charged and new_subscription is not None:
        charge_subscription(new_subscription)

    attendance.lesson_id = new_lesson_id
    attendance.student_id = new_student_id
    attendance.subscription_id = new_subscription.id if new_subscription else None
    attendance.status = new_status
    attendance.comment = data.comment if data.comment is not None else attendance.comment
    attendance.price_per_lesson = resolve_price_per_lesson(new_subscription, attendance.price_per_lesson)
    attendance.is_charged = new_is_charged

    db.commit()
    attendance = get_attendance_or_404(db, attendance.id)
    return serialize_attendance(attendance)


@router.delete("/attendance/{attendance_id}")
def delete_attendance_record(
    attendance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    attendance = ensure_attendance_access(db, current_user, attendance_id)
    subscription = attendance.subscription

    if attendance.is_charged and subscription is not None:
        refund_subscription(subscription)

    db.delete(attendance)
    db.commit()
    return {"message": "Запись посещаемости успешно удалена"}


@router.get("/lessons/{lesson_id}/issues", response_model=list[LessonIssueResponse])
def get_lesson_issues(
    lesson_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_lesson_access(db, current_user, lesson_id)

    return (
        db.query(LessonIssue)
        .filter(LessonIssue.lesson_id == lesson_id)
        .order_by(LessonIssue.created_at.desc(), LessonIssue.id.desc())
        .all()
    )


@router.post("/lessons/{lesson_id}/issues", response_model=LessonIssueResponse)
def create_lesson_issue(
    lesson_id: int,
    data: LessonIssueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_lesson_access(db, current_user, lesson_id)

    description = (data.description or "").strip()
    if not description:
        raise HTTPException(status_code=400, detail="Опишите проблему на занятии")

    issue = LessonIssue(lesson_id=lesson_id, description=description)
    db.add(issue)
    db.commit()
    db.refresh(issue)
    return issue


@router.delete("/lesson-issues/{issue_id}")
def delete_lesson_issue(
    issue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    issue = get_lesson_issue_or_404(db, issue_id)
    ensure_lesson_access(db, current_user, issue.lesson_id)
    db.delete(issue)
    db.commit()
    return {"message": "Проблема занятия удалена"}
