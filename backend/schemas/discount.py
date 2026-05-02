from pydantic import BaseModel, field_validator, model_validator


class DiscountBase(BaseModel):
    name: str
    type: str
    value: float
    condition: str | None = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in {"fixed", "percentage"}:
            raise ValueError("Discount type must be 'fixed' or 'percentage'")
        return normalized

    @field_validator("value")
    @classmethod
    def validate_value(cls, value: float) -> float:
        if value <= 0:
            raise ValueError("Discount value must be greater than 0")
        return value

    @field_validator("condition")
    @classmethod
    def normalize_condition(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_percentage_range(self):
        if self.type == "percentage" and self.value > 100:
            raise ValueError("Percentage discount cannot exceed 100")
        return self


class DiscountCreate(DiscountBase):
    pass


class DiscountResponse(DiscountBase):
    id: int

    class Config:
        from_attributes = True
