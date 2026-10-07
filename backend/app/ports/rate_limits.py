from typing import Protocol


class RateLimiter(Protocol):
    def allow(self, key: str, limit: int, seconds: int = 60, cost: int = 1) -> bool: ...

    def allow_many(self, checks: list[tuple[str, int]], seconds: int = 60, cost: int = 1) -> bool: ...
