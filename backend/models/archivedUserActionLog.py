from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .base import Base


class ArchivedUserActionLog(Base):
    __tablename__ = "archived_user_action_logs"

    id = Column(Integer, primary_key=True, index=True)
    archived_user_id = Column(Integer, ForeignKey("archived_users.id"), nullable=False, index=True)
    original_log_id = Column(Integer, index=True)
    actor_user_id = Column(Integer)
    actor_user_name = Column(String(255))
    ip_address = Column(String(64))
    entity = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    action = Column(String(50), nullable=False)
    archived_context = Column(String(50), nullable=False, server_default="performed_action")
    created_at = Column(DateTime, nullable=False)
    archived_at = Column(DateTime, server_default=func.now(), nullable=False)

    archived_user = relationship("ArchivedUser", backref="archived_action_logs")
