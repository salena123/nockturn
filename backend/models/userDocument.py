from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .base import Base


class UserDocument(Base):
    __tablename__ = "user_documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    document_type = Column(String(100), nullable=False)
    file_path = Column(Text, nullable=False)
    is_encrypted = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", backref="documents")
