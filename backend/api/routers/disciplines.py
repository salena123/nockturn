from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.deps import get_db, get_current_user
from models.discipline import Discipline
from models.user import User

router = APIRouter(prefix="/api/disciplines")


@router.get("/")
def get_disciplines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    disciplines = db.query(Discipline).all()
    return disciplines


@router.post("/")
def create_discipline(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    discipline = Discipline(name=name)
    db.add(discipline)
    db.commit()
    db.refresh(discipline)
    return discipline
