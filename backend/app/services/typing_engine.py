from dataclasses import asdict
from datetime import datetime, timedelta
import unicodedata

from app.models.typing_test import TypingTest
from app.models.enums import SessionStatus
from app.models.errors import TypingTestError
from app.services.typing_text import aligned_characters, characters, prompt_characters

IDLE_SECONDS = 1.2
TRANSPORT_GRACE_SECONDS = 3.0


def idle_remaining(test: TypingTest, now: datetime) -> float:
    if test.status != SessionStatus.RUNNING or not test.last_activity_at:
        return 0.0
    delta = max(
        0.0,
        (now - datetime.fromisoformat(test.last_activity_at)).total_seconds(),
    )
    return max(0.0, IDLE_SECONDS - delta)


def elapsed(test: TypingTest, now: datetime) -> float:
    extra = 0.0
    if test.status == SessionStatus.RUNNING and test.last_activity_at:
        extra = min(
            IDLE_SECONDS,
            max(
                0.0,
                (now - datetime.fromisoformat(test.last_activity_at)).total_seconds(),
            ),
        )
    return min(test.duration, test.active_seconds + extra)


def score(test: TypingTest, now: datetime) -> dict:
    expected = prompt_characters(test.text)
    actual, _ = aligned_characters(test.text, test.typed, test.language)
    correct = sum(
        expected_character == actual_character
        for expected_character, actual_character in zip(expected, actual)
    )
    active_time = elapsed(test, now)
    completed_words = _count_completed_words(expected, actual, test.text)
    return {
        # Scores are calculated on the server and published only at session end.
        "wpm": round(correct / 5 * 60 / max(1.0, active_time), 1) if actual else 0.0,
        "accuracy": round(correct / len(actual) * 100, 1) if actual else 0.0,
        "correct_characters": correct,
        "incorrect_characters": len(actual) - correct,
        "typed_characters": len(actual),
        "completed_words": completed_words,
        "elapsed_seconds": round(active_time, 2),
    }


def update_test(
    test: TypingTest,
    typed: str,
    revision: int,
    finish: bool,
    now: datetime,
) -> None:
    if test.status == SessionStatus.FINISHED:
        return
    if now - datetime.fromisoformat(test.created_at) > timedelta(hours=24):
        raise TypingTestError("expired")

    typed = unicodedata.normalize("NFC", typed)
    actual, _ = aligned_characters(test.text, typed, test.language)
    if len(actual) > len(prompt_characters(test.text)):
        raise TypingTestError("text_too_long")

    active_time = elapsed(test, now)
    if active_time >= test.duration:
        _handle_expired_timer(test, typed, revision, finish, now)
        return

    if revision > test.revision and (test.status != SessionStatus.READY or typed):
        if test.status == SessionStatus.READY:
            test.started_at = now.isoformat()
        test.active_seconds = active_time
        test.last_activity_at = now.isoformat()
        test.status = SessionStatus.RUNNING
        test.typed = typed
        test.revision = revision
    elif test.status == SessionStatus.RUNNING and idle_remaining(test, now) == 0:
        test.active_seconds = active_time
        test.last_activity_at = None
        test.status = SessionStatus.PAUSED

    actual, pending_ligature = aligned_characters(test.text, test.typed, test.language)
    complete = (
        bool(test.typed)
        and len(actual) == len(prompt_characters(test.text))
        and not pending_ligature
    )
    if finish and not complete:
        raise TypingTestError("still_running")
    _record_sample(test, now)
    if complete:
        _finish(test, now)


def snapshot(test: TypingTest, now: datetime) -> dict:
    return {
        **asdict(test),
        "observed_at": now.isoformat(),
        "remaining_seconds": round(max(0.0, test.duration - elapsed(test, now)), 3),
        "pause_after_seconds": round(idle_remaining(test, now), 3),
    }


def _count_completed_words(expected: tuple[str, ...], actual: list[str], text: str) -> int:
    cursor = 0
    completed = 0
    words = text.split(" ")
    for index, word in enumerate(words):
        end = cursor + len(characters(word))
        if end >= len(actual) and not (index == len(words) - 1 and end == len(actual)):
            break
        if actual[cursor:end] == list(expected[cursor:end]) and (
            end == len(expected) or actual[end] == " "
        ):
            completed += 1
        cursor = end + 1
    return completed


def _record_sample(test: TypingTest, now: datetime) -> None:
    active_time = elapsed(test, now)
    if active_time >= 1 and (
        not test.samples or active_time - test.samples[-1]["second"] >= 2
    ):
        test.samples.append(
            {"second": round(active_time, 2), "wpm": score(test, now)["wpm"]}
        )


def _finish(test: TypingTest, now: datetime) -> None:
    test.active_seconds = elapsed(test, now)
    test.last_activity_at = None
    test.status = SessionStatus.FINISHED
    _record_sample(test, now)
    test.result = {
        **score(test, now),
        "finished_at": now.isoformat(),
        "samples": test.samples.copy(),
    }


def _handle_expired_timer(
    test: TypingTest,
    typed: str,
    revision: int,
    finish: bool,
    now: datetime,
) -> None:
    deadline = datetime.fromisoformat(test.last_activity_at) + timedelta(
        seconds=test.duration - test.active_seconds
    )
    within_grace = now <= deadline + timedelta(seconds=TRANSPORT_GRACE_SECONDS)
    if revision > test.revision and within_grace:
        test.typed = typed
        test.revision = revision
    if finish or not within_grace:
        _finish(test, now)
