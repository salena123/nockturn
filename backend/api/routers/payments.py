from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.access import require_admin
from core.deps import get_current_user, get_db
from models.payment import Payment
from models.student import Student
from models.subscription import Subscription
from models.user import User
from schemas.payment import PaymentCreate, PaymentResponse, PaymentUpdate


router = APIRouter(prefix="/api")


def get_payment_or_404(db: Session, payment_id: int) -> Payment:
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Платеж не найден")
    return payment


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


def resolve_payment_links(
    db: Session,
    *,
    student_id: int | None,
    subscription_id: int | None,
) -> tuple[int | None, int | None, int | None]:
    if student_id is None and subscription_id is None:
        raise HTTPException(
            status_code=400,
            detail="Нужно указать ученика или абонемент для платежа",
        )

    resolved_student_id = student_id
    balance_snapshot = None

    if subscription_id is not None:
        subscription = get_subscription_or_404(db, subscription_id)
        if (
            resolved_student_id is not None
            and subscription.student_id is not None
            and subscription.student_id != resolved_student_id
        ):
            raise HTTPException(
                status_code=400,
                detail="Абонемент не принадлежит указанному ученику",
            )
        if resolved_student_id is None:
            resolved_student_id = subscription.student_id
        balance_snapshot = subscription.balance_lessons

    if resolved_student_id is not None:
        get_student_or_404(db, resolved_student_id)

    return resolved_student_id, subscription_id, balance_snapshot


@router.get("/payments", response_model=list[PaymentResponse])
def get_payments(
    student_id: int | None = None,
    subscription_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    query = db.query(Payment)
    if student_id is not None:
        query = query.filter(Payment.student_id == student_id)
    if subscription_id is not None:
        query = query.filter(Payment.subscription_id == subscription_id)

    return query.order_by(Payment.paid_at.desc(), Payment.id.desc()).all()


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return get_payment_or_404(db, payment_id)


@router.get("/subscriptions/{subscription_id}/payments", response_model=list[PaymentResponse])
def get_subscription_payments(
    subscription_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_subscription_or_404(db, subscription_id)

    return (
        db.query(Payment)
        .filter(Payment.subscription_id == subscription_id)
        .order_by(Payment.paid_at.desc(), Payment.id.desc())
        .all()
    )


@router.post("/payments", response_model=PaymentResponse)
def create_payment(
    data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    student_id, subscription_id, balance_snapshot = resolve_payment_links(
        db,
        student_id=data.student_id,
        subscription_id=data.subscription_id,
    )

    payment = Payment(
        student_id=student_id,
        subscription_id=subscription_id,
        amount=data.amount,
        method=data.method,
        paid_at=data.paid_at,
        comment=data.comment,
        status=data.status or "paid",
        subscription_balance_snapshot=balance_snapshot,
    )

    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


@router.put("/payments/{payment_id}", response_model=PaymentResponse)
def update_payment(
    payment_id: int,
    data: PaymentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    payment = get_payment_or_404(db, payment_id)

    if data.student_id is not None or data.subscription_id is not None:
        student_id, subscription_id, balance_snapshot = resolve_payment_links(
            db,
            student_id=data.student_id if data.student_id is not None else payment.student_id,
            subscription_id=data.subscription_id if data.subscription_id is not None else payment.subscription_id,
        )
        payment.student_id = student_id
        payment.subscription_id = subscription_id
        payment.subscription_balance_snapshot = balance_snapshot

    if data.amount is not None:
        payment.amount = data.amount
    if data.method is not None:
        payment.method = data.method
    if data.paid_at is not None:
        payment.paid_at = data.paid_at
    if data.comment is not None:
        payment.comment = data.comment
    if data.status is not None:
        payment.status = data.status

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}")
def delete_payment(
    payment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    payment = get_payment_or_404(db, payment_id)
    db.delete(payment)
    db.commit()
    return {"message": "Платеж успешно удален"}
