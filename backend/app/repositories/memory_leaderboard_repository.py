from app.models.leaderboard import LeaderboardEntry, Leaderboards
from app.ports.leaderboard_repository import LeaderboardRepository


class MemoryLeaderboardRepository(LeaderboardRepository):
    def __init__(self, devices):
        self.devices = devices

    def snapshot(self) -> Leaderboards:
        with self.devices.lock:
            totals = {}
            for stat in self.devices.stats.values():
                device = self.devices.devices.get(stat.device_id)
                user = self.devices.users.get(device.user_id) if device and device.user_id else None
                if user:
                    total, count, best, _ = totals.get(user.id, (0, 0, 0, user))
                    totals[user.id] = (total + stat.wpm, count + 1, max(best, stat.wpm), user)
            averages = [(user, total / count) for total, count, _, user in totals.values()]
            bests = [(user, best) for _, _, best, user in totals.values()]
        def board(rows):
            return tuple(LeaderboardEntry(user.username, round(wpm, 1))
                         for user, wpm in sorted(rows, key=lambda row: (-row[1], row[0].username_key))[:10])
        return Leaderboards(board(averages), board(bests))
