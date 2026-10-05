from math import isfinite

from app.api.schemas.api import ApiResponse
from app.api.schemas.calculator import CalculatorRequest, CalculatorResponse
from app.models.errors import TypingTestError


class CalculatorService:
    @staticmethod
    def defaults() -> ApiResponse[CalculatorResponse]:
        return CalculatorService.calculate(CalculatorRequest(characters=250, seconds=60, errors=0))

    @staticmethod
    def calculate(request: CalculatorRequest) -> ApiResponse[CalculatorResponse]:
        characters = CalculatorService._number(request.characters, 0, 100000)
        seconds = CalculatorService._number(request.seconds, 1, 3600)
        errors = CalculatorService._number(request.errors, 0, characters)
        minutes = seconds / 60
        gross = characters / 5 / minutes
        return ApiResponse[CalculatorResponse](data=CalculatorResponse(
            characters=characters, seconds=seconds, errors=errors,
            gross_wpm=round(gross, 1), adjusted_wpm=round(max(0, gross - errors / minutes), 1),
            accuracy=round(max(0, (characters - errors) / characters * 100), 1) if characters else 0,
        ))

    @staticmethod
    def _number(value: int | str, minimum: int, maximum: int) -> int:
        try:
            numeric = float(value) if value != "" else 0
        except (ValueError, OverflowError) as error:
            raise TypingTestError("calculator_invalid") from error
        if not isfinite(numeric):
            raise TypingTestError("calculator_invalid")
        return min(maximum, max(minimum, int(numeric + 0.5)))
