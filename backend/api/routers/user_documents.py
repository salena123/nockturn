from io import BytesIO
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin
from core.crypto import decrypt_bytes, encrypt_bytes
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.entityChangeLog import EntityChangeLog
from models.user import User
from models.userDocument import UserDocument
from schemas.user_document import UserDocumentCreate, UserDocumentResponse, UserDocumentUpdate


router = APIRouter(prefix="/api")

BACKEND_DIR = Path(__file__).resolve().parents[2]
USER_DOCUMENTS_DIR = BACKEND_DIR / "uploads" / "user_documents"
ALLOWED_DOCUMENT_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}


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


def validate_uploaded_document(file: UploadFile) -> None:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Нужно выбрать файл для загрузки")

    extension = Path(file.filename).suffix.lower()
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Можно загружать только PDF или изображения: PNG, JPG, JPEG, WEBP",
        )


def save_uploaded_document(user_id: int, file: UploadFile) -> str:
    validate_uploaded_document(file)
    extension = Path(file.filename).suffix.lower()
    user_dir = USER_DOCUMENTS_DIR / str(user_id)
    user_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    target_path = user_dir / filename

    payload = file.file.read()
    encrypted_payload = encrypt_bytes(payload)
    with target_path.open("wb") as output_file:
        output_file.write(encrypted_payload)

    return str(target_path.relative_to(BACKEND_DIR))


def resolve_document_path(file_path: str) -> Path:
    path = Path(file_path)
    if path.is_absolute():
        return path
    return BACKEND_DIR / path


def delete_managed_document_file(file_path: str | None) -> None:
    if not file_path:
        return

    target_path = resolve_document_path(file_path)
    try:
        target_path.relative_to(USER_DOCUMENTS_DIR)
    except ValueError:
        return

    if target_path.exists():
        target_path.unlink()


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


def stream_document_bytes(document: UserDocument, file_path: Path, db: Session):
    if not document.is_encrypted:
        payload = file_path.read_bytes()
        file_path.write_bytes(encrypt_bytes(payload))
        document.is_encrypted = True
        db.commit()
        db.refresh(document)
    else:
        encrypted_payload = file_path.read_bytes()
        payload = decrypt_bytes(encrypted_payload)

    return StreamingResponse(
        BytesIO(payload),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_path.name}"'},
    )


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
    raise HTTPException(
        status_code=400,
        detail="Документы можно добавлять только через загрузку файла, чтобы сохранить их в зашифрованном виде",
    )


@router.post("/users/{user_id}/documents/upload", response_model=UserDocumentResponse)
def upload_user_document(
    user_id: int,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_user_or_404(db, user_id)

    file_path = save_uploaded_document(user_id, file)
    document = UserDocument(
        user_id=user_id,
        document_type=document_type.strip(),
        file_path=file_path,
        is_encrypted=True,
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
            "document_type": document.document_type,
            "file_path": file_path,
            "is_encrypted": True,
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
        raise HTTPException(
            status_code=400,
            detail="Нельзя напрямую менять путь к файлу документа. Используйте загрузку файла через защищенный endpoint",
        )

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


@router.put("/user-documents/{document_id}/upload", response_model=UserDocumentResponse)
def replace_user_document_file(
    document_id: int,
    document_type: str = Form(...),
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    document = get_document_or_404(db, document_id)

    changes: dict[str, tuple[object, object]] = {}
    normalized_type = document_type.strip()
    if normalized_type != document.document_type:
        changes["document_type"] = (document.document_type, normalized_type)
        document.document_type = normalized_type

    if file is not None and file.filename:
        old_file_path = document.file_path
        new_file_path = save_uploaded_document(document.user_id, file)
        changes["file_path"] = (old_file_path, new_file_path)
        document.file_path = new_file_path
        changes["is_encrypted"] = (document.is_encrypted, True)
        document.is_encrypted = True
        delete_managed_document_file(old_file_path)

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


@router.get("/user-documents/{document_id}/download")
def download_user_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    document = get_document_or_404(db, document_id)
    file_path = resolve_document_path(document.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Файл документа не найден на сервере")

    return stream_document_bytes(document, file_path, db)


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
            "is_encrypted": document.is_encrypted,
        },
    )
    delete_managed_document_file(document.file_path)
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
    history_items = (
        db.query(EntityChangeLog)
        .options(joinedload(EntityChangeLog.actor_user))
        .filter(EntityChangeLog.entity == "user_document")
        .filter(EntityChangeLog.entity_id.in_(document_ids))
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
    return [serialize_history_item(item) for item in history_items]
