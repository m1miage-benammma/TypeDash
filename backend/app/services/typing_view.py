from app.models.enums import SessionStatus
from app.models.typing_test import TypingTest
from app.services.typing_engine import characters


def _prompt_words(test: TypingTest, word_by_word: bool) -> list[dict]:
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
    return [active_word or words[-1]] if word_by_word and words else words


def result_chart(result: dict | None) -> list[dict]:
    # Chart presentation uses the actual final score without changing stored samples.
    samples = list(result["samples"]) if result else []
    if result:
        final = {"second": result["elapsed_seconds"], "wpm": result["wpm"]}
        if samples and samples[-1]["second"] == final["second"]:
            samples[-1] = final
        else:
            samples.append(final)
    maximum = max([10, *(sample["wpm"] for sample in samples)])
    return [{**sample, "height_percent": sample["wpm"] / maximum * 100}
            for sample in samples]


def typing_view(test: TypingTest, word_by_word: bool, *, include_words: bool = True) -> dict:
    return {
        "words": _prompt_words(test, word_by_word) if include_words else [],
        "active": test.status in (SessionStatus.RUNNING, SessionStatus.PAUSED),
        "can_type": test.status != SessionStatus.FINISHED,
        "can_configure": test.status in (SessionStatus.READY, SessionStatus.FINISHED),
        "custom_duration": test.duration not in (15, 30, 60),
        "durations": [15, 30, 60],
        "result_chart": result_chart(test.result),
    }
