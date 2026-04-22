from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from core.access import require_admin
from core.deps import get_current_user, get_db
from models.student import Student
from models.subscription import Subscription
from models.tariff import Tariff
from models.discountRule import DiscountRule
from models.user import User
from schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionUpdate,
)


router = APIRouter(prefix="/api")


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def get_subscription_or_404(db: Session, subscription_id: int) -> Subscription:
    subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail="Абонемент не найден")
    return subscription


def calculate_subscription_pricing(db: Session, tariff_id: int, discount_id: int = None, start_date = None, end_date = None) -> dict:
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    weeks_in_duration = Decimal(str(tariff.duration_months)) * Decimal('4')  # approximate 4 weeks per month
    lessons_total = int(tariff.lessons_per_week * weeks_in_duration)
    
    price_per_lesson = Decimal(str(tariff.price_per_lesson))
    
    if discount_id:
        discount = db.query(DiscountRule).filter(DiscountRule.id == discount_id).first()
        if discount:
            if discount.type == 'percentage':
                price_per_lesson = price_per_lesson * (Decimal('1') - Decimal(str(discount.value)) / Decimal('100'))
            else:
                price_per_lesson = price_per_lesson - Decimal(str(discount.value))
    
    total_price = price_per_lesson * Decimal(str(lessons_total))
    
    return {
        'lessons_total': lessons_total,
        'balance_lessons': lessons_total,
        'price_per_lesson': price_per_lesson,
        'total_price': total_price
    }


def normalize_subscription_payload(
    data: SubscriptionCreate | SubscriptionUpdate,
    apply_defaults: bool,
    db: Session = None,
) -> dict:
    payload = data.model_dump(exclude_unset=True)

    if apply_defaults and ("status" not in payload or payload.get("status") is None):
        payload["status"] = "active"

    if "tariff_id" in payload and db:
        pricing = calculate_subscription_pricing(
            db, 
            payload["tariff_id"], 
            payload.get("discount_id"),
            payload.get("start_date"),
            payload.get("end_date")
        )
        
        for key, value in pricing.items():
            if key not in payload or payload.get(key) is None:
                payload[key] = value

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
        query = query.filter(Subscription.status == status)

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
    get_student_or_404(db, data.student_id)

    payload = normalize_subscription_payload(data, apply_defaults=True, db=db)
    new_subscription = Subscription(**payload)

    try:
        db.add(new_subscription)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Failed to create subscription: check tariff_id and discount_id",
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
    payload = normalize_subscription_payload(data, apply_defaults=False, db=db)

    if "student_id" in payload and payload["student_id"] is not None:
        get_student_or_404(db, payload["student_id"])

    for field, value in payload.items():
        setattr(subscription, field, value)

    if "tariff_id" in payload or "discount_id" in payload or "start_date" in payload or "end_date" in payload:
        pricing = calculate_subscription_pricing(
            db, 
            subscription.tariff_id, 
            subscription.discount_id,
            subscription.start_date,
            subscription.end_date
        )
        
        for key, value in pricing.items():
            setattr(subscription, key, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Failed to update subscription: check related data",
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
