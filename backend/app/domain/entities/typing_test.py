"""Typing rules and the authoritative activity-based timer."""

from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
import unicodedata

from app.domain.enums.typing import Difficulty, Language, SessionStatus

IDLE_SECONDS = 1.2
TRANSPORT_GRACE_SECONDS = 3.0


class TestError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def characters(text: str) -> list[str]:
    import regex
    return regex.findall(r"\X", unicodedata.normalize("NFC", text))


@dataclass
class TypingTest:
    id: str
    difficulty: Difficulty
    language: Language
    duration: int
    text: str
    created_at: str
    status: SessionStatus = SessionStatus.READY
    started_at: str | None = None
    typed: str = ""
    revision: int = -1
    result: dict | None = None
    samples: list[dict] = field(default_factory=list)
    punctuation: bool = False
    numbers: bool = False
    active_seconds: float = 0.0
    last_activity_at: str | None = None

    def idle_remaining(self, now: datetime) -> float:
        if self.status != SessionStatus.RUNNING or not self.last_activity_at:
            return 0.0
        delta = max(0.0, (now - datetime.fromisoformat(self.last_activity_at)).total_seconds())
        return max(0.0, IDLE_SECONDS - delta)

    def elapsed(self, now: datetime) -> float:
        extra = 0.0
        if self.status == SessionStatus.RUNNING and self.last_activity_at:
            extra = min(IDLE_SECONDS, max(0.0, (now - datetime.fromisoformat(self.last_activity_at)).total_seconds()))
        return min(self.duration, self.active_seconds + extra)

    def score(self, now: datetime) -> dict:
        expected, actual = characters(self.text), characters(self.typed)
        correct = sum(a == b for a, b in zip(expected, actual))
        elapsed = self.elapsed(now)
        words = self.text.split(" ")
        cursor, completed = 0, 0
        for i, word in enumerate(words):
            end = cursor + len(characters(word))
            if end >= len(actual) and not (i == len(words) - 1 and end == len(actual)):
                break
            if actual[cursor:end] == expected[cursor:end] and (end == len(expected) or actual[end] == " "):
                completed += 1
            cursor = end + 1
        return {
            "wpm": round(correct / 5 * 60 / elapsed, 1) if elapsed >= 1 else 0.0,
            "accuracy": round(correct / len(actual) * 100, 1) if actual else 0.0,
            "correct_characters": correct,
            "incorrect_characters": len(actual) - correct,
            "typed_characters": len(actual),
            "completed_words": completed,
            "elapsed_seconds": round(elapsed, 2),
        }

    def _sample(self, now: datetime) -> None:
        elapsed = self.elapsed(now)
        if elapsed >= 1 and (not self.samples or elapsed - self.samples[-1]["second"] >= 2):
            self.samples.append({"second": round(elapsed, 2), "wpm": self.score(now)["wpm"]})

    def _finish(self, now: datetime) -> None:
        self.active_seconds = self.elapsed(now)
        self.last_activity_at = None
        self.status = SessionStatus.FINISHED
        self._sample(now)
        self.result = {**self.score(now), "finished_at": now.isoformat(), "samples": self.samples.copy()}

    def update(self, typed: str, revision: int, finish: bool, now: datetime) -> None:
        if self.status == SessionStatus.FINISHED:
            return  # Finishing again must never change a stored result.
        if now - datetime.fromisoformat(self.created_at) > timedelta(hours=24):
            raise TestError("expired")
        typed = unicodedata.normalize("NFC", typed)
        if len(characters(typed)) > len(characters(self.text)):
            raise TestError("text_too_long")

        elapsed = self.elapsed(now)
        if elapsed >= self.duration:
            # Do not let an older progress request close the final snapshot's grace.
            deadline = datetime.fromisoformat(self.last_activity_at) + timedelta(seconds=self.duration - self.active_seconds)
            within_grace = now <= deadline + timedelta(seconds=TRANSPORT_GRACE_SECONDS)
            if revision > self.revision and within_grace:
                self.typed, self.revision = typed, revision
            if finish or not within_grace:
                self._finish(now)
            return

        if revision > self.revision and (self.status != SessionStatus.READY or typed):
            # Only new typing revisions count as activity; polling never resumes a pause.
            if self.status == SessionStatus.READY:
                self.started_at = now.isoformat()
            self.active_seconds = elapsed
            self.last_activity_at = now.isoformat()
            self.status = SessionStatus.RUNNING
            self.typed, self.revision = typed, revision
        elif self.status == SessionStatus.RUNNING and self.idle_remaining(now) == 0:
            self.active_seconds = elapsed
            self.last_activity_at = None
            self.status = SessionStatus.PAUSED

        complete = bool(self.typed) and len(characters(self.typed)) == len(characters(self.text))
        if finish and not complete:
            raise TestError("still_running")
        self._sample(now)
        if complete:
            self._finish(now)

    def view(self, now: datetime) -> dict:
        return {
            **asdict(self),
            "remaining_seconds": round(max(0.0, self.duration - self.elapsed(now)), 3),
            "pause_after_seconds": round(self.idle_remaining(now), 3),
            "idle_timeout_seconds": IDLE_SECONDS,
            "metrics": self.result or self.score(now),
        }


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
