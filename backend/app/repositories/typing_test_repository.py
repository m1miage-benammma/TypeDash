from contextlib import contextmanager
from dataclasses import asdict
from pathlib import Path
from app.core.postgres import PostgresDatabase

from app.models.typing_test import TypingTest


SCHEMA_SQL = Path(__file__).with_name("sql").joinpath("typing_tests.sql").read_text(encoding="utf-8")


class PostgresTypingTestRepository:
    """SQL, transactions and entity serialization only."""

    def __init__(self, database: PostgresDatabase):
        self.connect = database.connection
        self.admin_connect = database.admin_connection

    def initialize(self) -> None:
        with self.admin_connect() as connection:
            connection.execute(SCHEMA_SQL)

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
        return TypingTest(**row["payload"]) if row else None

    def save(self, test: TypingTest) -> None:
        from psycopg.types.json import Jsonb

        self.connection.execute(
            """INSERT INTO typing_tests (id, payload, created_at, owner_device_id) VALUES (%s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload""",
            (test.id, Jsonb(asdict(test)), test.created_at, test.owner_device_id),
        )

    def delete_before(self, cutoff: str) -> None:
        self.connection.execute(
            "DELETE FROM typing_tests WHERE created_at < %s", (cutoff,),
        )
