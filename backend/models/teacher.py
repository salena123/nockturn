from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .base import Base


class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    created_at = Column(DateTime)
    updated_at = Column(DateTime)
    bio = Column(Text)
    experience_years = Column(Integer)
    specialization = Column(String(255))

    user = relationship("User", backref="teacher")
