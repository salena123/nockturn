from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.access import require_admin
from core.deps import get_db, get_current_user
from models.tariff import Tariff
from models.user import User
from schemas.tariff import TariffCreate, TariffResponse

router = APIRouter(prefix="/api/tariffs")


@router.get("/", response_model=list[TariffResponse])
def get_tariffs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    tariffs = db.query(Tariff).all()
    return tariffs


@router.post("/", response_model=TariffResponse)
def create_tariff(
    tariff_data: TariffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    tariff = Tariff(**tariff_data.model_dump())
    db.add(tariff)
    db.commit()
    db.refresh(tariff)
    return tariff


@router.put("/{tariff_id}", response_model=TariffResponse)
def update_tariff(
    tariff_id: int,
    tariff_data: TariffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Тариф не найден")
    
    for field, value in tariff_data.model_dump().items():
        setattr(tariff, field, value)
    
    db.commit()
    db.refresh(tariff)
    return tariff


@router.delete("/{tariff_id}")
def delete_tariff(
    tariff_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_admin(current_user)
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Тариф не найден")
    
    db.delete(tariff)
    db.commit()
    return {"message": "Тариф удален"}
