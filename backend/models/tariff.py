from sqlalchemy import Column, Integer, String, Numeric
from .base import Base


class Tariff(Base):
    __tablename__ = "tariffs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  
    lessons_per_week = Column(Integer, nullable=False)  
    price_per_lesson = Column(Numeric(10, 2), nullable=False)
    duration_months = Column(Integer, nullable=False)