from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from core.deps import get_db, get_current_user
from models.user import User
from models.teacher import Teacher
from models.scheduleEvent import ScheduleEvent
from models.lesson import Lesson
from models.student import Student
from models.role import Role

router = APIRouter(prefix="/api/teachers")

def serialize_teacher_with_details(teacher: Teacher, include_schedule=False, db: Session = None) -> dict:
    result = {
        "id": teacher.id,
        "user_id": teacher.user_id,
        "bio": teacher.bio,
        "experience_years": teacher.experience_years,
        "specialization": teacher.specialization,
        "created_at": teacher.created_at,
        "updated_at": teacher.updated_at,
        "user": {
            "id": teacher.user.id,
            "login": teacher.user.login,
            "full_name": teacher.user.full_name,
            "phone": teacher.user.phone,
            "is_active": teacher.user.is_active,
            "hire_date": teacher.user.hire_date,
            "created_at": teacher.user.created_at
        } if teacher.user else None
    }
    
    if include_schedule and db:
        
        start_date = datetime.now()
        end_date = start_date + timedelta(days=7)
        
        lessons = db.query(ScheduleEvent)\
            .filter(ScheduleEvent.teacher_id == teacher.id)\
            .filter(ScheduleEvent.start_time >= start_date)\
            .filter(ScheduleEvent.start_time <= end_date)\
            .order_by(ScheduleEvent.start_time)\
            .all()
        
        result["upcoming_lessons"] = [
            {
                "id": lesson.id,
                "start_time": lesson.start_time,
                "end_time": lesson.end_time,
                "type": lesson.type,
                "discipline": lesson.discipline.name if lesson.discipline else None,
                "room": lesson.room.name if lesson.room else None
            }
            for lesson in lessons
        ]
        
        
        total_lessons = db.query(ScheduleEvent)\
            .filter(ScheduleEvent.teacher_id == teacher.id)\
            .count()
        
        result["statistics"] = {
            "total_lessons": total_lessons,
            "upcoming_lessons_count": len(lessons)
        }
    
    return result

@router.get("/")
def get_teachers(
    include_schedule: bool = False,
    is_active: bool = None,
    search: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Teacher)\
        .options(
            joinedload(Teacher.user).joinedload(User.role)
        )
    
    
    query = query.join(User).join(Role).filter(Role.name == 'teacher')
    
    
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(search_term)) |
            (Teacher.specialization.ilike(search_term)) |
            (User.login.ilike(search_term))
        )
    
    teachers = query.order_by(User.full_name).all()
    
    return [
        serialize_teacher_with_details(teacher, include_schedule, db)
        for teacher in teachers
    ]

@router.get("/{teacher_id}")
def get_teacher(
    teacher_id: int,
    include_schedule: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher = db.query(Teacher)\
        .options(
            joinedload(Teacher.user).joinedload(User.role)
        )\
        .filter(Teacher.id == teacher_id)\
        .first()
    
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    
    return serialize_teacher_with_details(teacher, include_schedule, db)

@router.post("/")
def create_teacher(
    teacher_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    if current_user.role.name not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    
    teacher_role = db.query(Role).filter(Role.name == 'teacher').first()
    if not teacher_role:
        raise HTTPException(status_code=404, detail="Роль преподавателя не найдена")
    
    
    user = db.query(User).filter(User.id == teacher_data['user_id']).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    
    existing_teacher = db.query(Teacher).filter(Teacher.user_id == teacher_data['user_id']).first()
    if existing_teacher:
        raise HTTPException(status_code=400, detail="Пользователь уже является преподавателем")
    
    
    user.role_id = teacher_role.id
    
    
    new_teacher = Teacher(
        user_id=teacher_data['user_id'],
        bio=teacher_data.get('bio'),
        experience_years=teacher_data.get('experience_years'),
        specialization=teacher_data.get('specialization'),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    db.add(new_teacher)
    db.commit()
    db.refresh(new_teacher)
    
    return serialize_teacher_with_details(new_teacher, False, db)

@router.put("/{teacher_id}")
def update_teacher(
    teacher_id: int,
    teacher_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    if current_user.role.name not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    
    
    if 'bio' in teacher_data:
        teacher.bio = teacher_data['bio']
    if 'experience_years' in teacher_data:
        teacher.experience_years = teacher_data['experience_years']
    if 'specialization' in teacher_data:
        teacher.specialization = teacher_data['specialization']
    
    teacher.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(teacher)
    
    return serialize_teacher_with_details(teacher, False, db)

@router.delete("/{teacher_id}")
def delete_teacher(
    teacher_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    
    if current_user.role.name not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    
    
    upcoming_lessons = db.query(ScheduleEvent)\
        .filter(ScheduleEvent.teacher_id == teacher_id)\
        .filter(ScheduleEvent.start_time >= datetime.now())\
        .count()
    
    if upcoming_lessons > 0:
        raise HTTPException(
            status_code=400, 
            detail=f"Нельзя удалить преподавателя с предстоящими занятиями ({upcoming_lessons} занятий)"
        )
    
    
    user = teacher.user
    default_role = db.query(Role).filter(Role.name == 'user').first()
    if default_role:
        user.role_id = default_role.id
    
    
    db.delete(teacher)
    db.commit()
    
    return {"message": "Преподаватель успешно удален"}

@router.get("/{teacher_id}/schedule")
def get_teacher_schedule(
    teacher_id: int,
    start_date: str = None,
    end_date: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    teacher = db.query(Teacher).filter(Teacher.id == teacher_id).first()
    if not teacher:
        raise HTTPException(status_code=404, detail="Преподаватель не найден")
    
    query = db.query(ScheduleEvent)\
        .options(
            joinedload(ScheduleEvent.discipline),
            joinedload(ScheduleEvent.room),
            joinedload(ScheduleEvent.lessons).joinedload(Lesson.lesson_students).joinedload(Student)
        )\
        .filter(ScheduleEvent.teacher_id == teacher_id)
    
    if start_date:
        start_dt = datetime.fromisoformat(start_date)
        query = query.filter(ScheduleEvent.start_time >= start_dt)
    
    if end_date:
        end_dt = datetime.fromisoformat(end_date)
        query = query.filter(ScheduleEvent.end_time <= end_dt)
    
    events = query.order_by(ScheduleEvent.start_time).all()
    
    result = []
    for event in events:
        lesson_data = None
        if event.lessons:
            lesson = event.lessons[0]
            lesson_data = {
                "id": lesson.id,
                "lesson_type": lesson.lesson_type,
                "max_students": lesson.max_students,
                "students": [
                    {
                        "id": ls.student.id,
                        "name": ls.student.fio
                    } for ls in lesson.lesson_students
                ] if lesson.lesson_students else []
            }
        
        result.append({
            "id": event.id,
            "start_time": event.start_time,
            "end_time": event.end_time,
            "type": event.type,
            "discipline": {
                "id": event.discipline.id,
                "name": event.discipline.name
            } if event.discipline else None,
            "room": {
                "id": event.room.id,
                "name": event.room.name
            } if event.room else None,
            "lesson": lesson_data
        })
    
    return result
