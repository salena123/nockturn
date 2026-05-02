from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.access import require_admin
from core.deps import get_current_user, get_db
from models.discountRule import DiscountRule
from models.student import Student
from models.subscription import Subscription
from models.tariff import Tariff
from models.user import User
from schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)


router = APIRouter(prefix="/api")

ALLOWED_SUBSCRIPTION_STATUSES = {"active", "frozen", "expired"}


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def get_tariff_or_404(db: Session, tariff_id: int) -> Tariff:
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Тариф не найден")
    return tariff


def get_discount_or_404(db: Session, discount_id: int) -> DiscountRule:
    discount = db.query(DiscountRule).filter(DiscountRule.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Скидка не найдена")
    return discount


def get_subscription_or_404(db: Session, subscription_id: int) -> Subscription:
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Абонемент не найден")
    return subscription


def normalize_status(status: str | None, *, default: str = "active") -> str:
    normalized = (status or default).strip().lower()
    if normalized not in ALLOWED_SUBSCRIPTION_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Некорректный статус абонемента. Допустимые значения: {', '.join(sorted(ALLOWED_SUBSCRIPTION_STATUSES))}",
        )
    return normalized


def validate_dates(start_date: date | None, end_date: date | None) -> None:
    if start_date and end_date and end_date < start_date:
        raise HTTPException(
            status_code=400,
            detail="Дата окончания абонемента не может быть раньше даты начала",
        )


def validate_freeze_window(
    *,
    status: str,
    freeze_start_date: date | None,
    freeze_end_date: date | None,
    subscription_start_date: date | None,
) -> None:
    if status != "frozen":
        return

    if freeze_start_date is None or freeze_end_date is None:
        raise HTTPException(
            status_code=400,
            detail="Для заморозки нужно указать даты начала и окончания",
        )

    if freeze_end_date < freeze_start_date:
        raise HTTPException(
            status_code=400,
            detail="Дата окончания заморозки не может быть раньше даты начала",
        )

    if subscription_start_date and freeze_start_date < subscription_start_date:
        raise HTTPException(
            status_code=400,
            detail="Заморозка не может начинаться раньше даты начала абонемента",
        )

    freeze_days = (freeze_end_date - freeze_start_date).days + 1
    if freeze_days > 30:
        raise HTTPException(
            status_code=400,
            detail="Заморозка абонемента не может превышать 30 дней",
        )


def calculate_subscription_pricing(
    db: Session,
    *,
    tariff_id: int,
    discount_id: int | None = None,
) -> dict[str, Decimal | int]:
    tariff = get_tariff_or_404(db, tariff_id)

    lessons_total = int(tariff.lessons_per_week * tariff.duration_months * 4)
    price_per_lesson = Decimal(str(tariff.price_per_lesson))

    if discount_id is not None:
        discount = get_discount_or_404(db, discount_id)
        if discount.type == "percentage":
            price_per_lesson = price_per_lesson * (
                Decimal("1") - Decimal(str(discount.value)) / Decimal("100")
            )
        else:
            price_per_lesson = price_per_lesson - Decimal(str(discount.value))

    if price_per_lesson <= 0:
        raise HTTPException(
            status_code=400,
            detail="Итоговая стоимость занятия должна быть больше 0",
        )

    total_price = price_per_lesson * Decimal(str(lessons_total))
    return {
        "lessons_total": lessons_total,
        "balance_lessons": lessons_total,
        "price_per_lesson": price_per_lesson,
        "total_price": total_price,
    }


def build_subscription_payload(
    data: SubscriptionCreate | SubscriptionUpdate,
    *,
    db: Session,
    current: Subscription | None = None,
) -> dict:
    payload = data.model_dump(exclude_unset=True)

    student_id = payload.get("student_id", current.student_id if current else None)
    tariff_id = payload.get("tariff_id", current.tariff_id if current else None)
    discount_id = payload.get("discount_id", current.discount_id if current else None)
    start_date = payload.get("start_date", current.start_date if current else None)
    end_date = payload.get("end_date", current.end_date if current else None)
    status = normalize_status(payload.get("status"), default=current.status if current else "active")

    if student_id is None:
        raise HTTPException(status_code=400, detail="Нужно указать ученика")
    if tariff_id is None:
        raise HTTPException(status_code=400, detail="Нужно указать тариф")

    get_student_or_404(db, student_id)
    get_tariff_or_404(db, tariff_id)
    if discount_id is not None:
        get_discount_or_404(db, discount_id)

    validate_dates(start_date, end_date)
    validate_freeze_window(
        status=status,
        freeze_start_date=payload.get("freeze_start_date", current.freeze_start_date if current else None),
        freeze_end_date=payload.get("freeze_end_date", current.freeze_end_date if current else None),
        subscription_start_date=start_date,
    )

    pricing = calculate_subscription_pricing(
        db,
        tariff_id=tariff_id,
        discount_id=discount_id,
    )

    if status != "frozen":
        payload["freeze_start_date"] = None
        payload["freeze_end_date"] = None
        payload["freeze_reason"] = None

    payload["student_id"] = student_id
    payload["tariff_id"] = tariff_id
    payload["discount_id"] = discount_id
    payload["status"] = status
    payload["lessons_total"] = pricing["lessons_total"]
    payload["price_per_lesson"] = pricing["price_per_lesson"]
    payload["total_price"] = pricing["total_price"]

    if current is None:
        payload.setdefault("balance_lessons", pricing["balance_lessons"])
    elif "balance_lessons" not in payload and current.balance_lessons is None:
        payload["balance_lessons"] = pricing["balance_lessons"]

    return payload


@router.get("/subscriptions", response_model=list[SubscriptionResponse])
def get_subscriptions(
    student_id: int | None = None,
    status: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    query = db.query(Subscription)

    if student_id is not None:
        query = query.filter(Subscription.student_id == student_id)
    if status is not None:
        query = query.filter(Subscription.status == normalize_status(status))

    return query.order_by(Subscription.created_at.desc(), Subscription.id.desc()).all()


@router.get("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
def get_subscription(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return get_subscription_or_404(db, subscription_id)


@router.post("/subscriptions", response_model=SubscriptionResponse)
def create_subscription(
    data: SubscriptionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    payload = build_subscription_payload(data, db=db)
    new_subscription = Subscription(**payload)

    try:
        db.add(new_subscription)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Не удалось создать абонемент: проверьте связанные данные",
        )

    db.refresh(new_subscription)
    return new_subscription


@router.put("/subscriptions/{subscription_id}", response_model=SubscriptionResponse)
def update_subscription(
    subscription_id: int,
    data: SubscriptionUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    subscription = get_subscription_or_404(db, subscription_id)
    payload = build_subscription_payload(data, db=db, current=subscription)

    for field, value in payload.items():
        setattr(subscription, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Не удалось обновить абонемент: проверьте связанные данные",
        )

    db.refresh(subscription)
    return subscription


@router.delete("/subscriptions/{subscription_id}")
def delete_subscription(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    subscription = get_subscription_or_404(db, subscription_id)

    try:
        db.delete(subscription)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Нельзя удалить абонемент, который уже связан с оплатами или посещаемостью",
        )

    return {"message": "Абонемент успешно удален"}
