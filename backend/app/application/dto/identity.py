from dataclasses import dataclass


@dataclass(frozen=True)
class RegisterDeviceCommand:
    device_id: str
    username: str


@dataclass(frozen=True)
class UpdateUsernameCommand:
    device_id: str
    username: str
