import json
from datetime import datetime
from io import BytesIO
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from core.security import generate_password, hash_password, is_strong_password
from models.archivedUser import ArchivedUser
from models.entityChangeLog import EntityChangeLog
from models.role import Role
from models.scheduleEvent import ScheduleEvent
from models.studentWaitlist import StudentWaitlist
from models.teacher import Teacher
from models.user import User
from models.userDocument import UserDocument
from schemas.user import (
    RoleResponse,
    UserCreate,
    UserPasswordResetRequest,
    UserResponse,
    UserUpdate,
    UserWithPasswordResponse,
)


router = APIRouter(prefix="/api")
BACKEND_DIR = Path(__file__).resolve().parents[2]
USER_DOCUMENTS_DIR = BACKEND_DIR / "uploads" / "user_documents"


def resolve_document_path(file_path: str) -> Path:
    path = Path(file_path)
    if path.is_absolute():
        return path
    return BACKEND_DIR / path


def delete_document_file(file_path: str | None) -> None:
    if not file_path:
        return
    path = resolve_document_path(file_path)
    try:
        path.relative_to(USER_DOCUMENTS_DIR)
    except ValueError:
        return
    if path.exists():
        path.unlink()


def build_xlsx_bytes(rows: list[list[str | int | float]]) -> bytes:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Сотрудник" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>"""

    app = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"
 xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Nockturn CRM</Application>
</Properties>"""

    created = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    core = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/"
 xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:dcmitype="http://purl.org/dc/dcmitype/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>Nockturn CRM</dc:creator>
  <cp:lastModifiedBy>Nockturn CRM</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{created}</dcterms:modified>
</cp:coreProperties>"""

    def column_name(index: int) -> str:
        result = ""
        current = index
        while current >= 0:
            result = chr(current % 26 + 65) + result
            current = current // 26 - 1
        return result

    sheet_rows: list[str] = []
    for row_index, row in enumerate(rows, start=1):
        cells: list[str] = []
        for column_index, value in enumerate(row):
            cell_ref = f"{column_name(column_index)}{row_index}"
            value_str = escape("" if value is None else str(value))
            cells.append(f'<c r="{cell_ref}" t="inlineStr"><is><t>{value_str}</t></is></c>')
        sheet_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    worksheet = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    {''.join(sheet_rows)}
  </sheetData>
</worksheet>"""

    buffer = BytesIO()
    with ZipFile(buffer, "w", ZIP_DEFLATED) as zip_file:
        zip_file.writestr("[Content_Types].xml", content_types)
        zip_file.writestr("_rels/.rels", rels)
        zip_file.writestr("docProps/app.xml", app)
        zip_file.writestr("docProps/core.xml", core)
        zip_file.writestr("xl/workbook.xml", workbook)
        zip_file.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zip_file.writestr("xl/styles.xml", styles)
        zip_file.writestr("xl/worksheets/sheet1.xml", worksheet)

    buffer.seek(0)
    return buffer.getvalue()


def serialize_user(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        login=user.login,
        full_name=user.full_name,
        phone=user.phone,
        role_id=user.role_id,
        role=user.role.name if user.role else None,
        is_active=bool(user.is_active),
        hire_date=user.hire_date,
        consent_received=bool(user.consent_received),
        consent_received_at=user.consent_received_at,
        consent_document_version=user.consent_document_version,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


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


def serialize_archived_user(item: ArchivedUser) -> dict:
    return {
        "id": item.id,
        "original_user_id": item.original_user_id,
        "login": item.login,
        "full_name": item.full_name,
        "phone": item.phone,
        "role_id": item.role_id,
        "role_name": item.role.name if item.role else None,
        "hire_date": item.hire_date,
        "archived_at": item.archived_at,
        "archived_by": item.archived_by,
        "archived_by_name": get_actor_display_name(item.archived_by_user),
        "snapshot_json": item.snapshot_json,
    }


def get_archived_user_or_404(db: Session, archive_id: int) -> ArchivedUser:
    archived_user = (
        db.query(ArchivedUser)
        .options(joinedload(ArchivedUser.role), joinedload(ArchivedUser.archived_by_user))
        .filter(ArchivedUser.id == archive_id)
        .first()
    )
    if not archived_user:
        raise HTTPException(status_code=404, detail="Архивная запись сотрудника не найдена")
    return archived_user


def get_role_or_404(db: Session, role_id: int) -> Role:
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Роль не найдена")
    return role


def ensure_role_assignable(current_user: User, role: Role) -> None:
    current_role = current_user.role.name if current_user.role else None
    if current_role != "superadmin" and role.name == "superadmin":
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")


def get_user_or_404(db: Session, user_id: int) -> User:
    user = (
        db.query(User)
        .options(joinedload(User.role))
        .filter(User.id == user_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


def ensure_manageable_by_current_user(current_user: User, target_user: User) -> None:
    current_role = current_user.role.name if current_user.role else None
    target_role = target_user.role.name if target_user.role else None

    if current_role == "superadmin":
        return

    if current_role == "admin" and target_role == "superadmin":
        raise HTTPException(status_code=403, detail="Недостаточно прав пользователя")


@router.get("/me", response_model=UserResponse)
def read_current_user(current_user: User = Depends(get_current_user)):
    return serialize_user(current_user)


@router.get("/roles", response_model=list[RoleResponse])
def get_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return db.query(Role).order_by(Role.name.asc()).all()


@router.get("/users", response_model=list[UserResponse])
def get_users(
    is_active: bool | None = None,
    role_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    query = db.query(User).options(joinedload(User.role))

    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    if role_id is not None:
        query = query.filter(User.role_id == role_id)

    users = query.order_by(User.created_at.desc(), User.id.desc()).all()
    return [serialize_user(user) for user in users]


@router.get("/archived-users")
def get_archived_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    archived_users = (
        db.query(ArchivedUser)
        .options(joinedload(ArchivedUser.role), joinedload(ArchivedUser.archived_by_user))
        .order_by(ArchivedUser.archived_at.desc(), ArchivedUser.id.desc())
        .all()
    )
    return [serialize_archived_user(item) for item in archived_users]


@router.post("/archived-users/{archive_id}/restore", response_model=UserWithPasswordResponse)
def restore_archived_user(
    archive_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    archived_user = get_archived_user_or_404(db, archive_id)
    if db.query(User).filter(User.login == archived_user.login).first():
        raise HTTPException(
            status_code=400,
            detail="Нельзя восстановить сотрудника: логин уже занят действующей учетной записью",
        )

    snapshot = {}
    if archived_user.snapshot_json:
        try:
            snapshot = json.loads(archived_user.snapshot_json)
        except json.JSONDecodeError:
            snapshot = {}

    restored_password = generate_password()
    restored_user = User(
        login=archived_user.login,
        password=hash_password(restored_password),
        full_name=archived_user.full_name,
        phone=archived_user.phone,
        role_id=archived_user.role_id,
        is_active=bool(snapshot.get("is_active", True)),
        hire_date=archived_user.hire_date,
        consent_received=bool(snapshot.get("consent_received", False)),
        consent_received_at=datetime.fromisoformat(snapshot["consent_received_at"])
        if snapshot.get("consent_received_at")
        else None,
        consent_document_version=snapshot.get("consent_document_version"),
    )
    db.add(restored_user)
    db.flush()

    role_name = archived_user.role.name if archived_user.role else None
    teacher_snapshot = snapshot.get("teacher_profile") if isinstance(snapshot, dict) else None
    if role_name == "teacher" or teacher_snapshot:
        teacher_profile = Teacher(
            user_id=restored_user.id,
            bio=teacher_snapshot.get("bio") if isinstance(teacher_snapshot, dict) else None,
            experience_years=teacher_snapshot.get("experience_years")
            if isinstance(teacher_snapshot, dict)
            else None,
            specialization=teacher_snapshot.get("specialization")
            if isinstance(teacher_snapshot, dict)
            else None,
        )
        db.add(teacher_profile)

    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=restored_user.id,
        action="restore",
        old_value={"archive_id": archived_user.id, "login": archived_user.login},
        new_value={
            "login": restored_user.login,
            "full_name": restored_user.full_name,
            "phone": restored_user.phone,
            "role_id": restored_user.role_id,
            "is_active": restored_user.is_active,
            "hire_date": restored_user.hire_date,
            "consent_received": restored_user.consent_received,
            "consent_received_at": restored_user.consent_received_at,
            "consent_document_version": restored_user.consent_document_version,
        },
    )

    db.delete(archived_user)
    db.commit()
    db.refresh(restored_user)

    return UserWithPasswordResponse(
        user=serialize_user(get_user_or_404(db, restored_user.id)),
        generated_password=restored_password,
    )


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    return serialize_user(get_user_or_404(db, user_id))


@router.get("/users/{user_id}/history")
def get_user_history(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    get_user_or_404(db, user_id)
    history_items = (
        db.query(EntityChangeLog)
        .options(joinedload(EntityChangeLog.actor_user))
        .filter(EntityChangeLog.entity == "user")
        .filter(EntityChangeLog.entity_id == user_id)
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
    return [serialize_history_item(item) for item in history_items]


@router.get("/users/{user_id}/export/xlsx")
def export_user_xlsx(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    user = get_user_or_404(db, user_id)

    rows: list[list[str]] = [
        ["Поле", "Значение"],
        ["ID", user.id],
        ["Логин", user.login],
        ["ФИО", user.full_name or ""],
        ["Телефон", user.phone or ""],
        ["Роль", user.role.name if user.role else ""],
        ["Активен", "Да" if user.is_active else "Нет"],
        ["Дата начала работы", user.hire_date.isoformat() if user.hire_date else ""],
        ["Согласие на обработку ПДн", "Да" if user.consent_received else "Нет"],
        ["Дата получения согласия", user.consent_received_at.isoformat() if user.consent_received_at else ""],
        ["Версия документа согласия", user.consent_document_version or ""],
        ["Создан", user.created_at.isoformat() if user.created_at else ""],
        ["Обновлен", user.updated_at.isoformat() if user.updated_at else ""],
    ]

    output = BytesIO(build_xlsx_bytes(rows))
    filename = f"user_{user.id}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/users", response_model=UserWithPasswordResponse)
def create_user(
    data: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    role = get_role_or_404(db, data.role_id)
    ensure_role_assignable(current_user, role)

    existing_user = db.query(User).filter(User.login == data.login).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")

    password = data.password
    generated_password = None

    if data.generate_password or not password:
        generated_password = generate_password()
        password = generated_password
    elif not is_strong_password(password):
        raise HTTPException(
            status_code=400,
            detail="Пароль должен быть не короче 8 символов и содержать буквы и цифры",
        )

    new_user = User(
        login=data.login,
        password=hash_password(password),
        full_name=data.full_name,
        phone=data.phone,
        role_id=data.role_id,
        is_active=data.is_active,
        hire_date=data.hire_date,
        consent_received=data.consent_received,
        consent_received_at=data.consent_received_at,
        consent_document_version=data.consent_document_version,
    )

    db.add(new_user)
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=new_user.id,
        action="create",
        new_value={
            "login": new_user.login,
            "full_name": new_user.full_name,
            "phone": new_user.phone,
            "role_id": new_user.role_id,
            "is_active": new_user.is_active,
            "hire_date": new_user.hire_date,
            "consent_received": new_user.consent_received,
            "consent_received_at": new_user.consent_received_at,
            "consent_document_version": new_user.consent_document_version,
        },
    )
    db.commit()
    db.refresh(new_user)

    user = get_user_or_404(db, new_user.id)
    return UserWithPasswordResponse(
        user=serialize_user(user),
        generated_password=generated_password,
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)
    changes: dict[str, tuple[object, object]] = {}

    if current_user.id == user_id and data.is_active is False:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

    if data.login is not None and data.login != target_user.login:
        existing_user = db.query(User).filter(User.login == data.login).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Пользователь с таким логином уже существует")
        changes["login"] = (target_user.login, data.login)
        target_user.login = data.login

    if data.role_id is not None and current_user.id != user_id:
        role = get_role_or_404(db, data.role_id)
        ensure_role_assignable(current_user, role)
        changes["role_id"] = (target_user.role_id, data.role_id)
        target_user.role_id = data.role_id

    if data.full_name is not None:
        changes["full_name"] = (target_user.full_name, data.full_name)
        target_user.full_name = data.full_name
    if data.phone is not None:
        changes["phone"] = (target_user.phone, data.phone)
        target_user.phone = data.phone
    if data.is_active is not None:
        changes["is_active"] = (target_user.is_active, data.is_active)
        target_user.is_active = data.is_active
    if data.hire_date is not None:
        changes["hire_date"] = (target_user.hire_date, data.hire_date)
        target_user.hire_date = data.hire_date
    if "consent_received" in data.model_fields_set:
        changes["consent_received"] = (target_user.consent_received, data.consent_received)
        target_user.consent_received = data.consent_received
    if "consent_received_at" in data.model_fields_set:
        changes["consent_received_at"] = (target_user.consent_received_at, data.consent_received_at)
        target_user.consent_received_at = data.consent_received_at
    if "consent_document_version" in data.model_fields_set:
        changes["consent_document_version"] = (
            target_user.consent_document_version,
            data.consent_document_version,
        )
        target_user.consent_document_version = data.consent_document_version

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=target_user.id,
        changes=changes,
    )
    db.commit()
    db.refresh(target_user)

    return serialize_user(get_user_or_404(db, target_user.id))


@router.post("/users/{user_id}/reset-password", response_model=UserWithPasswordResponse)
def reset_user_password(
    user_id: int,
    data: UserPasswordResetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)

    password = data.password
    generated_password = None

    if data.generate_password or not password:
        generated_password = generate_password()
        password = generated_password
    elif not is_strong_password(password):
        raise HTTPException(
            status_code=400,
            detail="Пароль должен быть не короче 8 символов и содержать буквы и цифры",
        )

    target_user.password = hash_password(password)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=target_user.id,
        action="reset_password",
        field_name="password",
        old_value="hidden",
        new_value="hidden",
    )
    db.commit()
    db.refresh(target_user)

    return UserWithPasswordResponse(
        user=serialize_user(get_user_or_404(db, target_user.id)),
        generated_password=generated_password,
    )


@router.post("/users/{user_id}/block", response_model=UserResponse)
def block_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Нельзя заблокировать самого себя")

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=target_user.id,
        action="block",
        field_name="is_active",
        old_value=target_user.is_active,
        new_value=False,
    )
    target_user.is_active = False
    db.commit()
    db.refresh(target_user)
    return serialize_user(get_user_or_404(db, target_user.id))


@router.post("/users/{user_id}/unblock", response_model=UserResponse)
def unblock_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=target_user.id,
        action="unblock",
        field_name="is_active",
        old_value=target_user.is_active,
        new_value=True,
    )
    target_user.is_active = True
    db.commit()
    db.refresh(target_user)
    return serialize_user(get_user_or_404(db, target_user.id))


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")

    target_user = get_user_or_404(db, user_id)
    ensure_manageable_by_current_user(current_user, target_user)

    teacher_profile = db.query(Teacher).filter(Teacher.user_id == target_user.id).first()
    if teacher_profile is not None:
        has_schedule_events = (
            db.query(ScheduleEvent.id)
            .filter(ScheduleEvent.teacher_id == teacher_profile.id)
            .first()
        )
        has_waitlist_entries = (
            db.query(StudentWaitlist.id)
            .filter(StudentWaitlist.teacher_id == teacher_profile.id)
            .first()
        )

        if has_schedule_events and has_waitlist_entries:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Нельзя удалить преподавателя, пока у него есть связанные занятия в расписании "
                    "и записи в листе ожидания. Перенесите или удалите связанные данные, либо "
                    "заблокируйте учетную запись."
                ),
            )

        if has_schedule_events:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Нельзя удалить преподавателя, пока у него есть связанные занятия в расписании. "
                    "Перенесите или удалите занятия, либо заблокируйте учетную запись."
                ),
            )

        if has_waitlist_entries:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Нельзя удалить преподавателя, пока у него есть записи в листе ожидания. "
                    "Переназначьте преподавателя в листе ожидания или заблокируйте учетную запись."
                ),
            )

    snapshot = {
        "id": target_user.id,
        "login": target_user.login,
        "full_name": target_user.full_name,
        "phone": target_user.phone,
        "role_id": target_user.role_id,
        "hire_date": target_user.hire_date.isoformat() if target_user.hire_date else None,
        "is_active": bool(target_user.is_active),
        "consent_received": bool(target_user.consent_received),
        "consent_received_at": target_user.consent_received_at.isoformat() if target_user.consent_received_at else None,
        "consent_document_version": target_user.consent_document_version,
        "created_at": target_user.created_at.isoformat() if target_user.created_at else None,
        "updated_at": target_user.updated_at.isoformat() if target_user.updated_at else None,
    }
    if teacher_profile is not None:
        snapshot["teacher_profile"] = {
            "bio": teacher_profile.bio,
            "experience_years": teacher_profile.experience_years,
            "specialization": teacher_profile.specialization,
        }

    db.add(
        ArchivedUser(
            original_user_id=target_user.id,
            login=target_user.login,
            full_name=target_user.full_name,
            phone=target_user.phone,
            role_id=target_user.role_id,
            hire_date=target_user.hire_date,
            archived_by=current_user.id,
            snapshot_json=json.dumps(snapshot, ensure_ascii=False),
        )
    )
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="user",
        entity_id=target_user.id,
        action="delete",
        old_value=snapshot,
    )

    from models.refreshToken import RefreshToken

    db.query(RefreshToken).filter(RefreshToken.user_id == user_id).delete()
    user_documents = db.query(UserDocument).filter(UserDocument.user_id == user_id).all()
    for document in user_documents:
        delete_document_file(document.file_path)
        db.delete(document)
    db.flush()
    if teacher_profile is not None:
        db.delete(teacher_profile)
        db.flush()
    db.delete(target_user)
    db.commit()

    return {"message": "Пользователь успешно удален"}
