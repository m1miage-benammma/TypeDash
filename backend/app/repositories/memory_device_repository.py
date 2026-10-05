from contextlib import contextmanager
from copy import deepcopy
from threading import RLock

from app.models.device import Device
from app.models.typing_stat import TypingStat
from app.models.user import User


class MemoryDeviceRepository:
    """In-memory persistence; application decisions belong to services."""

    def __init__(self):
        self.devices: dict[str, Device] = {}
        self.users: dict[str, User] = {}
        self.stats: dict[str, TypingStat] = {}
        self.lock = RLock()

    @contextmanager
    def transaction(self):
        with self.lock:
            backup = deepcopy((self.devices, self.users, self.stats))
            try:
                yield self
            except Exception:
                self.devices, self.users, self.stats = backup
                raise

    def find_device(self, device_id: str) -> Device | None:
        return self.devices.get(device_id)

    def save_device(self, device: Device) -> None:
        self.devices[device.id] = device

    def find_user(self, user_id: str) -> User | None:
        return self.users.get(user_id)

    def find_user_by_username(self, username_key: str) -> User | None:
        return next((user for user in self.users.values()
                     if user.username_key == username_key), None)

    def save_user(self, user: User) -> None:
        self.users[user.id] = user

    def list_stats(self, device_id: str) -> list[TypingStat]:
        return [stat for stat in self.stats.values() if stat.device_id == device_id]

    def has_stat(self, test_id: str) -> bool:
        return test_id in self.stats

    def save_stat(self, stat: TypingStat) -> None:
        self.stats[stat.source_test_id] = stat

    def delete_stats(self, device_id: str) -> None:
        self.stats = {key: stat for key, stat in self.stats.items()
                      if stat.device_id != device_id}
