from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .base import Base


class EntityChangeLog(Base):
    __tablename__ = "entity_change_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String(64))
    entity = Column(String(100), nullable=False)
    entity_id = Column(Integer, nullable=False)
    field_name = Column(String(100))
    old_value = Column(Text)
    new_value = Column(Text)
    action = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    actor_user = relationship("User", backref="entity_change_logs")
