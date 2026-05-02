from pydantic import BaseModel, field_validator


class TariffBase(BaseModel):
    name: str
    type: str
    lessons_per_week: int
    price_per_lesson: float
    duration_months: int

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = (value or "").strip()
        if not normalized:
            raise ValueError("Tariff name is required")
        return normalized

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in {"individual", "group"}:
            raise ValueError("Tariff type must be 'individual' or 'group'")
        return normalized

    @field_validator("lessons_per_week")
    @classmethod
    def validate_lessons_per_week(cls, value: int) -> int:
        if value not in {1, 2}:
            raise ValueError("Lessons per week must be 1 or 2")
        return value

    @field_validator("price_per_lesson")
    @classmethod
    def validate_price_per_lesson(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Price per lesson must be greater than 0")
        return value

    @field_validator("duration_months")
    @classmethod
    def validate_duration_months(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Duration in months must be at least 1")
        return value


class TariffCreate(TariffBase):
    pass


class TariffResponse(TariffBase):
    id: int

    class Config:
        from_attributes = True
