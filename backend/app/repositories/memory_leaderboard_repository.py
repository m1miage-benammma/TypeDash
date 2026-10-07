from dataclasses import dataclass, field

from app.core.security_context import device_context
from app.models.leaderboard import LeaderboardEntry, Leaderboards
from app.models.typing_stat import TypingStat
from app.models.user import User
from app.ports.leaderboard_repository import LeaderboardRepository


@dataclass
class _PlayerScores:
    user: User
    total_wpm: float = 0
    session_count: int = 0
    difficulties: set[str] = field(default_factory=set)
    best_session: TypingStat | None = None

    def add(self, stat: TypingStat) -> None:
        self.total_wpm += stat.wpm
        self.session_count += 1
        self.difficulties.add(stat.difficulty)
        if self.best_session is None or self._order(stat) > self._order(self.best_session):
            self.best_session = stat

    @staticmethod
    def _order(stat: TypingStat) -> tuple[float, str, str]:
        return stat.wpm, stat.finished_at, stat.id

    @property
    def average_difficulty(self) -> str:
        return next(iter(self.difficulties)) if len(self.difficulties) == 1 else "mixed"


class MemoryLeaderboardRepository(LeaderboardRepository):
    def __init__(self, devices):
        self.devices = devices

    def snapshot(self) -> Leaderboards:
        with self.devices.lock:
            device_id = device_context.get()
            viewer = self.devices.devices.get(device_id) if device_id else None
            viewer_id = viewer.user_id if viewer else None
            scores: dict[str, _PlayerScores] = {}
            for stat in self.devices.stats.values():
                device = self.devices.devices.get(stat.device_id)
                user = self.devices.users.get(device.user_id) if device and device.user_id else None
                if user:
                    scores.setdefault(user.id, _PlayerScores(user)).add(stat)
            averages = [
                (score.user, score.total_wpm / score.session_count, score.average_difficulty)
                for score in scores.values()
            ]
            bests = [
                (score.user, score.best_session.wpm, score.best_session.difficulty)
                for score in scores.values()
                if score.best_session
            ]

        def board(rows):
            ordered = sorted(rows, key=lambda row: (-row[1], row[0].username_key))
            return tuple(
                LeaderboardEntry(
                    username=user.username,
                    wpm=round(wpm, 1),
                    difficulty=difficulty,
                    rank=rank,
                    is_current=user.id == viewer_id,
                )
                for rank, (user, wpm, difficulty) in enumerate(ordered, 1)
                if rank <= 3 or rank > len(ordered) - 2 or user.id == viewer_id
            )

        return Leaderboards(board(averages), board(bests))
