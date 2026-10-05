from datetime import datetime
from math import ceil

from app.models.enums import SessionStatus
from app.models.typing_test import TypingTest
from app.services.typing_engine import characters, elapsed


def typing_view(test: TypingTest, now: datetime, word_by_word: bool) -> dict:
    actual = characters(test.typed)
    words = []
    cursor = 0
    active_word = None
    source = test.text.split(" ")
    for index, word in enumerate(source):
        values = characters(word)
        if index < len(source) - 1:
            values.append(" ")
        rendered = []
        for value in values:
            entered = cursor < len(actual)
            rendered.append({
                "index": cursor, "value": value, "current": cursor == len(actual),
                "correct": entered and actual[cursor] == value,
                "incorrect": entered and actual[cursor] != value, "space": value == " ",
            })
            cursor += 1
        item = {"index": index, "chars": rendered}
        words.append(item)
        if active_word is None and cursor > len(actual):
            active_word = item
    remaining = max(0, test.duration - elapsed(test, now))
    seconds = ceil(remaining)
    samples = test.result["samples"] if test.result else []
    maximum = max([10, *(sample["wpm"] for sample in samples)])
    return {
        "words": [active_word or words[-1]] if word_by_word and words else words,
        "clock": f"{seconds // 60:02d}:{seconds % 60:02d}",
        "elapsed_percent": 100 * (1 - remaining / test.duration),
        "active": test.status in (SessionStatus.RUNNING, SessionStatus.PAUSED),
        "can_type": test.status != SessionStatus.FINISHED,
        "can_configure": test.status in (SessionStatus.READY, SessionStatus.FINISHED),
        "urgent": test.status == SessionStatus.RUNNING and remaining <= 5,
        "custom_duration": test.duration not in (15, 30, 60),
        "durations": [15, 30, 60],
        "result_chart": [{**sample, "height_percent": max(3, sample["wpm"] / maximum * 100)}
                         for sample in samples] if len(samples) > 1 else [],
    }
