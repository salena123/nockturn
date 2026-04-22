from sqlalchemy import Column, Integer, String, Numeric
from .base import Base


class DiscountRule(Base):
    __tablename__ = "discount_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    type = Column(String(20))  # fixed/percentage
    value = Column(Numeric(10, 2))
