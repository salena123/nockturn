from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from core.encrypted_types import EncryptedText

from .base import Base


class ArchivedUser(Base):
    __tablename__ = "archived_users"

    id = Column(Integer, primary_key=True, index=True)
    original_user_id = Column(Integer, index=True)
    login = Column(String(255), nullable=False)
    full_name = Column(EncryptedText())
    phone = Column(EncryptedText())
    role_id = Column(Integer, ForeignKey("roles.id"))
    hire_date = Column(Date)
    archived_at = Column(DateTime, server_default=func.now())
    archived_by = Column(Integer, ForeignKey("users.id"))
    snapshot_json = Column(EncryptedText())

    role = relationship("Role", backref="archived_users")
    archived_by_user = relationship("User", foreign_keys=[archived_by], backref="archived_users_created")
