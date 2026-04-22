from sqlalchemy import Column, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class LessonIssue(Base):
    __tablename__ = "lesson_issues"

    id = Column(Integer, primary_key=True, index=True)
    lesson_id = Column(Integer, ForeignKey("lessons.id"))
    description = Column(Text)
    created_at = Column(DateTime)

    lesson = relationship("Lesson", backref="issues")
