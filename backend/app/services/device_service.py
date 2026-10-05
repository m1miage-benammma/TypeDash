import re
from dataclasses import replace
from uuid import uuid4

from app.api.responses.api import ApiResponse
from app.api.requests.device import DeviceRequest, DeviceUsernameRequest
from app.api.responses.device import DeviceProfileResponse
from app.core.clock import utc_now
from app.models.constants import MAX_USERNAME_CHANGES, USERNAME_PATTERN_TEXT
from app.models.device import Device
from app.models.device_profile import DeviceProfile
from app.models.typing_stat import TypingStat
from app.models.user import User
from app.models.errors import IdentityError
from app.repositories.errors import PersistenceConflict
from app.repositories.device_repository import PostgresDeviceRepository
from app.repositories.memory_device_repository import MemoryDeviceRepository

USERNAME_PATTERN = re.compile(USERNAME_PATTERN_TEXT)
DeviceRepository = MemoryDeviceRepository | PostgresDeviceRepository


class DeviceService:
    def __init__(self, repository: DeviceRepository):
        self.repository = repository

    def profile(self, request: DeviceRequest) -> ApiResponse[DeviceProfileResponse]:
        with self.repository.transaction() as storage:
            device = self._require_device(storage, str(request.device_id))
            device = replace(device, last_seen_at=utc_now().isoformat())
            storage.save_device(device)
            return self._response(storage, device)

    def register(self, request: DeviceUsernameRequest) -> ApiResponse[DeviceProfileResponse]:
        username = self._normalize_username(request.username)
        key = username.casefold()
        now = utc_now().isoformat()
        try:
            with self.repository.transaction() as storage:
                device = self.touch(storage, str(request.device_id), now)
                if device.user_id:
                    user = storage.find_user(device.user_id)
                    if user.username_key != key:
                        raise IdentityError("already_registered")
                else:
                    if storage.find_user_by_username(key):
                        raise IdentityError("username_taken")
                    user = User(str(uuid4()), username, key, 0, now, now)
                    storage.save_user(user)
                    device = replace(device, user_id=user.id)
                    storage.save_device(device)
                return self._response(storage, device)
        except PersistenceConflict as error:
            raise IdentityError("username_taken") from error

    def update_username(self, request: DeviceUsernameRequest) -> ApiResponse[DeviceProfileResponse]:
        username = self._normalize_username(request.username)
        key = username.casefold()
        now = utc_now().isoformat()
        try:
            with self.repository.transaction() as storage:
                device = self._require_device(storage, str(request.device_id))
                if not device.user_id:
                    raise IdentityError("not_registered")
                user = storage.find_user(device.user_id)
                if user.username == username:
                    return self._response(storage, device)
                if user.username_changes >= MAX_USERNAME_CHANGES:
                    raise IdentityError("username_change_limit_reached")
                owner = storage.find_user_by_username(key)
                if owner and owner.id != user.id:
                    raise IdentityError("username_taken")
                storage.save_user(replace(
                    user, username=username, username_key=key,
                    username_changes=user.username_changes + 1, updated_at=now,
                ))
                device = replace(device, last_seen_at=now)
                storage.save_device(device)
                return self._response(storage, device)
        except PersistenceConflict as error:
            raise IdentityError("username_taken") from error

    def clear_stats(self, request: DeviceRequest) -> ApiResponse[DeviceProfileResponse]:
        with self.repository.transaction() as storage:
            device = self._require_device(storage, str(request.device_id))
            storage.delete_stats(device.id)
            return self._response(storage, device)

    @staticmethod
    def touch(storage, device_id: str, now: str) -> Device:
        device = storage.find_device(device_id)
        device = (replace(device, last_seen_at=now) if device
                  else Device(device_id, None, now, now))
        storage.save_device(device)
        return device

    @staticmethod
    def _require_device(storage, device_id: str) -> Device:
        device = storage.find_device(device_id)
        if device is None:
            raise IdentityError("device_not_found")
        return device

    def _response(self, storage, device: Device) -> ApiResponse[DeviceProfileResponse]:
        user = storage.find_user(device.user_id) if device.user_id else None
        stats = storage.list_stats(device.id, limit=30, offset=0)
        summary = storage.stats_summary(device.id)
        profile = DeviceProfile(
            device=device, user=user, stats=stats, total_sessions=summary.sessions,
            best_wpm=summary.best_wpm, average_wpm=summary.average_wpm,
            average_accuracy=summary.average_accuracy,
        )
        return ApiResponse[DeviceProfileResponse](
            data=DeviceProfileResponse.model_validate(self._profile_view(profile)),
        )

    @staticmethod
    def _normalize_username(value: str) -> str:
        username = value.strip()
        if not USERNAME_PATTERN.fullmatch(username):
            raise IdentityError("invalid_username")
        return username

    @staticmethod
    def _profile_view(profile: DeviceProfile) -> dict:
        user = profile.user
        return {
            "device_id": profile.device.id,
            "username": user.username if user else None,
            "registered": user is not None,
            "requires_registration": user is None and profile.total_sessions > 0,
            "can_change_username": user is not None and user.username_changes < MAX_USERNAME_CHANGES,
            "username_changes": user.username_changes if user else 0,
            "username_changes_remaining": (
                max(0, MAX_USERNAME_CHANGES - user.username_changes)
                if user
                else MAX_USERNAME_CHANGES
            ),
            "summary": {
                "sessions": profile.total_sessions,
                "best_wpm": round(profile.best_wpm, 1),
                "average_wpm": round(profile.average_wpm, 1),
                "average_accuracy": round(profile.average_accuracy, 1),
            },
            "stats": [DeviceService._stat_view(stat) for stat in profile.stats],
            "history_chart": [
                {"id": stat.id, "wpm": stat.wpm, "finished_at": stat.finished_at,
                 "height_pixels": max(4, stat.wpm / max(profile.best_wpm, 1) * 140)}
                for stat in reversed(profile.stats[:12])
            ],
        }

    @staticmethod
    def _stat_view(stat: TypingStat) -> dict:
        return {
            "id": stat.id,
            "test_id": stat.source_test_id,
            "difficulty": stat.difficulty,
            "language": stat.language,
            "duration": stat.duration,
            "punctuation": stat.punctuation,
            "numbers": stat.numbers,
            "wpm": stat.wpm,
            "accuracy": stat.accuracy,
            "correct_characters": stat.correct_characters,
            "incorrect_characters": stat.incorrect_characters,
            "typed_characters": stat.typed_characters,
            "completed_words": stat.completed_words,
            "elapsed_seconds": stat.elapsed_seconds,
            "finished_at": stat.finished_at,
        }
