from redis import Redis


class RedisConnection:
    """Owns one bounded Redis client shared by the cache adapters."""

    def __init__(self, url: str):
        self.client = Redis.from_url(
            url,
            decode_responses=True,
            socket_connect_timeout=1,
            socket_timeout=1,
            max_connections=32,
            health_check_interval=30,
        )

    def close(self) -> None:
        self.client.close()
