from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_db, get_current_user
from models.discountRule import DiscountRule
from models.user import User
from schemas.discount import DiscountCreate, DiscountResponse

router = APIRouter(prefix="/api/discounts")


@router.get("/")
def get_discounts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    discounts = db.query(DiscountRule).all()
    return discounts


@router.post("/")
def create_discount(
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    discount = DiscountRule(**discount_data.dict())
    db.add(discount)
    db.commit()
    db.refresh(discount)
    return discount


@router.put("/{discount_id}")
def update_discount(
    discount_id: int,
    discount_data: DiscountCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    discount = db.query(DiscountRule).filter(DiscountRule.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Скидка не найдена")
    
    for field, value in discount_data.dict().items():
        setattr(discount, field, value)
    
    db.commit()
    db.refresh(discount)
    return discount


@router.delete("/{discount_id}")
def delete_discount(
    discount_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    discount = db.query(DiscountRule).filter(DiscountRule.id == discount_id).first()
    if not discount:
        raise HTTPException(status_code=404, detail="Скидка не найдена")
    
    # Check if discount is used in any subscriptions
    from models.subscription import Subscription
    subscriptions_using = db.query(Subscription).filter(Subscription.discount_id == discount_id).count()
    if subscriptions_using > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Нельзя удалить скидку: она используется в {subscriptions_using} абонементе(ах)"
        )
    
    db.delete(discount)
    db.commit()
    return {"message": "Скидка удалена"}
