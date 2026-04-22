from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, Numeric, String, Text, text
from sqlalchemy.orm import relationship
from .base import Base


class LessonAttendance(Base):
    __tablename__ = "lesson_attendance"
    __table_args__ = (
        CheckConstraint(
            "status IN ('done', 'miss_valid', 'miss_invalid')",
            name="check_status",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"))
    student_id = Column(Integer, ForeignKey("students.id"))
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    status = Column(String(50))  # done / miss_valid / miss_invalid
    comment = Column(Text)
    price_per_lesson = Column(Numeric(10, 2))
    is_charged = Column(Boolean, default=False, server_default=text("false"))

    student = relationship("Student", backref="lesson_attendance")
    subscription = relationship("Subscription", backref="lesson_attendance")
