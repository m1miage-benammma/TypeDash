from uuid import UUID

from pydantic import BaseModel, ConfigDict


class UsernameRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str


class DeviceRequest(BaseModel):
    device_id: UUID


class DeviceUsernameRequest(UsernameRequest):
    device_id: UUID
