from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from api.routers import (
    attendance,
    auth,
    bot,
    discounts,
    disciplines,
    notes,
    notifications,
    payments,
    rooms,
    schedule,
    student_notes,
    student_waitlist,
    students,
    subscriptions,
    tariffs,
    teachers,
    user_documents,
    users,
)
from core.bootstrap import ensure_default_roles, ensure_default_superadmin
from core.crypto import encrypt_text, is_encrypted_text
from core.request_context import extract_client_ip, reset_request_ip, set_request_ip
from db.session import engine
from models import Base


def ensure_extended_schema() -> None:
    statements = [
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS recipient_user_id INTEGER",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal'",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id INTEGER",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS note_id INTEGER",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT false",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP",
        "CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications(user_id)",
        "CREATE INDEX IF NOT EXISTS ix_notifications_note_id ON notifications(note_id)",
        "CREATE INDEX IF NOT EXISTS ix_notes_recipient_user_id ON notes(recipient_user_id)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(64)",
        "ALTER TABLE users ALTER COLUMN full_name TYPE TEXT",
        "ALTER TABLE users ALTER COLUMN phone TYPE TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_received BOOLEAN DEFAULT false",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_received_at TIMESTAMP",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_document_version VARCHAR(100)",
        "ALTER TABLE students ALTER COLUMN fio TYPE TEXT",
        "ALTER TABLE students ALTER COLUMN phone TYPE TEXT",
        "ALTER TABLE students ALTER COLUMN email TYPE TEXT",
        "ALTER TABLE students ALTER COLUMN parent_name TYPE TEXT",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS consent_received BOOLEAN DEFAULT false",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS consent_received_at TIMESTAMP",
        "ALTER TABLE students ADD COLUMN IF NOT EXISTS consent_document_version VARCHAR(100)",
        "ALTER TABLE parents ALTER COLUMN full_name TYPE TEXT",
        "ALTER TABLE parents ALTER COLUMN phone TYPE TEXT",
        "ALTER TABLE parents ALTER COLUMN email TYPE TEXT",
        "ALTER TABLE archived_users ALTER COLUMN full_name TYPE TEXT",
        "ALTER TABLE archived_users ALTER COLUMN phone TYPE TEXT",
        "ALTER TABLE archived_users ALTER COLUMN snapshot_json TYPE TEXT",
        "ALTER TABLE entity_change_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64)",
        "ALTER TABLE user_documents ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false",
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def migrate_plaintext_personal_data() -> None:
    encrypted_columns = {
        "users": ["full_name", "phone"],
        "students": ["fio", "phone", "email", "parent_name", "address", "comment"],
        "parents": ["full_name", "phone", "email"],
        "archived_users": ["full_name", "phone", "snapshot_json"],
    }

    with engine.begin() as connection:
        for table_name, columns in encrypted_columns.items():
            rows = connection.execute(
                text(
                    f"SELECT id, {', '.join(columns)} FROM {table_name}"
                )
            ).mappings()
            for row in rows:
                updates: dict[str, str] = {}
                for column in columns:
                    value = row[column]
                    if value in (None, "") or is_encrypted_text(value):
                        continue
                    updates[column] = encrypt_text(str(value))

                if not updates:
                    continue

                assignments = ", ".join(f"{column} = :{column}" for column in updates)
                params = {"id": row["id"], **updates}
                connection.execute(
                    text(f"UPDATE {table_name} SET {assignments} WHERE id = :id"),
                    params,
                )


Base.metadata.create_all(bind=engine)
ensure_extended_schema()
migrate_plaintext_personal_data()
with Session(engine) as bootstrap_session:
    ensure_default_roles(bootstrap_session)
    ensure_default_superadmin(bootstrap_session)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def store_request_ip(request: Request, call_next):
    token = set_request_ip(extract_client_ip(request))
    try:
        response = await call_next(request)
    finally:
        reset_request_ip(token)
    return response

app.include_router(students.router)
app.include_router(users.router)
app.include_router(subscriptions.router)
app.include_router(payments.router)
app.include_router(attendance.router)
app.include_router(auth.router)
app.include_router(schedule.router)
app.include_router(disciplines.router)
app.include_router(rooms.router)
app.include_router(tariffs.router)
app.include_router(discounts.router)
app.include_router(teachers.router)
app.include_router(user_documents.router)
app.include_router(student_waitlist.router)
app.include_router(student_notes.router)
app.include_router(notifications.router)
app.include_router(notes.router)
app.include_router(bot.router)


@app.get("/health")
def healthcheck():
    return {"status": "ok", "service": "backend"}
