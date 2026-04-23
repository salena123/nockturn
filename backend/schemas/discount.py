from pydantic import BaseModel


class DiscountBase(BaseModel):
    name: str
    type: str  
    value: float


class DiscountCreate(DiscountBase):
    pass


class DiscountResponse(DiscountBase):
    id: int

    class Config:
        from_attributes = True
