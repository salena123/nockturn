from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from core.deps import get_db, get_current_user
from models.scheduleEvent import ScheduleEvent
from models.lesson import Lesson
from models.teacher import Teacher
from models.discipline import Discipline
from models.room import Room
from models.user import User
from schemas.schedule import (
    ScheduleEventCreate, ScheduleEventUpdate, ScheduleEventWithDetails,
    LessonCreate, LessonUpdate, LessonWithDetails
)

router = APIRouter(prefix="/api/schedule")


def check_schedule_conflicts(db: Session, event_data: dict, exclude_id: int = None):
    conflicts = db.query(ScheduleEvent).filter(
        ((ScheduleEvent.start_time <= event_data['end_time']) & 
         (ScheduleEvent.end_time >= event_data['start_time'])) &
        (
            (ScheduleEvent.teacher_id == event_data['teacher_id']) |
            (ScheduleEvent.room_id == event_data['room_id'])
        )
    )
    
    if exclude_id:
        conflicts = conflicts.filter(ScheduleEvent.id != exclude_id)
    
    return conflicts.all()


@router.get("/events")
def get_schedule_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    events = db.query(ScheduleEvent)\
        .options(
            joinedload(ScheduleEvent.teacher),
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room)
        )\
        .all()
    
    result = []
    for event in events:
        result.append({
            "id": event.id,
            "teacher_id": event.teacher_id,
            "discipline_id": event.discipline_id,
            "room_id": event.room_id,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "type": event.type,
            "created_at": event.created_at,
            "teacher": {
                "id": event.teacher.id,
                "user_id": event.teacher.user_id,
                "specialization": event.teacher.specialization
            } if event.teacher else None,
            "discipline": {
                "id": event.discipline.id,
                "name": event.discipline.name
            } if event.discipline else None,
            "room": {
                "id": event.room.id,
                "name": event.room.name
            } if event.room else None
        })
    
    return result


@router.get("/events/{event_id}")
def get_schedule_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    event = db.query(ScheduleEvent)\
        .options(
            joinedload(ScheduleEvent.teacher),
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room)
        )\
        .filter(ScheduleEvent.id == event_id)\
        .first()
    
    if not event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")
    
    return {
        "id": event.id,
        "teacher_id": event.teacher_id,
        "discipline_id": event.discipline_id,
        "room_id": event.room_id,
        "start_time": event.start_time,
        "end_time": event.end_time,
        "type": event.type,
        "created_at": event.created_at,
        "teacher": {
            "id": event.teacher.id,
            "user_id": event.teacher.user_id,
            "specialization": event.teacher.specialization
        } if event.teacher else None,
        "discipline": {
            "id": event.discipline.id,
            "name": event.discipline.name
        } if event.discipline else None,
        "room": {
            "id": event.room.id,
            "name": event.room.name
        } if event.room else None
    }


@router.post("/events")
def create_schedule_event(
    event_data: ScheduleEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conflicts = check_schedule_conflicts(db, event_data.dict())
    if conflicts:
        raise HTTPException(
            status_code=409, 
            detail="Обнаружен конфликт в расписании (преподаватель или кабинет занят)"
        )
    
    db_event = ScheduleEvent(**event_data.dict())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    return db_event


@router.put("/events/{event_id}")
def update_schedule_event(
    event_id: int,
    event_data: ScheduleEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_event = db.query(ScheduleEvent).filter(ScheduleEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")
    
    update_data = event_data.dict(exclude_unset=True)
    if update_data:
        conflicts = check_schedule_conflicts(db, {**db_event.__dict__, **update_data}, event_id)
        if conflicts:
            raise HTTPException(
                status_code=409, 
                detail="Обнаружен конфликт в расписании (преподаватель или кабинет занят)"
            )
    
    for field, value in update_data.items():
        setattr(db_event, field, value)
    
    db.commit()
    db.refresh(db_event)
    
    return db_event


@router.delete("/events/{event_id}")
def delete_schedule_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_event = db.query(ScheduleEvent).filter(ScheduleEvent.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Событие расписания не найдено")
    
    db.delete(db_event)
    db.commit()
    
    return {"message": "Событие расписания удалено"}


@router.get("/lessons")
def get_lessons(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lessons = db.query(Lesson)\
        .options(joinedload(Lesson.schedule))\
        .all()
    
    return lessons


@router.post("/lessons")
def create_lesson(
    lesson_data: LessonCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_lesson = Lesson(**lesson_data.dict())
    db.add(db_lesson)
    db.commit()
    db.refresh(db_lesson)
    
    return db_lesson


@router.put("/lessons/{lesson_id}")
def update_lesson(
    lesson_id: int,
    lesson_data: LessonUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not db_lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    
    update_data = lesson_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_lesson, field, value)
    
    db.commit()
    db.refresh(db_lesson)
    
    return db_lesson


@router.delete("/lessons/{lesson_id}")
def delete_lesson(
    lesson_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_lesson = db.query(Lesson).filter(Lesson.id == lesson_id).first()
    if not db_lesson:
        raise HTTPException(status_code=404, detail="Занятие не найдено")
    
    db.delete(db_lesson)
    db.commit()
    
    return {"message": "Занятие удалено"}
