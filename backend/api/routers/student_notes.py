from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.access import require_staff
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.entityChangeLog import EntityChangeLog
from models.student import Student
from models.studentNote import StudentNote
from models.user import User
from schemas.student_note import StudentNoteCreate, StudentNoteResponse, StudentNoteUpdate


router = APIRouter(prefix="/api")


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def get_note_or_404(db: Session, note_id: int) -> StudentNote:
    note = db.query(StudentNote).filter(StudentNote.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Заметка ученика не найдена")
    return note


@router.get("/students/{student_id}/notes", response_model=list[StudentNoteResponse])
def get_student_notes(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    get_student_or_404(db, student_id)
    return (
        db.query(StudentNote)
        .filter(StudentNote.student_id == student_id)
        .order_by(StudentNote.updated_at.desc(), StudentNote.id.desc())
        .all()
    )


@router.post("/students/{student_id}/notes", response_model=StudentNoteResponse)
def create_student_note(
    student_id: int,
    data: StudentNoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    get_student_or_404(db, student_id)
    note = StudentNote(student_id=student_id, text=data.text.strip())
    db.add(note)
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student_note",
        entity_id=note.id,
        action="create",
        new_value={"student_id": student_id, "text": note.text},
    )
    db.commit()
    db.refresh(note)
    return note


@router.put("/student-notes/{note_id}", response_model=StudentNoteResponse)
def update_student_note(
    note_id: int,
    data: StudentNoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    note = get_note_or_404(db, note_id)
    changes: dict[str, tuple[object, object]] = {}
    if data.text is not None:
        normalized_text = data.text.strip()
        changes["text"] = (note.text, normalized_text)
        note.text = normalized_text

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="student_note",
        entity_id=note.id,
        changes=changes,
    )
    db.commit()
    db.refresh(note)
    return note


@router.delete("/student-notes/{note_id}")
def delete_student_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    note = get_note_or_404(db, note_id)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student_note",
        entity_id=note.id,
        action="delete",
        old_value={"student_id": note.student_id, "text": note.text},
    )
    db.delete(note)
    db.commit()
    return {"message": "Заметка ученика успешно удалена"}


@router.get("/students/{student_id}/notes/history")
def get_student_notes_history(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    get_student_or_404(db, student_id)
    note_ids = [
        note.id
        for note in db.query(StudentNote.id).filter(StudentNote.student_id == student_id).all()
    ]
    if not note_ids:
        return []
    return (
        db.query(EntityChangeLog)
        .filter(EntityChangeLog.entity == "student_note")
        .filter(EntityChangeLog.entity_id.in_(note_ids))
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
