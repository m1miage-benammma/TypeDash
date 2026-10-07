from dataclasses import asdict
import json

from redis import Redis, RedisError

from app.models.enums import Difficulty, Language, SessionStatus
from app.models.typing_test import TypingTest


class RedisResponseCache:
    """Best-effort cache for reproducible read responses."""

    def __init__(self, client: Redis, prefix: str = "typedash:cache:"):
        self.client = client
        self.prefix = prefix

    def get(self, key: str) -> str | None:
        try:
            return self.client.get(self.prefix + key)
        except RedisError:
            return None

    def set(self, key: str, value: str, ttl: int) -> None:
        try:
            self.client.set(self.prefix + key, value, ex=ttl)
        except RedisError:
            pass


class RedisPreparedTestCache:
    """Distributed handoff cache with a process-local outage fallback."""

    def __init__(self, client: Redis, fallback, ttl: int = 60):
        self.client = client
        self.ttl = ttl
        self.fallback = fallback

    def put(self, test: TypingTest) -> None:
        self.fallback.put(test)
        try:
            self.client.set(self._key(test.id), self._encode(test), ex=self.ttl)
        except RedisError:
            pass

    def take(self, test_id: str) -> TypingTest | None:
        try:
            value = self.client.getdel(self._key(test_id))
        except RedisError:
            return self.fallback.take(test_id)
        local = self.fallback.take(test_id)
        if not value:
            return local
        try:
            return self._decode(value)
        except (KeyError, TypeError, ValueError):
            return local

    def peek(self, test_id: str) -> TypingTest | None:
        try:
            value = self.client.get(self._key(test_id))
        except RedisError:
            return self.fallback.peek(test_id)
        if not value:
            return self.fallback.peek(test_id)
        try:
            return self._decode(value)
        except (KeyError, TypeError, ValueError):
            return self.fallback.peek(test_id)

    @staticmethod
    def _encode(test: TypingTest) -> str:
        return json.dumps(asdict(test), separators=(",", ":"))

    @staticmethod
    def _decode(value: str) -> TypingTest:
        data = json.loads(value)
        data["difficulty"] = Difficulty(data["difficulty"])
        data["language"] = Language(data["language"])
        data["status"] = SessionStatus(data["status"])
        return TypingTest(**data)

    @staticmethod
    def _key(test_id: str) -> str:
        return "typedash:cache:prepared:" + test_id
