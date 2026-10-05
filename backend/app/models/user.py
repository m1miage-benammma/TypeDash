from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    id: str
    username: str
    username_key: str
    username_changes: int
    created_at: str
    updated_at: str

