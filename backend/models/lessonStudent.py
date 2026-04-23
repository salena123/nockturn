from sqlalchemy import Column, Integer, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from .base import Base


class LessonStudent(Base):
    __tablename__ = "lesson_students"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id", ondelete="CASCADE"))
    student_id = Column(Integer, ForeignKey("students.id"))
    enrolled_at = Column(DateTime)

    lesson = relationship("Lesson", backref="lesson_students")
    student = relationship("Student", backref="lesson_students")
