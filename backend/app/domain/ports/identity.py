from typing import Protocol

from app.domain.entities.identity import DeviceProfile, TypingStat


class IdentityRepository(Protocol):
    def touch_device(self, device_id: str, now: str) -> None: ...

    def register_device(
        self,
        device_id: str,
        username: str,
        username_key: str,
        now: str,
    ) -> DeviceProfile: ...

    def get_profile(self, device_id: str) -> DeviceProfile: ...

    def update_username(
        self,
        device_id: str,
        username: str,
        username_key: str,
        now: str,
    ) -> DeviceProfile: ...

    def save_stat(self, stat: TypingStat) -> None: ...

    def clear_stats(self, device_id: str) -> DeviceProfile: ...
