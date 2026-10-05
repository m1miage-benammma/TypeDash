from pydantic import BaseModel


class CalculatorResponse(BaseModel):
    characters: int
    seconds: int
    errors: int
    gross_wpm: float
    adjusted_wpm: float
    accuracy: float
