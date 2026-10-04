from app.application.dto.identity import RegisterDeviceCommand, UpdateUsernameCommand
from app.domain.entities.identity import normalize_username
from app.domain.entities.typing_test import utc_now
from app.domain.ports.identity import IdentityRepository


class DeviceAccounts:
    def __init__(self, repository: IdentityRepository):
        self.repository = repository

    def profile(self, device_id: str) -> dict:
        return self.repository.get_profile(device_id).view()

    def register(self, command: RegisterDeviceCommand) -> dict:
        username = normalize_username(command.username)
        profile = self.repository.register_device(
            device_id=command.device_id,
            username=username,
            username_key=username.casefold(),
            now=utc_now().isoformat(),
        )
        return profile.view()

    def update_username(self, command: UpdateUsernameCommand) -> dict:
        username = normalize_username(command.username)
        profile = self.repository.update_username(
            device_id=command.device_id,
            username=username,
            username_key=username.casefold(),
            now=utc_now().isoformat(),
        )
        return profile.view()

    def clear_stats(self, device_id: str) -> dict:
        return self.repository.clear_stats(device_id).view()
