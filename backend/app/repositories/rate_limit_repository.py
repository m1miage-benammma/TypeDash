from threading import Lock
from time import time
from app.ports.rate_limits import RateLimiter


class RateLimits(RateLimiter):
    """Atomic fixed-window counters, shared in Postgres in production."""

    def __init__(self, database=None):
        self.database = database
        self.counters = {}
        self.lock = Lock()

    def allow(self, key: str, limit: int, seconds: int = 60, cost: int = 1) -> bool:
        window = int(time()) // seconds
        if self.database:
            with self.database.connection() as connection:
                row = connection.execute(
                    """INSERT INTO typedash_private.rate_limits (key, window_id, count, expires_at)
                       VALUES (%s, %s, %s, to_timestamp(%s))
                       ON CONFLICT (key) DO UPDATE SET
                         count = CASE WHEN rate_limits.window_id = EXCLUDED.window_id
                           THEN LEAST(rate_limits.count + EXCLUDED.count, %s + 1)
                           ELSE EXCLUDED.count END,
                         window_id = EXCLUDED.window_id, expires_at = EXCLUDED.expires_at
                       RETURNING count""",
                    (key, window, cost, (window + 1) * seconds, limit),
                ).fetchone()
                return row["count"] <= limit
        with self.lock:
            self.counters = {k: v for k, v in self.counters.items() if v[2] > time()}
            if key not in self.counters and len(self.counters) >= 10000:
                return False
            previous = self.counters.get(key, (-1, 0, 0))
            count = previous[1] + cost if previous[0] == window else cost
            self.counters[key] = (window, min(count, limit + 1), (window + 1) * seconds)
            return count <= limit
