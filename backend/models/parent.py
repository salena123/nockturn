from sqlalchemy import Column, Integer, String
from .base import Base

class Parent(Base):
    __tablename__ = 'parents'

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    phone = Column(String(20))
    email = Column(String)
    telegram_id = Column(Integer, unique=True, index=True)
