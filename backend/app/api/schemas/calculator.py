from pydantic import BaseModel, ConfigDict, StrictInt


class CalculatorRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    characters: StrictInt | str
    seconds: StrictInt | str
    errors: StrictInt | str


class CalculatorResponse(BaseModel):
    characters: int
    seconds: int
    errors: int
    gross_wpm: float
    adjusted_wpm: float
    accuracy: float
