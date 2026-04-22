from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.orm import relationship
from .base import Base


class Student(Base):
    __tablename__ = "students"

    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String(255), nullable=False)
    phone = Column(String(20))
    email = Column(String(255), index=True)
    has_parent = Column(Boolean, default=False, server_default=text("false"))
    parent_id = Column(Integer, ForeignKey("parents.id"), index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    birth_date = Column(Date)
    parent_name = Column(String(255))
    address = Column(Text)
    level = Column(String(50))
    status = Column(String(50))
    comment = Column(Text)
    first_contact_date = Column(Date)

    parent = relationship("Parent", backref="students")
