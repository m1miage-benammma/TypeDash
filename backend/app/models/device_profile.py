from dataclasses import dataclass

from app.models.device import Device
from app.models.typing_stat import TypingStat
from app.models.user import User


@dataclass(frozen=True)
class DeviceProfile:
    device: Device
    user: User | None
    stats: list[TypingStat]
    total_sessions: int
    best_wpm: float
    average_wpm: float
    average_accuracy: float

