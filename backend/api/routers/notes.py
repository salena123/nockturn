from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from core.access import ADMIN_ROLES, require_staff
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from core.note_notifications import create_user_notification, sync_due_note_reminders
from models.entityChangeLog import EntityChangeLog
from models.note import Note
from models.notification import Notification
from models.user import User
from schemas.note import NoteCreate, NoteResponse, NoteUpdate


router = APIRouter(prefix="/api")
ALLOWED_PRIORITIES = {"normal", "important"}


def get_actor_display_name(actor_user: User | None) -> str | None:
    if actor_user is None:
        return None
    return actor_user.full_name or actor_user.login


def serialize_history_item(item: EntityChangeLog) -> dict:
    return {
        "id": item.id,
        "actor_user_id": item.actor_user_id,
        "ip_address": item.ip_address,
        "actor_user_name": get_actor_display_name(item.actor_user),
        "entity": item.entity,
        "entity_id": item.entity_id,
        "field_name": item.field_name,
        "old_value": item.old_value,
        "new_value": item.new_value,
        "action": item.action,
        "created_at": item.created_at,
    }


def serialize_note(note: Note) -> NoteResponse:
    return NoteResponse(
        id=note.id,
        author_id=note.author_id,
        author_name=get_actor_display_name(note.author),
        recipient_user_id=note.recipient_user_id,
        recipient_user_name=get_actor_display_name(note.recipient),
        text=note.text,
        reminder_at=note.reminder_at,
        priority=note.priority or "normal",
        is_pinned=bool(note.is_pinned),
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def validate_priority(priority: str | None) -> str:
    normalized = (priority or "normal").strip().lower()
    if normalized not in ALLOWED_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail="Некорректный приоритет заметки. Допустимые значения: normal, important",
        )
    return normalized


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Сотрудник не найден")
    return user


def get_note_or_404(db: Session, note_id: int) -> Note:
    note = (
        db.query(Note)
        .options(joinedload(Note.author), joinedload(Note.recipient))
        .filter(Note.id == note_id)
        .first()
    )
    if not note:
        raise HTTPException(status_code=404, detail="Заметка не найдена")
    return note


def ensure_note_access(note: Note, current_user: User) -> None:
    if note.author_id != current_user.id and note.recipient_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этой заметке")


def create_assignment_notification(db: Session, note: Note) -> None:
    if note.recipient_user_id and note.recipient_user_id != note.author_id:
        create_user_notification(
            db,
            user_id=note.recipient_user_id,
            note_id=note.id,
            text="Вам назначена новая заметка от сотрудника.",
            notification_type="note_assigned",
        )


@router.get("/notes", response_model=list[NoteResponse])
def get_notes(
    box: str = "all",
    priority: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    sync_due_note_reminders(db)
    db.commit()

    query = db.query(Note).options(joinedload(Note.author), joinedload(Note.recipient))
    if box == "authored":
        query = query.filter(Note.author_id == current_user.id)
    elif box == "received":
        query = query.filter(Note.recipient_user_id == current_user.id)
    else:
        query = query.filter(
            or_(Note.author_id == current_user.id, Note.recipient_user_id == current_user.id)
        )

    if priority:
        query = query.filter(Note.priority == validate_priority(priority))

    notes = query.order_by(Note.is_pinned.desc(), Note.reminder_at.asc(), Note.updated_at.desc(), Note.id.desc()).all()
    return [serialize_note(note) for note in notes]


@router.get("/notes/staff-users")
def get_staff_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    users = (
        db.query(User)
        .options(joinedload(User.role))
        .order_by(User.full_name.asc(), User.login.asc())
        .all()
    )
    return [
        {
            "id": user.id,
            "full_name": user.full_name,
            "login": user.login,
            "role": user.role.name if user.role else None,
        }
        for user in users
    ]


@router.post("/notes", response_model=NoteResponse)
def create_note(
    data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    recipient_user_id = data.recipient_user_id
    if recipient_user_id is not None:
        get_user_or_404(db, recipient_user_id)

    note = Note(
        author_id=current_user.id,
        recipient_user_id=recipient_user_id,
        text=data.text.strip(),
        reminder_at=data.reminder_at,
        priority=validate_priority(data.priority),
        is_pinned=data.is_pinned,
    )
    db.add(note)
    db.flush()
    create_assignment_notification(db, note)
    sync_due_note_reminders(db)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="note",
        entity_id=note.id,
        action="create",
        new_value={
            "text": note.text,
            "recipient_user_id": note.recipient_user_id,
            "reminder_at": note.reminder_at,
            "priority": note.priority,
            "is_pinned": note.is_pinned,
        },
    )
    db.commit()
    db.refresh(note)
    return serialize_note(note)


@router.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(
    note_id: int,
    data: NoteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    note = get_note_or_404(db, note_id)
    ensure_note_access(note, current_user)

    changes: dict[str, tuple[object, object]] = {}
    recipient_changed = False

    if data.text is not None:
        new_text = data.text.strip()
        changes["text"] = (note.text, new_text)
        note.text = new_text

    if data.reminder_at is not None or data.reminder_at is None:
        if "reminder_at" in data.model_fields_set:
            changes["reminder_at"] = (note.reminder_at, data.reminder_at)
            note.reminder_at = data.reminder_at

    if "recipient_user_id" in data.model_fields_set:
        if data.recipient_user_id is not None:
            get_user_or_404(db, data.recipient_user_id)
        changes["recipient_user_id"] = (note.recipient_user_id, data.recipient_user_id)
        recipient_changed = note.recipient_user_id != data.recipient_user_id
        note.recipient_user_id = data.recipient_user_id

    if data.priority is not None:
        new_priority = validate_priority(data.priority)
        changes["priority"] = (note.priority, new_priority)
        note.priority = new_priority

    if data.is_pinned is not None:
        changes["is_pinned"] = (note.is_pinned, data.is_pinned)
        note.is_pinned = data.is_pinned

    note.updated_at = datetime.utcnow()

    if recipient_changed:
        db.query(Notification).filter(Notification.note_id == note.id).filter(
            Notification.type == "note_assigned"
        ).delete()
        create_assignment_notification(db, note)

    sync_due_note_reminders(db)
    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="note",
        entity_id=note.id,
        changes=changes,
    )
    db.commit()
    db.refresh(note)
    return serialize_note(note)


@router.delete("/notes/{note_id}")
def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    note = get_note_or_404(db, note_id)
    ensure_note_access(note, current_user)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="note",
        entity_id=note.id,
        action="delete",
        old_value={
            "text": note.text,
            "recipient_user_id": note.recipient_user_id,
            "reminder_at": note.reminder_at,
            "priority": note.priority,
            "is_pinned": note.is_pinned,
        },
    )
    db.query(Notification).filter(Notification.note_id == note.id).delete()
    db.delete(note)
    db.commit()
    return {"message": "Заметка удалена"}


@router.get("/notes/history")
def get_notes_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    role_name = getattr(getattr(current_user, "role", None), "name", None)
    note_ids_query = db.query(Note.id)
    if role_name not in ADMIN_ROLES:
        note_ids_query = note_ids_query.filter(
            or_(Note.author_id == current_user.id, Note.recipient_user_id == current_user.id)
        )

    note_ids = [note.id for note in note_ids_query.all()]
    if not note_ids:
        return []

    history_items = (
        db.query(EntityChangeLog)
        .options(joinedload(EntityChangeLog.actor_user))
        .filter(EntityChangeLog.entity == "note")
        .filter(EntityChangeLog.entity_id.in_(note_ids))
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
    return [serialize_history_item(item) for item in history_items]
