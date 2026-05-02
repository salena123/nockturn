from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.access import require_admin
from core.deps import get_current_user, get_db
from models.discountRule import DiscountRule
from models.subscription import Subscription
from models.user import User
from schemas.discount import DiscountCreate, DiscountResponse


router = APIRouter(prefix="/api/discounts")


def get_discount_or_404(db: Session, discount_id: int) -> DiscountRule:
    discount = db.query(DiscountRule).filter(DiscountRule.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Скидка не найдена")
    return discount


@router.get("/", response_model=list[DiscountResponse])
def get_discounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    return db.query(DiscountRule).order_by(DiscountRule.id.desc()).all()


@router.post("/", response_model=DiscountResponse)
def create_discount(
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    discount = DiscountRule(**discount_data.model_dump())
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


@router.put("/{discount_id}", response_model=DiscountResponse)
def update_discount(
    discount_id: int,
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    discount = get_discount_or_404(db, discount_id)

    for field, value in discount_data.model_dump().items():
        setattr(discount, field, value)

    db.commit()
    db.refresh(discount)
    return discount


@router.delete("/{discount_id}")
def delete_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_admin(current_user)
    discount = get_discount_or_404(db, discount_id)

    subscriptions_using = (
        db.query(Subscription).filter(Subscription.discount_id == discount_id).count()
    )
    if subscriptions_using > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Нельзя удалить скидку: она используется в {subscriptions_using} абонементе(ах)",
        )

    db.delete(discount)
    db.commit()
    return {"message": "Скидка удалена"}
