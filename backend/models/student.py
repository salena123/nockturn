from sqlalchemy import Column, Integer, String, Text, Boolean, Date, DateTime, ForeignKey
from datetime import datetime
from sqlalchemy.orm import relationship
from .base import Base

class Student(Base):
    __tablename__ = "students"
    
    id = Column(Integer, primary_key=True, index=True)
    fio = Column(String, nullable=False)
    phone = Column(String(11))
    email = Column(String)
    has_parent = Column(Boolean, default=False)
    parent_id = Column(Integer, ForeignKey("parents.id"))
    parent = relationship("Parent", backref="students")
    parent_name = Column(String)
    address = Column(Text)
    level = Column(String)
    status = Column(String)
    comment = Column(Text)
    first_contact_date = Column(Date)
    birth_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
