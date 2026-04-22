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

    if data.student_id is None and data.subscription_id is None:
        raise HTTPException(
            status_code=400,
            detail="Нужно указать ученика или абонемент для платежа",
        )

    student_id = data.student_id

    if data.subscription_id is not None:
        subscription = get_subscription_or_404(db, data.subscription_id)
        if student_id is not None and subscription.student_id is not None and subscription.student_id != student_id:
            raise HTTPException(
                status_code=400,
                detail="Абонемент не принадлежит указанному ученику",
            )
        if student_id is None:
            student_id = subscription.student_id

    if student_id is not None:
        get_student_or_404(db, student_id)

    payment = Payment(
        student_id=student_id,
        subscription_id=data.subscription_id,
        amount=data.amount,
        method=data.method,
        paid_at=data.paid_at,
        comment=data.comment,
        status=data.status or "paid",
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

    if data.subscription_id is not None:
        subscription = get_subscription_or_404(db, data.subscription_id)
        if (
            data.student_id is not None
            and subscription.student_id is not None
            and subscription.student_id != data.student_id
        ):
            raise HTTPException(
                status_code=400,
                detail="Абонемент не принадлежит указанному ученику",
            )
        payment.subscription_id = subscription.id
        if data.student_id is None:
            payment.student_id = subscription.student_id

    if data.student_id is not None:
        get_student_or_404(db, data.student_id)
        payment.student_id = data.student_id

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
