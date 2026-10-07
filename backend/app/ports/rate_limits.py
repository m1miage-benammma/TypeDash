from typing import Protocol


class RateLimiter(Protocol):
    def allow(self, key: str, limit: int, seconds: int = 60, cost: int = 1) -> bool: ...
