from contextlib import contextmanager
from dataclasses import asdict
from app.core.postgres import connection_options

from app.models.typing_test import TypingTest


class PostgresTypingTestRepository:
    """SQL, transactions and entity serialization only."""

    def __init__(self, settings):
        import psycopg

        self.connect = lambda: psycopg.connect(**connection_options(settings))

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS typing_tests (
                    id UUID PRIMARY KEY,
                    payload JSONB NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS typing_tests_created
                ON typing_tests(created_at)
                """
            )
            connection.execute("ALTER TABLE typing_tests ENABLE ROW LEVEL SECURITY")


    @contextmanager
    def transaction(self):
        with self.connect() as connection:
            yield PostgresTypingTestSession(connection)


class PostgresTypingTestSession:
    def __init__(self, connection):
        self.connection = connection

    def find(self, test_id: str) -> TypingTest | None:
        row = self.connection.execute(
            "SELECT payload FROM typing_tests WHERE id = %s FOR UPDATE", (test_id,),
        ).fetchone()
        return TypingTest(**row[0]) if row else None

    def save(self, test: TypingTest) -> None:
        from psycopg.types.json import Jsonb

        self.connection.execute(
            """INSERT INTO typing_tests (id, payload, created_at) VALUES (%s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload""",
            (test.id, Jsonb(asdict(test)), test.created_at),
        )

    def count(self) -> int:
        return self.connection.execute("SELECT COUNT(*) FROM typing_tests").fetchone()[0]

    def delete_before(self, cutoff: str) -> None:
        self.connection.execute(
            "DELETE FROM typing_tests WHERE created_at < %s", (cutoff,),
        )
