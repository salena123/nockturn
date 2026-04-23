from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.access import require_admin
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.entityChangeLog import EntityChangeLog
from models.user import User
from models.userDocument import UserDocument
from schemas.user_document import UserDocumentCreate, UserDocumentResponse, UserDocumentUpdate


router = APIRouter(prefix="/api")


def get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


def get_document_or_404(db: Session, document_id: int) -> UserDocument:
    document = db.query(UserDocument).filter(UserDocument.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Документ сотрудника не найден")
    return document


@router.get("/users/{user_id}/documents", response_model=list[UserDocumentResponse])
def get_user_documents(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_user_or_404(db, user_id)
    return (
        db.query(UserDocument)
        .filter(UserDocument.user_id == user_id)
        .order_by(UserDocument.created_at.desc(), UserDocument.id.desc())
        .all()
    )


@router.post("/users/{user_id}/documents", response_model=UserDocumentResponse)
def create_user_document(
    user_id: int,
    data: UserDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_user_or_404(db, user_id)

    document = UserDocument(
        user_id=user_id,
        document_type=data.document_type,
        file_path=data.file_path,
    )
    db.add(document)
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user_document",
        entity_id=document.id,
        action="create",
        new_value={
            "user_id": user_id,
            "document_type": data.document_type,
            "file_path": data.file_path,
        },
    )
    db.commit()
    db.refresh(document)
    return document


@router.put("/user-documents/{document_id}", response_model=UserDocumentResponse)
def update_user_document(
    document_id: int,
    data: UserDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    document = get_document_or_404(db, document_id)

    changes: dict[str, tuple[object, object]] = {}
    if data.document_type is not None:
        changes["document_type"] = (document.document_type, data.document_type)
        document.document_type = data.document_type
    if data.file_path is not None:
        changes["file_path"] = (document.file_path, data.file_path)
        document.file_path = data.file_path

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="user_document",
        entity_id=document.id,
        changes=changes,
    )
    db.commit()
    db.refresh(document)
    return document


@router.delete("/user-documents/{document_id}")
def delete_user_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    document = get_document_or_404(db, document_id)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user_document",
        entity_id=document.id,
        action="delete",
        old_value={
            "user_id": document.user_id,
            "document_type": document.document_type,
            "file_path": document.file_path,
        },
    )
    db.delete(document)
    db.commit()
    return {"message": "Документ сотрудника успешно удален"}


@router.get("/users/{user_id}/documents/history")
def get_user_document_history(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_user_or_404(db, user_id)
    document_ids = [
        document.id
        for document in db.query(UserDocument.id).filter(UserDocument.user_id == user_id).all()
    ]
    if not document_ids:
        return []
    return (
        db.query(EntityChangeLog)
        .filter(EntityChangeLog.entity == "user_document")
        .filter(EntityChangeLog.entity_id.in_(document_ids))
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
