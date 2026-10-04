from copy import deepcopy
from datetime import datetime
from threading import RLock
from uuid import UUID, uuid4

from app.domain.entities.identity import (
    Device,
    DeviceProfile,
    IdentityError,
    MAX_USERNAME_CHANGES,
    TypingStat,
    User,
)


def _iso(value: datetime | str) -> str:
    return value.isoformat() if isinstance(value, datetime) else value


class MemoryIdentityRepository:
    """Volatile identity storage for explicit local preview mode."""

    def __init__(self):
        self.users: dict[str, User] = {}
        self.usernames: dict[str, str] = {}
        self.devices: dict[str, Device] = {}
        self.stats: dict[str, TypingStat] = {}
        self.lock = RLock()

    def touch_device(self, device_id: str, now: str) -> None:
        with self.lock:
            current = self.devices.get(device_id)
            self.devices[device_id] = Device(
                id=device_id,
                user_id=current.user_id if current else None,
                created_at=current.created_at if current else now,
                last_seen_at=now,
            )

    def register_device(
        self,
        device_id: str,
        username: str,
        username_key: str,
        now: str,
    ) -> DeviceProfile:
        with self.lock:
            self.touch_device(device_id, now)
            device = self.devices[device_id]
            if device.user_id:
                user = self.users[device.user_id]
                if user.username_key != username_key:
                    raise IdentityError("already_registered")
                return self._profile(device_id)
            if username_key in self.usernames:
                raise IdentityError("username_taken")

            user = User(str(uuid4()), username, username_key, 0, now, now)
            self.users[user.id] = user
            self.usernames[username_key] = user.id
            self.devices[device_id] = Device(device.id, user.id, device.created_at, now)
            return self._profile(device_id)

    def get_profile(self, device_id: str) -> DeviceProfile:
        with self.lock:
            if device_id not in self.devices:
                raise IdentityError("device_not_found")
            return deepcopy(self._profile(device_id))

    def update_username(
        self,
        device_id: str,
        username: str,
        username_key: str,
        now: str,
    ) -> DeviceProfile:
        with self.lock:
            device = self.devices.get(device_id)
            if not device:
                raise IdentityError("device_not_found")
            if not device.user_id:
                raise IdentityError("not_registered")

            user = self.users[device.user_id]
            if username == user.username:
                return deepcopy(self._profile(device_id))
            if user.username_changes >= MAX_USERNAME_CHANGES:
                raise IdentityError("username_change_limit_reached")
            owner_id = self.usernames.get(username_key)
            if owner_id and owner_id != user.id:
                raise IdentityError("username_taken")

            self.usernames.pop(user.username_key, None)
            self.users[user.id] = User(
                user.id,
                username,
                username_key,
                user.username_changes + 1,
                user.created_at,
                now,
            )
            self.usernames[username_key] = user.id
            self.devices[device_id] = Device(
                device.id,
                device.user_id,
                device.created_at,
                now,
            )
            return deepcopy(self._profile(device_id))

    def save_stat(self, stat: TypingStat) -> None:
        with self.lock:
            self.touch_device(stat.device_id, stat.created_at)
            self.stats.setdefault(stat.source_test_id, deepcopy(stat))

    def clear_stats(self, device_id: str) -> DeviceProfile:
        with self.lock:
            if device_id not in self.devices:
                raise IdentityError("device_not_found")
            self.stats = {
                key: stat for key, stat in self.stats.items()
                if stat.device_id != device_id
            }
            return deepcopy(self._profile(device_id))

    def _profile(self, device_id: str) -> DeviceProfile:
        device = self.devices[device_id]
        user = self.users.get(device.user_id) if device.user_id else None
        all_stats = sorted(
            (stat for stat in self.stats.values() if stat.device_id == device_id),
            key=lambda stat: stat.finished_at,
            reverse=True,
        )
        summary = DeviceProfile.from_stats(device, user, all_stats)
        return DeviceProfile(
            device=device,
            user=user,
            stats=all_stats[:30],
            total_sessions=summary.total_sessions,
            best_wpm=summary.best_wpm,
            average_wpm=summary.average_wpm,
            average_accuracy=summary.average_accuracy,
        )


class PostgresIdentityRepository:
    def __init__(self, settings):
        import psycopg

        self.psycopg = psycopg
        self.connect = lambda: psycopg.connect(
            host=settings.db_host,
            port=settings.db_port,
            dbname=settings.db_name,
            user=settings.db_username,
            password=settings.db_password.get_secret_value(),
            connect_timeout=5,
        )

    def initialize(self) -> None:
        with self.connect() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id UUID PRIMARY KEY,
                    username VARCHAR(24) NOT NULL,
                    username_key VARCHAR(24) NOT NULL UNIQUE,
                    username_changes SMALLINT NOT NULL DEFAULT 0 CHECK (username_changes BETWEEN 0 AND 3),
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
            """)
            conn.execute("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS username_changes SMALLINT NOT NULL DEFAULT 0
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS devices (
                    id UUID PRIMARY KEY,
                    user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    last_seen_at TIMESTAMPTZ NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS typing_stats (
                    id UUID PRIMARY KEY,
                    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
                    source_test_id UUID NOT NULL UNIQUE,
                    difficulty VARCHAR(16) NOT NULL CHECK (difficulty IN ('easy', 'medium', 'hard')),
                    language VARCHAR(2) NOT NULL CHECK (language IN ('en', 'fr')),
                    duration_seconds SMALLINT NOT NULL CHECK (duration_seconds BETWEEN 1 AND 300),
                    punctuation BOOLEAN NOT NULL,
                    numbers BOOLEAN NOT NULL,
                    wpm NUMERIC(7, 2) NOT NULL CHECK (wpm >= 0),
                    accuracy NUMERIC(5, 2) NOT NULL CHECK (accuracy BETWEEN 0 AND 100),
                    correct_characters INTEGER NOT NULL CHECK (correct_characters >= 0),
                    incorrect_characters INTEGER NOT NULL CHECK (incorrect_characters >= 0),
                    typed_characters INTEGER NOT NULL CHECK (typed_characters >= 0),
                    completed_words INTEGER NOT NULL CHECK (completed_words >= 0),
                    elapsed_seconds NUMERIC(8, 2) NOT NULL CHECK (elapsed_seconds >= 0),
                    finished_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS typing_stats_device_finished
                ON typing_stats(device_id, finished_at DESC)
            """)

    def touch_device(self, device_id: str, now: str) -> None:
        with self.connect() as conn:
            conn.execute("""
                INSERT INTO devices (id, created_at, last_seen_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
            """, (UUID(device_id), now, now))

    def register_device(
        self,
        device_id: str,
        username: str,
        username_key: str,
        now: str,
    ) -> DeviceProfile:
        try:
            with self.connect() as conn:
                device_uuid = UUID(device_id)
                conn.execute("""
                    INSERT INTO devices (id, created_at, last_seen_at)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at
                """, (device_uuid, now, now))
                device_row = conn.execute(
                    "SELECT user_id FROM devices WHERE id = %s FOR UPDATE",
                    (device_uuid,),
                ).fetchone()
                if device_row[0]:
                    current = conn.execute(
                        "SELECT username_key FROM users WHERE id = %s",
                        (device_row[0],),
                    ).fetchone()
                    if current[0] != username_key:
                        raise IdentityError("already_registered")
                    return self._profile(conn, device_uuid)
                if conn.execute(
                    "SELECT 1 FROM users WHERE username_key = %s",
                    (username_key,),
                ).fetchone():
                    raise IdentityError("username_taken")

                user_id = uuid4()
                conn.execute("""
                    INSERT INTO users (id, username, username_key, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s)
                """, (user_id, username, username_key, now, now))
                conn.execute(
                    "UPDATE devices SET user_id = %s, last_seen_at = %s WHERE id = %s",
                    (user_id, now, device_uuid),
                )
                return self._profile(conn, device_uuid)
        except self.psycopg.errors.UniqueViolation as exc:
            raise IdentityError("username_taken") from exc

    def get_profile(self, device_id: str) -> DeviceProfile:
        with self.connect() as conn:
            device_uuid = UUID(device_id)
            updated = conn.execute(
                "UPDATE devices SET last_seen_at = NOW() WHERE id = %s RETURNING id",
                (device_uuid,),
            ).fetchone()
            if not updated:
                raise IdentityError("device_not_found")
            return self._profile(conn, device_uuid)

    def update_username(
        self,
        device_id: str,
        username: str,
        username_key: str,
        now: str,
    ) -> DeviceProfile:
        try:
            with self.connect() as conn:
                device_uuid = UUID(device_id)
                device_row = conn.execute(
                    "SELECT user_id FROM devices WHERE id = %s FOR UPDATE",
                    (device_uuid,),
                ).fetchone()
                if not device_row:
                    raise IdentityError("device_not_found")
                if not device_row[0]:
                    raise IdentityError("not_registered")

                user_id = device_row[0]
                current = conn.execute(
                    """
                    SELECT username, username_key, username_changes
                    FROM users WHERE id = %s FOR UPDATE
                    """,
                    (user_id,),
                ).fetchone()
                if current[0] == username:
                    return self._profile(conn, device_uuid)
                if current[2] >= MAX_USERNAME_CHANGES:
                    raise IdentityError("username_change_limit_reached")
                if conn.execute(
                    "SELECT 1 FROM users WHERE username_key = %s AND id <> %s",
                    (username_key, user_id),
                ).fetchone():
                    raise IdentityError("username_taken")

                conn.execute("""
                    UPDATE users
                    SET username = %s, username_key = %s,
                        username_changes = username_changes + 1, updated_at = %s
                    WHERE id = %s
                """, (username, username_key, now, user_id))
                conn.execute(
                    "UPDATE devices SET last_seen_at = %s WHERE id = %s",
                    (now, device_uuid),
                )
                return self._profile(conn, device_uuid)
        except self.psycopg.errors.UniqueViolation as exc:
            raise IdentityError("username_taken") from exc

    def save_stat(self, stat: TypingStat) -> None:
        with self.connect() as conn:
            conn.execute("""
                INSERT INTO typing_stats (
                    id, device_id, source_test_id, difficulty, language,
                    duration_seconds, punctuation, numbers, wpm, accuracy,
                    correct_characters, incorrect_characters, typed_characters,
                    completed_words, elapsed_seconds, finished_at, created_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s
                ) ON CONFLICT (source_test_id) DO NOTHING
            """, (
                UUID(stat.id), UUID(stat.device_id), UUID(stat.source_test_id),
                stat.difficulty, stat.language, stat.duration, stat.punctuation,
                stat.numbers, stat.wpm, stat.accuracy, stat.correct_characters,
                stat.incorrect_characters, stat.typed_characters,
                stat.completed_words, stat.elapsed_seconds, stat.finished_at,
                stat.created_at,
            ))

    def clear_stats(self, device_id: str) -> DeviceProfile:
        with self.connect() as conn:
            device_uuid = UUID(device_id)
            if not conn.execute(
                "SELECT 1 FROM devices WHERE id = %s FOR UPDATE",
                (device_uuid,),
            ).fetchone():
                raise IdentityError("device_not_found")
            conn.execute("DELETE FROM typing_stats WHERE device_id = %s", (device_uuid,))
            return self._profile(conn, device_uuid)

    def _profile(self, conn, device_id: UUID) -> DeviceProfile:
        row = conn.execute("""
            SELECT d.id, d.user_id, d.created_at, d.last_seen_at,
                   u.id, u.username, u.username_key, u.username_changes,
                   u.created_at, u.updated_at
            FROM devices d
            LEFT JOIN users u ON u.id = d.user_id
            WHERE d.id = %s
        """, (device_id,)).fetchone()
        if not row:
            raise IdentityError("device_not_found")

        device = Device(str(row[0]), str(row[1]) if row[1] else None, _iso(row[2]), _iso(row[3]))
        user = User(
            str(row[4]), row[5], row[6], row[7], _iso(row[8]), _iso(row[9])
        ) if row[4] else None
        stat_rows = conn.execute("""
            SELECT id, device_id, source_test_id, difficulty, language,
                   duration_seconds, punctuation, numbers, wpm, accuracy,
                   correct_characters, incorrect_characters, typed_characters,
                   completed_words, elapsed_seconds, finished_at, created_at
            FROM typing_stats
            WHERE device_id = %s
            ORDER BY finished_at DESC
            LIMIT 30
        """, (device_id,)).fetchall()
        stats = [TypingStat(
            id=str(value[0]), device_id=str(value[1]), source_test_id=str(value[2]),
            difficulty=value[3], language=value[4], duration=value[5],
            punctuation=value[6], numbers=value[7], wpm=float(value[8]),
            accuracy=float(value[9]), correct_characters=value[10],
            incorrect_characters=value[11], typed_characters=value[12],
            completed_words=value[13], elapsed_seconds=float(value[14]),
            finished_at=_iso(value[15]), created_at=_iso(value[16]),
        ) for value in stat_rows]
        summary = conn.execute("""
            SELECT COUNT(*), COALESCE(MAX(wpm), 0),
                   COALESCE(AVG(wpm), 0),
                   COALESCE(AVG(accuracy), 0)
            FROM typing_stats WHERE device_id = %s
        """, (device_id,)).fetchone()
        return DeviceProfile(
            device=device,
            user=user,
            stats=stats,
            total_sessions=summary[0],
            best_wpm=float(summary[1]),
            average_wpm=float(summary[2]),
            average_accuracy=float(summary[3]),
        )
