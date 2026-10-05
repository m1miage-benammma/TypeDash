from contextlib import contextmanager
from datetime import datetime
from uuid import UUID
from app.core.postgres import connection_options

from app.models.device import Device
from app.models.typing_stat import TypingStat
from app.models.user import User
from app.repositories.errors import PersistenceConflict


def _iso(value: datetime | str) -> str:
    return value.isoformat() if isinstance(value, datetime) else value


class PostgresDeviceRepository:
    """Connection lifecycle, SQL and row mapping only."""

    def __init__(self, settings):
        import psycopg

        self.psycopg = psycopg
        self.connect = lambda: psycopg.connect(**connection_options(settings))

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(24) NOT NULL,
                    username_key VARCHAR(24) NOT NULL UNIQUE,
                    username_changes SMALLINT NOT NULL DEFAULT 0
                        CHECK (username_changes BETWEEN 0 AND 3),
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            connection.execute(
                """
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS username_changes
                    SMALLINT NOT NULL DEFAULT 0
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS devices (
                    id UUID PRIMARY KEY,
                    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    last_seen_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS typing_stats (
                    id UUID PRIMARY KEY,
                    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                    source_test_id UUID NOT NULL UNIQUE,
                    difficulty VARCHAR(16) NOT NULL
                        CHECK (difficulty IN ('easy', 'medium', 'hard')),
                    language VARCHAR(2) NOT NULL CHECK (language IN ('en', 'fr')),
                    duration_seconds SMALLINT NOT NULL
                        CHECK (duration_seconds BETWEEN 1 AND 300),
                    punctuation BOOLEAN NOT NULL,
                    numbers BOOLEAN NOT NULL,
                    wpm NUMERIC(7, 2) NOT NULL CHECK (wpm >= 0),
                    accuracy NUMERIC(5, 2) NOT NULL
                        CHECK (accuracy BETWEEN 0 AND 100),
                    correct_characters INTEGER NOT NULL
                        CHECK (correct_characters >= 0),
                    incorrect_characters INTEGER NOT NULL
                        CHECK (incorrect_characters >= 0),
                    typed_characters INTEGER NOT NULL
                        CHECK (typed_characters >= 0),
                    completed_words INTEGER NOT NULL CHECK (completed_words >= 0),
                    elapsed_seconds NUMERIC(8, 2) NOT NULL
                        CHECK (elapsed_seconds >= 0),
                    finished_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
                """
            )
            connection.execute(
                """
                ALTER TABLE typing_stats ADD COLUMN IF NOT EXISTS
                    samples JSONB NOT NULL DEFAULT '[]'::jsonb
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS typing_stats_device_finished
                ON typing_stats(device_id, finished_at DESC)
                """
            )
            # These tables are accessed through FastAPI, not Supabase's public Data API.
            for table in ("users", "devices", "typing_stats"):
                connection.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


    @contextmanager
    def transaction(self):
        try:
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
        return Device(str(row[0]), str(row[1]) if row[1] else None,
                      _iso(row[2]), _iso(row[3])) if row else None

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

    def list_stats(self, device_id: str) -> list[TypingStat]:
        rows = self.connection.execute(
            """SELECT id, device_id, source_test_id, difficulty, language,
               duration_seconds, punctuation, numbers, wpm, accuracy,
               correct_characters, incorrect_characters, typed_characters,
               completed_words, elapsed_seconds, finished_at, created_at
               FROM typing_stats WHERE device_id = %s""", (UUID(device_id),),
        ).fetchall()
        return [self._stat_from_row(row) for row in rows]

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
        return User(str(row[0]), row[1], row[2], row[3], _iso(row[4]), _iso(row[5]))

    @staticmethod
    def _stat_from_row(value) -> TypingStat:
        return TypingStat(
            id=str(value[0]),
            device_id=str(value[1]),
            source_test_id=str(value[2]),
            difficulty=value[3],
            language=value[4],
            duration=value[5],
            punctuation=value[6],
            numbers=value[7],
            wpm=float(value[8]),
            accuracy=float(value[9]),
            correct_characters=value[10],
            incorrect_characters=value[11],
            typed_characters=value[12],
            completed_words=value[13],
            elapsed_seconds=float(value[14]),
            finished_at=_iso(value[15]),
            created_at=_iso(value[16]),
            samples=value[17] if len(value) > 17 else [],
        )
