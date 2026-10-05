from dataclasses import dataclass


@dataclass(frozen=True)
class Device:
    id: str
    user_id: str | None
    created_at: str
    last_seen_at: str

