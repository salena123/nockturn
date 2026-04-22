from sqlalchemy import Column, Integer, String, Date, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class ScheduleRecurring(Base):
    __tablename__ = "schedule_recurring"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule_events.id"))
    repeat_type = Column(String(50))
    repeat_until = Column(Date)

    schedule = relationship("ScheduleEvent", backref="recurring")
