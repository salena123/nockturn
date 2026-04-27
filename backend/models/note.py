from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, text as sql_text
from sqlalchemy.orm import relationship

from .base import Base


class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    recipient_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    text = Column(Text, nullable=False)
    reminder_at = Column(DateTime, nullable=True)
    priority = Column(String(20), nullable=False, default="normal", server_default=sql_text("'normal'"))
    is_pinned = Column(Boolean, nullable=False, default=False, server_default=sql_text("false"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    author = relationship("User", foreign_keys=[author_id], backref="authored_notes")
    recipient = relationship("User", foreign_keys=[recipient_user_id], backref="received_notes")
