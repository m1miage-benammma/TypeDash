from typing import Generic, TypeVar

from pydantic import BaseModel

Payload = TypeVar("Payload")


class ApiResponse(BaseModel, Generic[Payload]):
    data: Payload


class ApiErrorDetail(BaseModel):
    code: str
    message: str


class ApiErrorResponse(BaseModel):
    error: ApiErrorDetail
