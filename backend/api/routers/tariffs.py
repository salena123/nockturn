from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_db, get_current_user
from models.tariff import Tariff
from models.user import User
from schemas.tariff import TariffCreate, TariffResponse

router = APIRouter(prefix="/api/tariffs")


@router.get("/")
def get_tariffs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tariffs = db.query(Tariff).all()
    return tariffs


@router.post("/")
def create_tariff(
    tariff_data: TariffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tariff = Tariff(**tariff_data.dict())
    db.add(tariff)
    db.commit()
    db.refresh(tariff)
    return tariff


@router.put("/{tariff_id}")
def update_tariff(
    tariff_id: int,
    tariff_data: TariffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    for field, value in tariff_data.dict().items():
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
    tariff = db.query(Tariff).filter(Tariff.id == tariff_id).first()
    if not tariff:
        raise HTTPException(status_code=404, detail="Tariff not found")
    
    db.delete(tariff)
    db.commit()
    return {"message": "Tariff deleted"}
