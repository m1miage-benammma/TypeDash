from app.models.leaderboard import LeaderboardEntry, Leaderboards
from app.ports.leaderboard_repository import LeaderboardRepository


class PostgresLeaderboardRepository(LeaderboardRepository):
    def __init__(self, database):
        self.database = database

    def snapshot(self) -> Leaderboards:
        with self.database.connection() as connection:
            data = connection.execute("SELECT typedash_private.leaderboard() AS boards").fetchone()["boards"]
        return Leaderboards(**{
            key: tuple(LeaderboardEntry(row["username"], float(row["wpm"])) for row in data[key])
            for key in ("average", "top_speed")
        })
