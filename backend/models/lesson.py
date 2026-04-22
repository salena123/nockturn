from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule_events.id"))
    lesson_date = Column(Date)
    status = Column(String(50), default='planned')
    created_at = Column(DateTime)

    schedule = relationship("ScheduleEvent", backref="lessons")
