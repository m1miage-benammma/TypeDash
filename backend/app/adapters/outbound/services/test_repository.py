from copy import deepcopy
from dataclasses import asdict
from datetime import timedelta
from threading import RLock

from app.domain.entities.typing_test import TypingTest, TestError, utc_now


class MemoryTestRepository:
    """Explicit opt-in for local development without PostgreSQL."""

    def __init__(self):
        self.tests = {}
        self.lock = RLock()

    def create(self, test):
        with self.lock:
            cutoff = (utc_now() - timedelta(days=1)).isoformat()
            self.tests = {k: v for k, v in self.tests.items() if v.created_at > cutoff}
            if len(self.tests) >= 2000:
                raise TestError("capacity_reached")
            self.tests[test.id] = deepcopy(test)

    def change(self, test_id, operation):
        with self.lock:
            if test_id not in self.tests:
                raise TestError("not_found")
            test = deepcopy(self.tests[test_id])
            operation(test)
            self.tests[test_id] = deepcopy(test)
            return test


class PostgresTestRepository:
    def __init__(self, settings):
        import psycopg
        self.connect = lambda: psycopg.connect(
            host=settings.db_host, port=settings.db_port, dbname=settings.db_name,
            user=settings.db_username, password=settings.db_password, connect_timeout=5,
        )

    def initialize(self):
        with self.connect() as conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS typing_tests (
                id UUID PRIMARY KEY, payload JSONB NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )""")
            conn.execute("CREATE INDEX IF NOT EXISTS typing_tests_created ON typing_tests(created_at)")

    def create(self, test):
        from psycopg.types.json import Jsonb
        with self.connect() as conn:
            conn.execute("DELETE FROM typing_tests WHERE created_at < NOW() - INTERVAL '1 day'")
            conn.execute("INSERT INTO typing_tests (id, payload) VALUES (%s, %s)", (test.id, Jsonb(asdict(test))))

    def change(self, test_id, operation):
        from psycopg.types.json import Jsonb
        with self.connect() as conn:
            # Serialize progress/start/finish across requests and worker processes.
            row = conn.execute("SELECT payload FROM typing_tests WHERE id = %s FOR UPDATE", (test_id,)).fetchone()
            if not row:
                raise TestError("not_found")
            test = TypingTest(**row[0])
            operation(test)
            conn.execute("UPDATE typing_tests SET payload = %s WHERE id = %s", (Jsonb(asdict(test)), test_id))
            return test
