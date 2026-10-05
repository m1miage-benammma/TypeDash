from fastapi import APIRouter

from app.api.schemas.api import ApiResponse
from app.api.schemas.calculator import CalculatorRequest, CalculatorResponse
from app.services.calculator_service import CalculatorService

router = APIRouter(prefix="/api/calculator", tags=["calculator"])


@router.get("", response_model=ApiResponse[CalculatorResponse])
def defaults() -> ApiResponse[CalculatorResponse]:
    return CalculatorService.defaults()


@router.post("", response_model=ApiResponse[CalculatorResponse])
def calculate(request: CalculatorRequest) -> ApiResponse[CalculatorResponse]:
    return CalculatorService.calculate(request)
