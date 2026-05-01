from sqlalchemy import Column, Integer

from core.encrypted_types import EncryptedText
from .base import Base


class Parent(Base):
    __tablename__ = "parents"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(EncryptedText())
    phone = Column(EncryptedText())
    email = Column(EncryptedText())
    telegram_id = Column(Integer)
