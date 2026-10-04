"""Efficient prompt generation backed by a cached static word bank."""

from functools import lru_cache
import json
from pathlib import Path
from random import SystemRandom

from app.domain.enums.typing import Difficulty, Language

_BANK_PATH = Path(__file__).parent.parent / "static" / "word_banks.json"
_PUNCTUATION = (",", ".", "!", "?", ";", ":")


@lru_cache(maxsize=1)
def _word_banks() -> dict[str, dict[str, tuple[str, ...]]]:
    raw = json.loads(_BANK_PATH.read_text(encoding="utf-8"))
    return {
        language: {
            difficulty: tuple(dict.fromkeys(words))
            for difficulty, words in difficulties.items()
        }
        for language, difficulties in raw.items()
    }


class WordBankSource:
    def generate(
        self,
        difficulty: Difficulty,
        language: Language,
        duration: int,
        punctuation: bool = False,
        numbers: bool = False,
    ) -> str:
        rng = SystemRandom()
        count = max(160, duration * 8)
        bank = _word_banks()[str(language)][str(difficulty)]
        tokens: list[str] = []
        previous = ""
        for index in range(count):
            word = rng.choice(bank)
            while word == previous:
                word = rng.choice(bank)
            previous = word
            if punctuation and index % 4 == 2:
                word += rng.choice(_PUNCTUATION)
            tokens.append(word)
            if numbers and index % 7 == 3:
                digits = {
                    Difficulty.EASY: 2,
                    Difficulty.MEDIUM: 3,
                    Difficulty.HARD: 4,
                }[difficulty]
                tokens.append(str(rng.randrange(10 ** (digits - 1), 10 ** digits)))
        return " ".join(tokens)
