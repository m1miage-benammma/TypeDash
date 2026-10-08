from pydantic import BaseModel
from uuid import UUID


class SessionIdentityResponse(BaseModel):
    device_id: UUID

