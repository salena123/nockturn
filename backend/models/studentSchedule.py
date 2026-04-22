from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, UniqueConstraint, func, text
from .base import Base


class StudentSchedule(Base):
    __tablename__ = "student_schedule"
    __table_args__ = (
        UniqueConstraint("student_id", "schedule_id", name="unique_student_schedule"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id", ondelete="CASCADE"))
    schedule_id = Column(Integer, ForeignKey("schedule_events.id", ondelete="CASCADE"))
    is_active = Column(Boolean, default=True, server_default=text("true"))
    created_at = Column(DateTime, server_default=func.now())
