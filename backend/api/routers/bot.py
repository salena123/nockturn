from datetime import date, datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.config import BOT_API_TOKEN
from core.deps import get_db
from models.lesson import Lesson
from models.lessonStudent import LessonStudent
from models.messengerLink import MessengerLink
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.subscription import Subscription
from models.teacher import Teacher
from schemas.bot import (
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

    student = db.query(Student).options(joinedload(Student.parent)).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")

    if data.parent_id is not None and student.parent_id != data.parent_id:
        raise HTTPException(status_code=400, detail="Указанное ответственное лицо не связано с учеником")

    link = (
        db.query(MessengerLink)
        .filter(MessengerLink.platform == "vk")
        .filter(MessengerLink.external_user_id == str(data.vk_user_id))
        .first()
    )
    if not link:
        link = MessengerLink(
            platform="vk",
            external_user_id=str(data.vk_user_id),
        )
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
