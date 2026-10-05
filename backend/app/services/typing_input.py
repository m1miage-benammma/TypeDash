from datetime import datetime

from app.models.enums import SessionStatus
from app.models.errors import TypingTestError
from app.models.typing_test import TypingTest
from app.services.typing_engine import characters, elapsed, update_test


def apply_input(test: TypingTest, key: str, sequence: int,
                word_by_word: bool, now: datetime) -> None:
    update_test(test, test.typed, test.revision, elapsed(test, now) >= test.duration, now)
    if test.status == SessionStatus.FINISHED or sequence <= test.revision:
        return
    if sequence != test.revision + 1:
        raise TypingTestError("input_out_of_order")
    if test.input_word_by_word != word_by_word:
        test.auto_inserted_separator = False
        test.input_word_by_word = word_by_word
    actual = characters(test.typed)
    expected = characters(test.text)
    value = test.typed
    if key == "Backspace":
        value = "".join(actual[:-1])
        test.auto_inserted_separator = False
    elif len(characters(key)) == 1:
        if word_by_word and key == " " and test.auto_inserted_separator:
            test.auto_inserted_separator = False
        else:
            cursor = 0
            word_end = len(expected)
            for word in test.text.split(" "):
                word_end = cursor + len(characters(word))
                if word_end >= len(actual):
                    break
                cursor = word_end + 1
            has_separator = word_end < len(expected)
            if word_by_word and key == " ":
                value += "\ufffd" * max(0, word_end - len(actual))
                value += " " if has_separator else ""
                test.auto_inserted_separator = False
            else:
                value += key
                if word_by_word and has_separator and len(characters(value)) >= word_end:
                    value += " "
                    test.auto_inserted_separator = True
                else:
                    test.auto_inserted_separator = False
    value = "".join(characters(value)[:len(expected)])
    if value != test.typed:
        update_test(test, value, sequence, False, now)
    else:
        test.revision = sequence
