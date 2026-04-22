from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from .base import Base


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"))
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"))
    amount = Column(Numeric(10, 2))
    method = Column(String(50))
    paid_at = Column(DateTime, server_default=func.now())
    comment = Column(Text)
    status = Column(String(50))
