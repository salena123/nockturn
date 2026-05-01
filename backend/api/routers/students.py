from datetime import date, datetime
from io import BytesIO
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from core.access import require_admin, require_staff
from core.deps import get_current_user, get_db
from core.entity_changes import log_entity_change, log_model_updates
from models.entityChangeLog import EntityChangeLog
from models.lesson import Lesson
from models.lessonStudent import LessonStudent
from models.parent import Parent
from models.scheduleEvent import ScheduleEvent
from models.student import Student
from models.subscription import Subscription
from models.teacher import Teacher
from models.user import User
from schemas.student import StudentCreate, StudentResponse, StudentUpdate
from schemas.subscription import SubscriptionResponse


router = APIRouter(prefix="/api")

ALLOWED_LEVELS = {"начальный", "средний", "продвинутый"}
ALLOWED_STATUSES = {"потенциальный", "активный", "заморожен", "отказался"}
STATUS_ALIASES = {"новый": "потенциальный"}


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
    <sheet name="Student" sheetId="1" r:id="rId1"/>
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


def get_age(birth_date: date | None) -> int | None:
    if not birth_date:
        return None

    today = date.today()
    return today.year - birth_date.year - (
        (today.month, today.day) < (birth_date.month, birth_date.day)
    )


def is_teacher_user(user: User) -> bool:
    return getattr(getattr(user, "role", None), "name", None) == "teacher"


def get_teacher_for_current_user(db: Session, current_user: User) -> Teacher | None:
    if not is_teacher_user(current_user):
        return None

    return db.query(Teacher).filter(Teacher.user_id == current_user.id).first()


def apply_teacher_student_scope(query, teacher: Teacher | None):
    if teacher is None:
        return query

    return (
        query.join(Student.lesson_students)
        .join(LessonStudent.lesson)
        .join(Lesson.schedule)
        .filter(ScheduleEvent.teacher_id == teacher.id)
        .distinct()
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


def validate_student_payload(data: StudentCreate | StudentUpdate, is_create: bool = False) -> None:
    if getattr(data, "level", None) is not None:
        normalized_level = data.level.strip().lower() if data.level else None
        data.level = normalized_level
        if normalized_level not in ALLOWED_LEVELS:
            raise HTTPException(
                status_code=400,
                detail=f"Некорректный уровень подготовки. Допустимые значения: {', '.join(sorted(ALLOWED_LEVELS))}",
            )

    if getattr(data, "status", None) is not None:
        normalized_status = data.status.strip().lower() if data.status else None
        normalized_status = STATUS_ALIASES.get(normalized_status, normalized_status)
        data.status = normalized_status
        if normalized_status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail=f"Некорректный статус ученика. Допустимые значения: {', '.join(sorted(ALLOWED_STATUSES))}",
            )

    if is_create and not (data.phone or data.parent_phone):
        raise HTTPException(status_code=400, detail="Нужно указать основной номер телефона")

    age = get_age(getattr(data, "birth_date", None))
    if age is not None and age < 18:
        if not getattr(data, "has_parent", False):
            raise HTTPException(
                status_code=400,
                detail="Для несовершеннолетнего ученика нужно указать ответственное лицо",
            )
        if not getattr(data, "parent_name", None):
            raise HTTPException(
                status_code=400,
                detail="Для несовершеннолетнего ученика нужно указать ФИО ответственного лица",
            )


def get_or_create_parent(
    db: Session,
    name: str,
    phone: str | None,
    telegram_id: int | None = None,
) -> Parent:
    if not name:
        raise HTTPException(status_code=400, detail="Нужно указать ФИО ответственного лица")

    parent = None

    if telegram_id is not None:
        parent = db.query(Parent).filter(Parent.telegram_id == telegram_id).first()

    if not parent:
        for existing_parent in db.query(Parent).all():
            same_name = existing_parent.full_name == name
            same_phone = existing_parent.phone == phone
            if same_name and same_phone:
                parent = existing_parent
                break

    if not parent:
        parent = Parent(full_name=name, phone=phone, telegram_id=telegram_id)
        db.add(parent)
        db.flush()

    return parent


def serialize_student(student: Student) -> StudentResponse:
    parent = None
    if student.parent:
        parent = {
            "id": student.parent.id,
            "full_name": student.parent.full_name,
            "phone": student.parent.phone,
            "email": student.parent.email,
            "telegram_id": student.parent.telegram_id,
        }

    return StudentResponse(
        id=student.id,
        fio=student.fio,
        phone=student.phone,
        email=student.email,
        has_parent=bool(student.has_parent),
        parent_id=student.parent_id,
        parent_name=student.parent_name,
        parent=parent,
        address=student.address,
        level=student.level,
        status=student.status,
        comment=student.comment,
        first_contact_date=student.first_contact_date,
        birth_date=student.birth_date,
        consent_received=bool(student.consent_received),
        consent_received_at=student.consent_received_at,
        consent_document_version=student.consent_document_version,
        age=get_age(student.birth_date),
    )


def get_student_or_404(db: Session, student_id: int) -> Student:
    student = (
        db.query(Student)
        .options(joinedload(Student.parent))
        .filter(Student.id == student_id)
        .first()
    )
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")
    return student


def ensure_student_access(db: Session, current_user: User, student_id: int) -> Student:
    student = get_student_or_404(db, student_id)
    teacher = get_teacher_for_current_user(db, current_user)

    if teacher is None:
        return student

    is_accessible = (
        db.query(LessonStudent.id)
        .join(LessonStudent.lesson)
        .join(Lesson.schedule)
        .filter(LessonStudent.student_id == student_id)
        .filter(ScheduleEvent.teacher_id == teacher.id)
        .first()
    )

    if not is_accessible:
        raise HTTPException(status_code=403, detail="У вас нет доступа к этому ученику")

    return student


@router.post("/students", response_model=StudentResponse)
def create_student(
    data: StudentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    validate_student_payload(data, is_create=True)

    parent = None
    status = data.status or "потенциальный"

    if data.has_parent:
        parent = get_or_create_parent(
            db,
            data.parent_name,
            data.parent_phone,
            data.parent_telegram_id,
        )

    new_student = Student(
        fio=data.fio,
        phone=data.phone or data.parent_phone,
        email=data.email,
        has_parent=data.has_parent,
        parent_id=parent.id if parent else None,
        parent_name=parent.full_name if parent else None,
        address=data.address,
        level=data.level,
        status=status,
        comment=data.comment,
        first_contact_date=data.first_contact_date,
        birth_date=data.birth_date,
        consent_received=data.consent_received,
        consent_received_at=data.consent_received_at,
        consent_document_version=data.consent_document_version,
    )

    db.add(new_student)
    db.flush()
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student",
        entity_id=new_student.id,
        action="create",
        new_value={
            "fio": new_student.fio,
            "phone": new_student.phone,
            "email": new_student.email,
            "has_parent": new_student.has_parent,
            "parent_id": new_student.parent_id,
            "parent_name": new_student.parent_name,
            "address": new_student.address,
            "level": new_student.level,
            "status": new_student.status,
            "comment": new_student.comment,
            "first_contact_date": new_student.first_contact_date,
            "birth_date": new_student.birth_date,
            "consent_received": new_student.consent_received,
            "consent_received_at": new_student.consent_received_at,
            "consent_document_version": new_student.consent_document_version,
        },
    )
    db.commit()
    db.refresh(new_student)
    return serialize_student(get_student_or_404(db, new_student.id))


@router.get("/students", response_model=list[StudentResponse])
def get_students(
    status: str | None = None,
    level: str | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)

    query = db.query(Student).options(joinedload(Student.parent))
    query = apply_teacher_student_scope(query, get_teacher_for_current_user(db, current_user))

    if status is not None:
        query = query.filter(Student.status == status)
    if level is not None:
        query = query.filter(Student.level == level)

    students = query.order_by(Student.created_at.desc(), Student.id.desc()).all()
    return [serialize_student(student) for student in students]


@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    return serialize_student(ensure_student_access(db, current_user, student_id))


@router.get("/students/{student_id}/history")
def get_student_history(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_student_access(db, current_user, student_id)
    history_items = (
        db.query(EntityChangeLog)
        .options(joinedload(EntityChangeLog.actor_user))
        .filter(EntityChangeLog.entity == "student")
        .filter(EntityChangeLog.entity_id == student_id)
        .order_by(EntityChangeLog.created_at.desc(), EntityChangeLog.id.desc())
        .all()
    )
    return [serialize_history_item(item) for item in history_items]


@router.get("/students/{student_id}/export/xlsx")
def export_student_xlsx(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    student = ensure_student_access(db, current_user, student_id)
    parent_phone = student.parent.phone if student.parent else None

    rows: list[list[str | int | float]] = [
        ["Поле", "Значение"],
        ["ID", student.id],
        ["ФИО ученика", student.fio],
        ["Возраст", get_age(student.birth_date) or ""],
        ["Дата рождения", student.birth_date.isoformat() if student.birth_date else ""],
        ["Основной телефон", student.phone or ""],
        ["Email", student.email or ""],
        ["Адрес проживания", student.address or ""],
        ["Уровень подготовки", student.level or ""],
        ["Статус", student.status or ""],
        ["Комментарий", student.comment or ""],
        ["Дата первого обращения", student.first_contact_date.isoformat() if student.first_contact_date else ""],
        ["Есть ответственное лицо", "Да" if student.has_parent else "Нет"],
        ["ФИО ответственного лица", student.parent_name or ""],
        ["Телефон ответственного лица", parent_phone or ""],
        ["Согласие на обработку ПДн", "Да" if student.consent_received else "Нет"],
        ["Дата получения согласия", student.consent_received_at.isoformat() if student.consent_received_at else ""],
        ["Версия документа согласия", student.consent_document_version or ""],
    ]

    output = BytesIO(build_xlsx_bytes(rows))
    filename = f"student_{student.id}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/students/{student_id}/subscriptions", response_model=list[SubscriptionResponse])
def get_student_subscriptions(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_staff(current_user)
    ensure_student_access(db, current_user, student_id)

    subscriptions = (
        db.query(Subscription)
        .filter(Subscription.student_id == student_id)
        .order_by(Subscription.created_at.desc(), Subscription.id.desc())
        .all()
    )

    return subscriptions


@router.get("/students/{student_id}/upcoming-lessons-summary")
def get_student_upcoming_lessons_summary(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    student = get_student_or_404(db, student_id)
    now = datetime.now()

    upcoming_lessons = (
        db.query(Lesson)
        .options(
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.teacher).joinedload(Teacher.user),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.room),
            joinedload(Lesson.schedule).joinedload(ScheduleEvent.discipline),
        )
        .join(Lesson.lesson_students)
        .join(Lesson.schedule)
        .filter(LessonStudent.student_id == student_id)
        .filter(ScheduleEvent.start_time > now)
        .order_by(ScheduleEvent.start_time.asc())
        .all()
    )

    items = []
    for lesson in upcoming_lessons[:5]:
        schedule = lesson.schedule
        teacher_name = None
        if schedule and schedule.teacher and schedule.teacher.user:
            teacher_name = schedule.teacher.user.full_name or schedule.teacher.user.login

        items.append(
            {
                "lesson_id": lesson.id,
                "event_id": schedule.id if schedule else None,
                "start_time": schedule.start_time if schedule else None,
                "end_time": schedule.end_time if schedule else None,
                "teacher_name": teacher_name,
                "room_name": schedule.room.name if schedule and schedule.room else None,
                "discipline_name": schedule.discipline.name if schedule and schedule.discipline else None,
            }
        )

    return {
        "student_id": student.id,
        "student_name": student.fio,
        "upcoming_lessons_count": len(upcoming_lessons),
        "items": items,
    }


@router.put("/students/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    data: StudentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)
    validate_student_payload(data, is_create=False)

    student = get_student_or_404(db, student_id)
    changes: dict[str, tuple[object, object]] = {}

    if data.fio is not None:
        changes["fio"] = (student.fio, data.fio)
        student.fio = data.fio
    if data.phone is not None:
        changes["phone"] = (student.phone, data.phone)
        student.phone = data.phone
    if data.email is not None:
        changes["email"] = (student.email, data.email)
        student.email = data.email
    if data.address is not None:
        changes["address"] = (student.address, data.address)
        student.address = data.address
    if data.level is not None:
        changes["level"] = (student.level, data.level)
        student.level = data.level
    if data.status is not None:
        changes["status"] = (student.status, data.status)
        student.status = data.status
    if data.comment is not None:
        changes["comment"] = (student.comment, data.comment)
        student.comment = data.comment
    if data.first_contact_date is not None:
        changes["first_contact_date"] = (student.first_contact_date, data.first_contact_date)
        student.first_contact_date = data.first_contact_date
    if data.birth_date is not None:
        changes["birth_date"] = (student.birth_date, data.birth_date)
        student.birth_date = data.birth_date
    if "consent_received" in data.model_fields_set:
        changes["consent_received"] = (student.consent_received, data.consent_received)
        student.consent_received = data.consent_received
    if "consent_received_at" in data.model_fields_set:
        changes["consent_received_at"] = (student.consent_received_at, data.consent_received_at)
        student.consent_received_at = data.consent_received_at
    if "consent_document_version" in data.model_fields_set:
        changes["consent_document_version"] = (
            student.consent_document_version,
            data.consent_document_version,
        )
        student.consent_document_version = data.consent_document_version

    if data.has_parent is not None:
        changes["has_parent"] = (student.has_parent, data.has_parent)
        student.has_parent = data.has_parent

    if student.has_parent:
        parent_name = data.parent_name or student.parent_name
        parent_phone = data.parent_phone or (student.parent.phone if student.parent else student.phone)
        parent_telegram_id = (
            data.parent_telegram_id
            if data.parent_telegram_id is not None
            else (student.parent.telegram_id if student.parent else None)
        )

        if not parent_name:
            raise HTTPException(status_code=400, detail="Нужно указать ФИО ответственного лица")

        if student.parent_id:
            existing_parent = db.query(Parent).filter(Parent.id == student.parent_id).first()
            if existing_parent:
                changes["parent_name"] = (student.parent_name, parent_name)
                changes["parent_phone"] = (existing_parent.phone, parent_phone)
                existing_parent.full_name = parent_name
                existing_parent.phone = parent_phone
                if data.parent_telegram_id is not None:
                    existing_parent.telegram_id = data.parent_telegram_id
                student.parent_name = existing_parent.full_name
            else:
                parent = get_or_create_parent(db, parent_name, parent_phone, parent_telegram_id)
                changes["parent_id"] = (student.parent_id, parent.id)
                changes["parent_name"] = (student.parent_name, parent.full_name)
                student.parent_id = parent.id
                student.parent_name = parent.full_name
        else:
            parent = get_or_create_parent(db, parent_name, parent_phone, parent_telegram_id)
            changes["parent_id"] = (student.parent_id, parent.id)
            changes["parent_name"] = (student.parent_name, parent.full_name)
            student.parent_id = parent.id
            student.parent_name = parent.full_name

        if data.phone is None and parent_phone and not student.phone:
            changes["phone"] = (student.phone, parent_phone)
            student.phone = parent_phone
    else:
        changes["parent_id"] = (student.parent_id, None)
        changes["parent_name"] = (student.parent_name, None)
        student.parent_id = None
        student.parent_name = None

    log_model_updates(
        db,
        actor_user_id=current_user.id,
        entity="student",
        entity_id=student.id,
        changes=changes,
    )
    db.commit()
    db.refresh(student)
    return serialize_student(get_student_or_404(db, student.id))


@router.delete("/students/{student_id}")
def delete_student(
    student_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_admin(current_user)

    student = get_student_or_404(db, student_id)
    log_entity_change(
        db,
        actor_user_id=current_user.id,
        entity="student",
        entity_id=student.id,
        action="delete",
        old_value={
            "fio": student.fio,
            "phone": student.phone,
            "email": student.email,
            "parent_id": student.parent_id,
            "parent_name": student.parent_name,
            "status": student.status,
            "consent_received": student.consent_received,
            "consent_received_at": student.consent_received_at,
            "consent_document_version": student.consent_document_version,
        },
    )
    db.delete(student)
    db.commit()

    return {"message": "Ученик успешно удален"}
