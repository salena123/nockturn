from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import relationship

from core.encrypted_types import EncryptedText
from .base import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    fio = Column(EncryptedText(), nullable=False)
    phone = Column(EncryptedText())
    email = Column(EncryptedText(), index=True)
    has_parent = Column(Boolean, default=False, server_default=text("false"))
    parent_id = Column(Integer, ForeignKey("parents.id"), index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    birth_date = Column(Date)
    parent_name = Column(EncryptedText())
    address = Column(EncryptedText())
    level = Column(String(50))
    status = Column(String(50))
    comment = Column(EncryptedText())
    first_contact_date = Column(Date)
    consent_received = Column(Boolean, default=False, server_default=text("false"), nullable=False)
    consent_received_at = Column(DateTime)
    bot_mailing_consent = Column(Boolean, default=False, server_default=text("false"), nullable=False)

    parent = relationship("Parent", backref="students")
