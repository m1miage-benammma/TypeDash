from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str


class RootResponse(HealthResponse):
    name: str
