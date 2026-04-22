from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.deps import get_db, get_current_user
from models.room import Room
from models.user import User

router = APIRouter(prefix="/api/rooms")


@router.get("/")
def get_rooms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rooms = db.query(Room).all()
    return rooms


@router.post("/")
def create_room(
    name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = Room(name=name)
    db.add(room)
    db.commit()
    db.refresh(room)
    return room
