from pydantic import BaseModel


class TariffBase(BaseModel):
    name: str
    type: str  
    lessons_per_week: int
    price_per_lesson: float
    duration_months: int


class TariffCreate(TariffBase):
    pass


class TariffResponse(TariffBase):
    id: int

    class Config:
        from_attributes = True
