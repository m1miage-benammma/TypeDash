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
        return self.allow_many([(key, limit)], seconds, cost)

    def allow_many(self, checks: list[tuple[str, int]], seconds: int = 60, cost: int = 1) -> bool:
        if not checks:
            return True
        window = int(time()) // seconds
        if self.database:
            from psycopg.types.json import Jsonb

            with self.database.connection() as connection:
                row = connection.execute(
                    """WITH checks AS (
                         SELECT * FROM jsonb_to_recordset(%s) AS c(key text, max_count integer)
                       ), updated AS (
                         INSERT INTO typedash_private.rate_limits (key, window_id, count, expires_at)
                         SELECT key, %s, LEAST(%s, max_count + 1), to_timestamp(%s)
                         FROM checks ORDER BY key
                         ON CONFLICT (key) DO UPDATE SET
                           count = CASE WHEN rate_limits.window_id = EXCLUDED.window_id
                             THEN LEAST(rate_limits.count + EXCLUDED.count,
                               (SELECT max_count + 1 FROM checks WHERE key = EXCLUDED.key))
                             ELSE EXCLUDED.count END,
                           window_id = EXCLUDED.window_id, expires_at = EXCLUDED.expires_at
                         RETURNING key, count
                       ) SELECT bool_and(updated.count <= checks.max_count) AS allowed
                         FROM updated JOIN checks USING (key)""",
                    (Jsonb([{"key": key, "max_count": limit} for key, limit in checks]),
                     window, cost, (window + 1) * seconds),
                ).fetchone()
                return row["allowed"] is True
        with self.lock:
            self.counters = {k: v for k, v in self.counters.items() if v[2] > time()}
            if len(self.counters.keys() | {key for key, _ in checks}) > 10000:
                return False
            allowed = True
            for key, limit in checks:
                previous = self.counters.get(key, (-1, 0, 0))
                count = previous[1] + cost if previous[0] == window else cost
                self.counters[key] = (window, min(count, limit + 1), (window + 1) * seconds)
                allowed = allowed and count <= limit
            return allowed
