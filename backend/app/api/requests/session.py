from uuid import UUID

from app.api.requests.device import DeviceRequest


class SessionRequest(DeviceRequest):
    stat_id: UUID
