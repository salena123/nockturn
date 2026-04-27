from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, text as sql_text
from sqlalchemy.orm import relationship

from .base import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    note_id = Column(Integer, ForeignKey("notes.id"), nullable=True)
    text = Column(Text, nullable=False)
    type = Column(String(50), nullable=True)
    is_read = Column(Boolean, nullable=False, default=False, server_default=sql_text("false"))
    created_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    student = relationship("Student", backref="notifications")
    user = relationship("User", backref="notifications")
    note = relationship("Note", backref="notifications")
