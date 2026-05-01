from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, String, func, text
from sqlalchemy.orm import relationship
from .base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(255), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    full_name = Column(String(255))
    phone = Column(String(20))
    role_id = Column(Integer, ForeignKey("roles.id"))
    is_active = Column(Boolean, default=True, server_default=text("true"))
    hire_date = Column(Date)
    failed_login_attempts = Column(Integer, default=0, server_default=text("0"), nullable=False)
    locked_until = Column(DateTime)
    last_login_at = Column(DateTime)
    last_login_ip = Column(String(64))

    role = relationship("Role", backref="users")
    refresh_tokens = relationship("RefreshToken", back_populates="user")
