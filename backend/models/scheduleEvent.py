from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class ScheduleEvent(Base):
    __tablename__ = "schedule_events"

    id = Column(Integer, primary_key=True, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"))
    discipline_id = Column(Integer, ForeignKey("disciplines.id"))
    room_id = Column(Integer, ForeignKey("rooms.id"))
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    type = Column(String(50))
    created_at = Column(DateTime)

    teacher = relationship("Teacher", backref="schedule_events")
    discipline = relationship("Discipline", backref="schedule_events")
    room = relationship("Room", backref="schedule_events")
