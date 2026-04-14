from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from datetime import datetime
from sqlalchemy.orm import relationship
from .base import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    login = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    role = relationship("Role", backref="users")
    full_name = Column(String)
    phone = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
