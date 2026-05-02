from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload

from api.routers.attendance import (
    charge_subscription,
    ensure_subscription_for_charge,
    resolve_price_per_lesson,
    resolve_student_subscription,
)
from core.config import BOT_API_TOKEN
from core.deps import get_db
from models.lesson import Lesson
from models.lessonAttendance import LessonAttendance
from models.lessonStudent import LessonStudent
from models.messengerLink import MessengerLink
from models.notification import Notification
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.subscription import Subscription
from models.teacher import Teacher
from schemas.bot import (
    BotAbsenceReportRequest,
    BotAbsenceReportResponse,
    BotLinkCreateRequest,
    BotLinkResponse,
    BotPhoneResolveMatch,
    BotPhoneResolveRequest,
    BotPhoneResolveResponse,
    BotScheduleItem,
    BotScheduleResponse,
    BotSubscriptionResponse,
)


router = APIRouter(prefix="/api/bot")

ABSENCE_TRANSFER_NOTICE_HOURS = 1


def ensure_bot_token(x_bot_token: str | None) -> None:
    if not BOT_API_TOKEN:
        raise HTTPException(status_code=500, detail="Не настроен BOT_API_TOKEN")
    if x_bot_token != BOT_API_TOKEN:
        raise HTTPException(status_code=403, detail="Некорректный токен бота")


def normalize_phone(value: str | None) -> str:
    digits = "".join(char for char in str(value or "") if char.isdigit())
    if len(digits) == 11 and digits.startswith("8"):
        return f"7{digits[1:]}"
    return digits


def create_notification(
    db: Session,
    *,
    student_id: int | None,
    text: str,
    notification_type: str,
) -> Notification:
    notification = Notification(
        student_id=student_id,
        text=text,
        type=notification_type,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.flush()
    return notification


def get_linked_student_or_404(db: Session, vk_user_id: int) -> Student:
    link = (
        db.query(MessengerLink)
        .options(joinedload(MessengerLink.student).joinedload(Student.parent))
        .filter(MessengerLink.platform == "vk")
        .filter(MessengerLink.external_user_id == str(vk_user_id))
        .filter(MessengerLink.is_confirmed.is_(True))
        .first()
    )
    if not link or not link.student:
        raise HTTPException(status_code=404, detail="Пользователь VK не привязан к ученику")
    return link.student


def get_lesson_for_bot_or_404(db: Session, lesson_id: int) -> Lesson:
    lesson = (
        db.query(Lesson)
        .options(
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.discipline),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.room),
            joinedload(Lesson.lesson_students).joinedload(LessonStudent.student),
        )
        .filter(Lesson.id == lesson_id)
        .first()
    )
    if not lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


def get_existing_attendance(db: Session, lesson_id: int, student_id: int) -> LessonAttendance | None:
    return (
        db.query(LessonAttendance)
        .filter(LessonAttendance.lesson_id == lesson_id)
        .filter(LessonAttendance.student_id == student_id)
        .first()
    )


def ensure_student_in_lesson(lesson: Lesson, student_id: int) -> None:
    student_ids = [link.student_id for link in lesson.lesson_students]
    if student_ids and student_id not in student_ids:
        raise HTTPException(status_code=403, detail="Это занятие не относится к указанному ученику")


def serialize_schedule_item(lesson: Lesson) -> BotScheduleItem:
    schedule = lesson.schedule
    teacher_name = None
    if schedule and schedule.teacher and schedule.teacher.user:
        teacher_name = schedule.teacher.user.full_name or schedule.teacher.user.login

    return BotScheduleItem(
        lesson_id=lesson.id,
        event_id=schedule.id if schedule else 0,
        start_time=schedule.start_time if schedule else datetime.now(),
        end_time=schedule.end_time if schedule else datetime.now(),
        teacher_name=teacher_name,
        discipline_name=schedule.discipline.name if schedule and schedule.discipline else None,
        room_name=schedule.room.name if schedule and schedule.room else None,
    )


def build_absence_comment(reason: str, comment: str | None, reported_at: datetime) -> str:
    parts = [
        f"Сообщение о пропуске из бота",
        f"Причина: {reason}",
        f"Сообщено: {reported_at.strftime('%d.%m.%Y %H:%M')}",
    ]
    cleaned_comment = (comment or "").strip()
    if cleaned_comment:
        parts.append(f"Комментарий: {cleaned_comment}")
    return "\n".join(parts)


@router.post("/vk/resolve-phone", response_model=BotPhoneResolveResponse)
def resolve_vk_phone(
    data: BotPhoneResolveRequest,
    x_bot_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ensure_bot_token(x_bot_token)

    normalized_phone = normalize_phone(data.phone)
    if not normalized_phone:
        raise HTTPException(status_code=400, detail="Нужно указать номер телефона")

    students = db.query(Student).options(joinedload(Student.parent)).all()
    matches: list[BotPhoneResolveMatch] = []
    seen_student_ids: set[int] = set()

    for student in students:
        student_phone = normalize_phone(student.phone)
        parent_phone = normalize_phone(student.parent.phone if student.parent else None)

        if student_phone == normalized_phone and student.id not in seen_student_ids:
            matches.append(
                BotPhoneResolveMatch(
                    student_id=student.id,
                    fio=student.fio,
                    parent_id=student.parent.id if student.parent else None,
                    parent_name=student.parent.full_name if student.parent else student.parent_name,
                    relation="student_phone",
                )
            )
            seen_student_ids.add(student.id)
            continue

        if parent_phone == normalized_phone and student.id not in seen_student_ids:
            matches.append(
                BotPhoneResolveMatch(
                    student_id=student.id,
                    fio=student.fio,
                    parent_id=student.parent.id if student.parent else None,
                    parent_name=student.parent.full_name if student.parent else student.parent_name,
                    relation="parent_phone",
                )
            )
            seen_student_ids.add(student.id)

    return BotPhoneResolveResponse(normalized_phone=normalized_phone, matches=matches)


@router.post("/vk/link", response_model=BotLinkResponse)
def create_vk_link(
    data: BotLinkCreateRequest,
    x_bot_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ensure_bot_token(x_bot_token)

    student = (
        db.query(Student)
        .options(joinedload(Student.parent))
        .filter(Student.id == data.student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")

    if data.parent_id is not None and student.parent_id != data.parent_id:
        raise HTTPException(
            status_code=400,
            detail="Указанное ответственное лицо не связано с учеником",
        )

    link = (
        db.query(MessengerLink)
        .filter(MessengerLink.platform == "vk")
        .filter(MessengerLink.external_user_id == str(data.vk_user_id))
        .first()
    )
    if not link:
        link = MessengerLink(platform="vk", external_user_id=str(data.vk_user_id))
        db.add(link)

    link.student_id = student.id
    link.parent_id = data.parent_id if data.parent_id is not None else student.parent_id
    link.phone = normalize_phone(data.phone) if data.phone else None
    link.is_confirmed = True

    db.commit()
    db.refresh(link)

    return BotLinkResponse(
        linked=True,
        platform="vk",
        vk_user_id=data.vk_user_id,
        student_id=student.id,
        student_name=student.fio,
        parent_id=link.parent_id,
        parent_name=student.parent.full_name if student.parent else student.parent_name,
    )


@router.get("/vk/profile/{vk_user_id}", response_model=BotLinkResponse)
def get_vk_profile(
    vk_user_id: int,
    x_bot_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ensure_bot_token(x_bot_token)

    link = (
        db.query(MessengerLink)
        .options(joinedload(MessengerLink.student).joinedload(Student.parent))
        .filter(MessengerLink.platform == "vk")
        .filter(MessengerLink.external_user_id == str(vk_user_id))
        .filter(MessengerLink.is_confirmed.is_(True))
        .first()
    )
    if not link or not link.student:
        raise HTTPException(status_code=404, detail="Пользователь VK не привязан")

    student = link.student
    return BotLinkResponse(
        linked=True,
        platform="vk",
        vk_user_id=vk_user_id,
        student_id=student.id,
        student_name=student.fio,
        parent_id=link.parent_id,
        parent_name=student.parent.full_name if student.parent else student.parent_name,
    )


@router.get("/vk/subscription/{vk_user_id}", response_model=BotSubscriptionResponse)
def get_vk_subscription(
    vk_user_id: int,
    x_bot_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ensure_bot_token(x_bot_token)

    student = get_linked_student_or_404(db, vk_user_id)
    today = date.today()

    subscriptions = (
        db.query(Subscription)
        .filter(Subscription.student_id == student.id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
        .all()
    )

    active_subscription = None
    for subscription in subscriptions:
        status = str(subscription.status or "").strip().lower()
        started = not subscription.start_date or subscription.start_date <= today
        not_ended = not subscription.end_date or subscription.end_date >= today
        has_balance = (subscription.balance_lessons or 0) > 0
        if status == "active" or (started and not_ended and has_balance):
            active_subscription = subscription
            break

    return BotSubscriptionResponse(
        student_id=student.id,
        student_name=student.fio,
        subscription_id=active_subscription.id if active_subscription else None,
        balance_lessons=active_subscription.balance_lessons if active_subscription else None,
        end_date=active_subscription.end_date if active_subscription else None,
        status=active_subscription.status if active_subscription else None,
        tariff_id=active_subscription.tariff_id if active_subscription else None,
    )


@router.get("/vk/schedule/{vk_user_id}", response_model=BotScheduleResponse)
def get_vk_schedule(
    vk_user_id: int,
    x_bot_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ensure_bot_token(x_bot_token)

    student = get_linked_student_or_404(db, vk_user_id)
    now = datetime.now()

    lessons = (
        db.query(Lesson)
        .options(
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.discipline),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.room),
        )
        .join(Lesson.lesson_students)
        .join(Lesson.schedule)
        .filter(LessonStudent.student_id == student.id)
        .filter(ScheduleEvent.start_time >= now)
        .order_by(ScheduleEvent.start_time.asc(), Lesson.id.asc())
        .limit(10)
        .all()
    )

    return BotScheduleResponse(
        student_id=student.id,
        student_name=student.fio,
        items=[serialize_schedule_item(lesson) for lesson in lessons],
    )


@router.post("/vk/absence/{vk_user_id}", response_model=BotAbsenceReportResponse)
def report_vk_absence(
    vk_user_id: int,
    data: BotAbsenceReportRequest,
    x_bot_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    ensure_bot_token(x_bot_token)

    student = get_linked_student_or_404(db, vk_user_id)
    lesson = get_lesson_for_bot_or_404(db, data.lesson_id)
    ensure_student_in_lesson(lesson, student.id)

    if not lesson.schedule or not lesson.schedule.start_time:
        raise HTTPException(status_code=400, detail="У занятия не указано время начала")

    lesson_start_time = lesson.schedule.start_time
    reported_at = datetime.now()

    if lesson_start_time <= reported_at:
        raise HTTPException(
            status_code=400,
            detail="Нельзя сообщить о пропуске после начала занятия",
        )

    existing_attendance = get_existing_attendance(db, lesson.id, student.id)
    if existing_attendance is not None:
        raise HTTPException(
            status_code=400,
            detail="По этому занятию уже зафиксирована посещаемость или пропуск",
        )

    can_transfer = (lesson_start_time - reported_at) >= timedelta(
        hours=ABSENCE_TRANSFER_NOTICE_HOURS
    )
    status = "miss_valid" if can_transfer else "miss_invalid"

    subscription = resolve_student_subscription(db, student.id, lesson.lesson_date)
    ensure_subscription_for_charge(status, subscription)

    is_charged = status == "miss_invalid"
    if is_charged and subscription is not None:
        charge_subscription(subscription)

    attendance = LessonAttendance(
        lesson_id=lesson.id,
        student_id=student.id,
        subscription_id=subscription.id if subscription else None,
        status=status,
        comment=build_absence_comment(data.reason, data.comment, reported_at),
        price_per_lesson=resolve_price_per_lesson(subscription, None),
        is_charged=is_charged,
    )
    db.add(attendance)
    db.flush()

    if can_transfer:
        message = (
            f"У ученика {student.fio} уважительный пропуск по занятию #{lesson.id} "
            f"от {lesson.lesson_date}. Требуется перенос."
        )
        notification_type = "attendance_reschedule_required"
        response_message = (
            "Пропуск зафиксирован как уважительный. Занятие не будет списано, "
            "администратору отправлено уведомление о переносе."
        )
    else:
        message = (
            f"У ученика {student.fio} позднее сообщение о пропуске по занятию #{lesson.id} "
            f"от {lesson.lesson_date}. Отмечено как неуважительный пропуск."
        )
        notification_type = "attendance_reported_late"
        response_message = (
            "Пропуск зафиксирован позднее чем за 1 час до занятия. "
            "Он отмечен как неуважительный, занятие будет списано по правилам абонемента."
        )

    create_notification(
        db,
        student_id=student.id,
        text=message,
        notification_type=notification_type,
    )
    db.commit()

    return BotAbsenceReportResponse(
        student_id=student.id,
        student_name=student.fio,
        lesson_id=lesson.id,
        attendance_id=attendance.id,
        status=status,
        notified_at=reported_at,
        can_transfer=can_transfer,
        lesson_start_time=lesson_start_time,
        message=response_message,
    )
