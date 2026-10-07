from contextlib import contextmanager
from datetime import datetime
from uuid import UUID
from pathlib import Path
from app.models.stats_summary import StatsSummary
from app.core.postgres import PostgresDatabase

from app.models.device import Device
from app.models.typing_stat import TypingStat
from app.models.user import User
from app.repositories.errors import PersistenceConflict


SCHEMA_SQL = Path(__file__).with_name("sql").joinpath("devices.sql").read_text(encoding="utf-8")


def _iso(value: datetime | str) -> str:
    return value.isoformat() if isinstance(value, datetime) else value


class PostgresDeviceRepository:
    """Connection lifecycle, SQL and row mapping only."""

    def __init__(self, database: PostgresDatabase):
        import psycopg

        self.psycopg = psycopg
        self.connect = database.connection
        self.admin_connect = database.admin_connection

    def initialize(self) -> None:
        with self.admin_connect() as connection:
            connection.execute(SCHEMA_SQL)


    @contextmanager
    def transaction(self, test_storage=None):
        try:
            if test_storage is not None:
                yield PostgresDeviceSession(test_storage.connection)
            else:
                with self.connect() as connection:
                    yield PostgresDeviceSession(connection)
        except self.psycopg.errors.UniqueViolation as error:
            raise PersistenceConflict(error.diag.constraint_name) from error


class PostgresDeviceSession:
    def __init__(self, connection):
        self.connection = connection

    def find_device(self, device_id: str) -> Device | None:
        self.connection.execute(
            "SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (device_id,),
        )
        row = self.connection.execute(
            "SELECT id, user_id, created_at, last_seen_at FROM devices WHERE id = %s FOR UPDATE",
            (UUID(device_id),),
        ).fetchone()
        return Device(str(row["id"]), str(row["user_id"]) if row["user_id"] else None,
                      _iso(row["created_at"]), _iso(row["last_seen_at"])) if row else None

    def save_device(self, device: Device) -> None:
        self.connection.execute(
            """INSERT INTO devices (id, user_id, created_at, last_seen_at)
               VALUES (%s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET
               user_id = EXCLUDED.user_id, last_seen_at = EXCLUDED.last_seen_at""",
            (UUID(device.id), UUID(device.user_id) if device.user_id else None,
             device.created_at, device.last_seen_at),
        )

    def find_user(self, user_id: str) -> User | None:
        row = self.connection.execute(
            """SELECT id, username, username_key, username_changes, created_at, updated_at
               FROM users WHERE id = %s FOR UPDATE""", (UUID(user_id),),
        ).fetchone()
        return self._user_from_row(row) if row else None

    def find_user_by_username(self, username_key: str) -> User | None:
        row = self.connection.execute(
            """SELECT id, username, username_key, username_changes, created_at, updated_at
               FROM users WHERE username_key = %s""", (username_key,),
        ).fetchone()
        return self._user_from_row(row) if row else None

    def save_user(self, user: User) -> None:
        self.connection.execute(
            """INSERT INTO users
               (id, username, username_key, username_changes, created_at, updated_at)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username,
               username_key = EXCLUDED.username_key,
               username_changes = EXCLUDED.username_changes,
               updated_at = EXCLUDED.updated_at""",
            (UUID(user.id), user.username, user.username_key, user.username_changes,
             user.created_at, user.updated_at),
        )

    def list_stats(self, device_id: str, limit: int = 30, offset: int = 0) -> list[TypingStat]:
        rows = self.connection.execute(
            """SELECT id, device_id, source_test_id, difficulty, language,
               duration_seconds, punctuation, numbers, wpm, accuracy,
               correct_characters, incorrect_characters, typed_characters,
               completed_words, elapsed_seconds, finished_at, created_at
               FROM typing_stats WHERE device_id = %s
               ORDER BY finished_at DESC, id DESC LIMIT %s OFFSET %s""",
            (UUID(device_id), limit, offset),
        ).fetchall()
        return [self._stat_from_row(row) for row in rows]

    def stats_summary(self, device_id: str) -> StatsSummary:
        row = self.connection.execute(
            """SELECT COUNT(*) AS sessions, COALESCE(MAX(wpm), 0) AS best_wpm,
               COALESCE(AVG(wpm), 0) AS average_wpm,
               COALESCE(AVG(accuracy), 0) AS average_accuracy
               FROM typing_stats WHERE device_id = %s""", (UUID(device_id),),
        ).fetchone()
        return StatsSummary(
            sessions=row["sessions"], best_wpm=float(row["best_wpm"]),
            average_wpm=float(row["average_wpm"]),
            average_accuracy=float(row["average_accuracy"]),
        )

    def has_stat(self, test_id: str) -> bool:
        return self.connection.execute(
            "SELECT 1 FROM typing_stats WHERE source_test_id = %s", (UUID(test_id),),
        ).fetchone() is not None

    def find_stat(self, device_id: str, stat_id: str) -> TypingStat | None:
        row = self.connection.execute(
            """SELECT id, device_id, source_test_id, difficulty, language,
               duration_seconds, punctuation, numbers, wpm, accuracy,
               correct_characters, incorrect_characters, typed_characters,
               completed_words, elapsed_seconds, finished_at, created_at, samples
               FROM typing_stats WHERE id = %s AND device_id = %s""",
            (UUID(stat_id), UUID(device_id)),
        ).fetchone()
        return self._stat_from_row(row) if row else None

    def save_stat(self, stat: TypingStat) -> None:
        from psycopg.types.json import Jsonb

        self.connection.execute(
            """DELETE FROM typing_stats WHERE id IN (
               SELECT id FROM typing_stats WHERE device_id = %s
               ORDER BY finished_at DESC, id DESC OFFSET 1999)""", (UUID(stat.device_id),),
        )
        self.connection.execute(
            """INSERT INTO typing_stats (
               id, device_id, source_test_id, difficulty, language,
               duration_seconds, punctuation, numbers, wpm, accuracy,
               correct_characters, incorrect_characters, typed_characters,
               completed_words, elapsed_seconds, finished_at, created_at, samples)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               ON CONFLICT (source_test_id) DO NOTHING""",
            (UUID(stat.id), UUID(stat.device_id), UUID(stat.source_test_id),
             stat.difficulty, stat.language, stat.duration, stat.punctuation,
             stat.numbers, stat.wpm, stat.accuracy, stat.correct_characters,
             stat.incorrect_characters, stat.typed_characters, stat.completed_words,
             stat.elapsed_seconds, stat.finished_at, stat.created_at, Jsonb(stat.samples)),
        )

    def delete_stats(self, device_id: str) -> None:
        self.connection.execute(
            "DELETE FROM typing_stats WHERE device_id = %s", (UUID(device_id),),
        )

    @staticmethod
    def _user_from_row(row) -> User:
        return User(str(row["id"]), row["username"], row["username_key"],
                    row["username_changes"], _iso(row["created_at"]), _iso(row["updated_at"]))

    @staticmethod
    def _stat_from_row(value) -> TypingStat:
        return TypingStat(
            id=str(value["id"]),
            device_id=str(value["device_id"]),
            source_test_id=str(value["source_test_id"]),
            difficulty=value["difficulty"],
            language=value["language"],
            duration=value["duration_seconds"],
            punctuation=value["punctuation"],
            numbers=value["numbers"],
            wpm=float(value["wpm"]),
            accuracy=float(value["accuracy"]),
            correct_characters=value["correct_characters"],
            incorrect_characters=value["incorrect_characters"],
            typed_characters=value["typed_characters"],
            completed_words=value["completed_words"],
            elapsed_seconds=float(value["elapsed_seconds"]),
            finished_at=_iso(value["finished_at"]),
            created_at=_iso(value["created_at"]),
            samples=value.get("samples", []),
        )
