from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.access import require_staff
from core.deps import get_current_user, get_db
from models.lesson import Lesson
from models.lessonAttendance import LessonAttendance
from models.student import Student
from models.subscription import Subscription
from models.user import User
from schemas.attendance import AttendanceMark, AttendanceResponse, AttendanceUpdate


router = APIRouter(prefix="/api")

CHARGED_STATUSES = {"done", "miss_invalid"}
ALLOWED_STATUSES = {"done", "miss_valid", "miss_invalid"}


def get_attendance_or_404(db: Session, attendance_id: int) -> LessonAttendance:
    attendance = db.query(LessonAttendance).filter(LessonAttendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=404, detail="Запись посещаемости не найдена")
    return attendance


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def get_lesson_or_404(db: Session, lesson_id: int) -> Lesson:
    lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    return lesson


def get_subscription_or_none(db: Session, subscription_id: int | None) -> Subscription | None:
    if subscription_id is None:
        return None

    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Абонемент не найден")
    return subscription


def ensure_status_allowed(status: str) -> None:
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Некорректный статус посещаемости")


def should_charge(status: str, subscription: Subscription | None) -> bool:
    return subscription is not None and status in CHARGED_STATUSES


def charge_subscription(subscription: Subscription) -> None:
    if subscription.remaining_lessons is not None and subscription.remaining_lessons <= 0:
        raise HTTPException(status_code=400, detail="У абонемента не осталось занятий")

    if subscription.balance_lessons is not None and subscription.balance_lessons <= 0:
        raise HTTPException(status_code=400, detail="У абонемента не осталось занятий")

    if subscription.remaining_lessons is not None:
        subscription.remaining_lessons -= 1
    if subscription.balance_lessons is not None:
        subscription.balance_lessons -= 1


def refund_subscription(subscription: Subscription) -> None:
    if subscription.remaining_lessons is not None:
        subscription.remaining_lessons += 1
    if subscription.balance_lessons is not None:
        subscription.balance_lessons += 1


def resolve_price_per_lesson(
    explicit_price: float | None,
    subscription: Subscription | None,
    current_price,
):
    if explicit_price is not None:
        return Decimal(str(explicit_price))
    if subscription is not None and subscription.price_per_lesson is not None:
        return subscription.price_per_lesson
    return current_price


@router.get("/attendance", response_model=list[AttendanceResponse])
def get_attendance_records(
    student_id: int | None = None,
    subscription_id: int | None = None,
    lesson_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    query = db.query(LessonAttendance)
    if student_id is not None:
        query = query.filter(LessonAttendance.student_id == student_id)
    if subscription_id is not None:
        query = query.filter(LessonAttendance.subscription_id == subscription_id)
    if lesson_id is not None:
        query = query.filter(LessonAttendance.lesson_id == lesson_id)

    return query.order_by(LessonAttendance.id.desc()).all()


@router.get("/attendance/{attendance_id}", response_model=AttendanceResponse)
def get_attendance_record(
    attendance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    return get_attendance_or_404(db, attendance_id)


@router.post("/attendance", response_model=AttendanceResponse)
def create_attendance_record(
    data: AttendanceMark,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_status_allowed(data.status)
    get_lesson_or_404(db, data.lesson_id)
    get_student_or_404(db, data.student_id)

    subscription = get_subscription_or_none(db, data.subscription_id)
    if (
        subscription is not None
        and subscription.student_id is not None
        and subscription.student_id != data.student_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Абонемент не принадлежит указанному ученику",
        )
    is_charged = should_charge(data.status, subscription)

    if is_charged and subscription is not None:
        charge_subscription(subscription)

    attendance = LessonAttendance(
        lesson_id=data.lesson_id,
        student_id=data.student_id,
        subscription_id=data.subscription_id,
        status=data.status,
        comment=data.comment,
        price_per_lesson=resolve_price_per_lesson(data.price_per_lesson, subscription, None),
        is_charged=is_charged,
    )

    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance


@router.put("/attendance/{attendance_id}", response_model=AttendanceResponse)
def update_attendance_record(
    attendance_id: int,
    data: AttendanceUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    attendance = get_attendance_or_404(db, attendance_id)
    old_subscription = get_subscription_or_none(db, attendance.subscription_id)

    new_lesson_id = data.lesson_id if data.lesson_id is not None else attendance.lesson_id
    new_student_id = data.student_id if data.student_id is not None else attendance.student_id
    new_subscription_id = (
        data.subscription_id if data.subscription_id is not None else attendance.subscription_id
    )
    new_status = data.status if data.status is not None else attendance.status

    ensure_status_allowed(new_status)
    get_lesson_or_404(db, new_lesson_id)
    get_student_or_404(db, new_student_id)
    new_subscription = get_subscription_or_none(db, new_subscription_id)
    if (
        new_subscription is not None
        and new_subscription.student_id is not None
        and new_subscription.student_id != new_student_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Абонемент не принадлежит указанному ученику",
        )

    if attendance.is_charged and old_subscription is not None:
        refund_subscription(old_subscription)

    new_is_charged = should_charge(new_status, new_subscription)
    if new_is_charged and new_subscription is not None:
        charge_subscription(new_subscription)

    attendance.lesson_id = new_lesson_id
    attendance.student_id = new_student_id
    attendance.subscription_id = new_subscription_id
    attendance.status = new_status
    if data.comment is not None:
        attendance.comment = data.comment
    attendance.price_per_lesson = resolve_price_per_lesson(
        data.price_per_lesson,
        new_subscription,
        attendance.price_per_lesson,
    )
    attendance.is_charged = new_is_charged

    db.commit()
    db.refresh(attendance)
    return attendance


@router.delete("/attendance/{attendance_id}")
def delete_attendance_record(
    attendance_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    attendance = get_attendance_or_404(db, attendance_id)
    subscription = get_subscription_or_none(db, attendance.subscription_id)

    if attendance.is_charged and subscription is not None:
        refund_subscription(subscription)

    db.delete(attendance)
    db.commit()
    return {"message": "Запись посещаемости успешно удалена"}
