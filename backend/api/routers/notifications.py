from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from core.access import ADMIN_ROLES, require_staff
from core.deps import get_current_user, get_db
from core.note_notifications import sync_due_note_reminders
from models.notification import Notification
from models.user import User
from schemas.notification import NotificationResponse


router = APIRouter(prefix="/api")


def get_notification_or_404(db: Session, notification_id: int) -> Notification:
    notification = (
        db.query(Notification)
        .options(
            joinedload(Notification.student),
            joinedload(Notification.user),
            joinedload(Notification.note),
        )
        .filter(Notification.id == notification_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=404, detail="Уведомление не найдено")
    return notification


def serialize_notification(notification: Notification) -> NotificationResponse:
    return NotificationResponse(
        id=notification.id,
        student_id=notification.student_id,
        user_id=notification.user_id,
        note_id=notification.note_id,
        text=notification.text,
        type=notification.type,
        is_read=bool(notification.is_read),
        created_at=notification.created_at,
        resolved_at=notification.resolved_at,
        student_name=notification.student.fio if notification.student else None,
        user_name=notification.user.full_name or notification.user.login if notification.user else None,
    )


@router.get("/notifications", response_model=list[NotificationResponse])
def get_notifications(
    type: str | None = None,
    student_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    sync_due_note_reminders(db)
    db.commit()

    role_name = getattr(getattr(current_user, "role", None), "name", None)
    query = db.query(Notification).options(
        joinedload(Notification.student),
        joinedload(Notification.user),
        joinedload(Notification.note),
    )
    if type is not None:
        query = query.filter(Notification.type == type)
    if student_id is not None:
        query = query.filter(Notification.student_id == student_id)
    if role_name not in ADMIN_ROLES:
        query = query.filter(Notification.user_id == current_user.id)

    notifications = query.order_by(Notification.created_at.desc(), Notification.id.desc()).all()
    return [serialize_notification(item) for item in notifications]


@router.delete("/notifications/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    notification = get_notification_or_404(db, notification_id)
    role_name = getattr(getattr(current_user, "role", None), "name", None)
    if role_name not in ADMIN_ROLES and notification.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Недостаточно прав для обработки уведомления")

    notification.is_read = True
    notification.resolved_at = datetime.utcnow()
    db.commit()
    return {"message": "Уведомление обработано"}
