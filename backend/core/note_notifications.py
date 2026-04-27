from datetime import datetime

from sqlalchemy.orm import Session

from models.note import Note
from models.notification import Notification


def create_user_notification(
    db: Session,
    *,
    user_id: int | None,
    note_id: int | None,
    text: str,
    notification_type: str,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        note_id=note_id,
        text=text,
        type=notification_type,
        is_read=False,
        created_at=datetime.utcnow(),
    )
    db.add(notification)
    db.flush()
    return notification


def sync_due_note_reminders(db: Session) -> None:
    due_notes = (
        db.query(Note)
        .filter(Note.reminder_at.isnot(None))
        .filter(Note.reminder_at <= datetime.now())
        .all()
    )

    for note in due_notes:
        target_user_id = note.recipient_user_id or note.author_id
        if target_user_id is None:
            continue

        exists = (
            db.query(Notification)
            .filter(Notification.type == "note_reminder")
            .filter(Notification.note_id == note.id)
            .filter(Notification.user_id == target_user_id)
            .first()
        )
        if exists:
            continue

        create_user_notification(
            db,
            user_id=target_user_id,
            note_id=note.id,
            text="Сработало напоминание по заметке.",
            notification_type="note_reminder",
        )
