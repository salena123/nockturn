from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, UniqueConstraint, func, text
from sqlalchemy.orm import relationship

from .base import Base


class MessengerLink(Base):
    __tablename__ = "messenger_links"
    __table_args__ = (
        UniqueConstraint("platform", "external_user_id", name="uq_messenger_links_platform_external_user_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String(20), nullable=False, index=True)
    external_user_id = Column(String(100), nullable=False, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=True, index=True)
    parent_id = Column(Integer, ForeignKey("parents.id"), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    is_confirmed = Column(Boolean, nullable=False, default=False, server_default=text("false"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    student = relationship("Student", backref="messenger_links")
    parent = relationship("Parent", backref="messenger_links")
