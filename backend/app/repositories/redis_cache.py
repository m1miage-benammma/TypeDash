
from redis import Redis, RedisError



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
