from datetime import datetime
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func, text
from sqlalchemy.orm import relationship
from .base import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)

    student_id = Column(Integer, ForeignKey("students.id"))
    tariff_id = Column(Integer, ForeignKey("tariffs.id"))
    discount_id = Column(Integer, ForeignKey("discount_rules.id"), nullable=True)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow, server_default=func.now())
    lessons_total = Column(Integer)
    balance_lessons = Column(Integer, default=0, server_default=text("0"))
    price_per_lesson = Column(Numeric(10, 2))
    total_price = Column(Numeric(10, 2))
    freeze_start_date = Column(Date, nullable=True)
    freeze_end_date = Column(Date, nullable=True)
    freeze_reason = Column(Text, nullable=True)

    student = relationship("Student", backref="subscriptions")
