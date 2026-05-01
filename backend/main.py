from fastapi import FastAPI
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
    ]
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


Base.metadata.create_all(bind=engine)
ensure_extended_schema()
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
