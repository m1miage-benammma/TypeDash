import re
from dataclasses import asdict, dataclass
from statistics import mean


USERNAME_PATTERN_TEXT = r"^[A-Za-z0-9_-]{3,24}$"
USERNAME_PATTERN = re.compile(USERNAME_PATTERN_TEXT)
MAX_USERNAME_CHANGES = 3


class IdentityError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def normalize_username(value: str) -> str:
    username = value.strip()
    if not USERNAME_PATTERN.fullmatch(username):
        raise IdentityError("invalid_username")
    return username


@dataclass(frozen=True)
class User:
    id: str
    username: str
    username_key: str
    username_changes: int
    created_at: str
    updated_at: str


@dataclass(frozen=True)
class Device:
    id: str
    user_id: str | None
    created_at: str
    last_seen_at: str


@dataclass(frozen=True)
class TypingStat:
    id: str
    device_id: str
    source_test_id: str
    difficulty: str
    language: str
    duration: int
    punctuation: bool
    numbers: bool
    wpm: float
    accuracy: float
    correct_characters: int
    incorrect_characters: int
    typed_characters: int
    completed_words: int
    elapsed_seconds: float
    finished_at: str
    created_at: str

    def view(self) -> dict:
        value = asdict(self)
        value["test_id"] = value.pop("source_test_id")
        value.pop("device_id")
        value.pop("created_at")
        return value


@dataclass(frozen=True)
class DeviceProfile:
    device: Device
    user: User | None
    stats: list[TypingStat]
    total_sessions: int
    best_wpm: float
    average_wpm: float
    average_accuracy: float

    @classmethod
    def from_stats(
        cls,
        device: Device,
        user: User | None,
        stats: list[TypingStat],
    ) -> "DeviceProfile":
        speeds = [stat.wpm for stat in stats]
        accuracies = [stat.accuracy for stat in stats]
        return cls(
            device=device,
            user=user,
            stats=stats,
            total_sessions=len(stats),
            best_wpm=max(speeds, default=0.0),
            average_wpm=float(mean(speeds)) if speeds else 0.0,
            average_accuracy=float(mean(accuracies)) if accuracies else 0.0,
        )

    def view(self) -> dict:
        return {
            "device_id": self.device.id,
            "username": self.user.username if self.user else None,
            "registered": self.user is not None,
            "username_changes": self.user.username_changes if self.user else 0,
            "username_changes_remaining": (
                max(0, MAX_USERNAME_CHANGES - self.user.username_changes)
                if self.user else MAX_USERNAME_CHANGES
            ),
            "summary": {
                "sessions": self.total_sessions,
                "best_wpm": round(self.best_wpm, 1),
                "average_wpm": round(self.average_wpm, 1),
                "average_accuracy": round(self.average_accuracy, 1),
            },
            "stats": [stat.view() for stat in self.stats],
        }
