from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from .base import Base


class StudentWaitlist(Base):
    __tablename__ = "student_waitlist"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False, index=True)
    teacher_id = Column(Integer, ForeignKey("teachers.id"), index=True)
    discipline_id = Column(Integer, ForeignKey("disciplines.id"), index=True)
    desired_schedule_text = Column(Text)
    comment = Column(Text)
    status = Column(String(50), server_default="waiting")
    created_at = Column(DateTime, server_default=func.now())

    student = relationship("Student", backref="waitlist_entries")
    teacher = relationship("Teacher", backref="waitlist_entries")
    discipline = relationship("Discipline", backref="waitlist_entries")
