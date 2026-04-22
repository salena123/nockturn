from sqlalchemy import Column, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class ScheduleHistory(Base):
    __tablename__ = "schedule_history"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule_events.id"))
    changed_by = Column(Integer, ForeignKey("users.id"))
    old_start = Column(DateTime)
    new_start = Column(DateTime)
    changed_at = Column(DateTime)

    schedule = relationship("ScheduleEvent", backref="history")
    changed_by_user = relationship("User", backref="schedule_changes")
