from redis import Redis, RedisError
from app.ports.rate_limits import RateLimiter


class RedisRateLimits(RateLimiter):
    """Expiring distributed counters; Redis failures never disable protection."""

    _SCRIPT = """
        local now = tonumber(redis.call('TIME')[1])
        local seconds = tonumber(ARGV[2])
        local window = math.floor(now / seconds)
        local previous = tonumber(redis.call('HGET', KEYS[1], 'window'))
        local count = previous == window and tonumber(redis.call('HGET', KEYS[1], 'count')) or 0
        count = math.min(count + tonumber(ARGV[3]), tonumber(ARGV[1]) + 1)
        redis.call('HSET', KEYS[1], 'window', window, 'count', count)
        redis.call('EXPIRE', KEYS[1], (window + 1) * seconds - now)
        return count <= tonumber(ARGV[1]) and 1 or 0
    """

    def __init__(self, client: Redis):
        self.client = client
        self.script = self.client.register_script(self._SCRIPT)

    def allow(self, key: str, limit: int, seconds: int = 60, cost: int = 1) -> bool:
        return self.allow_many([(key, limit)], seconds, cost)

    def allow_many(self, checks: list[tuple[str, int]], seconds: int = 60, cost: int = 1) -> bool:
        try:
            with self.client.pipeline(transaction=False) as pipeline:
                for key, limit in checks:
                    self.script(keys=["typedash:limits:" + key], args=[limit, seconds, cost], client=pipeline)
                return all(pipeline.execute())
        except RedisError:
            return False
