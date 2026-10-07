from functools import lru_cache
import json
from pathlib import Path
from random import SystemRandom

from app.models.enums import Difficulty, Language

_BANK_PATH = Path(__file__).parent.parent / "data" / "word_banks.json"
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


class PromptService:
    def __init__(self):
        # Load public, immutable banks before the first typing request.
        _word_banks()

    def generate(
        self,
        difficulty: Difficulty,
        language: Language,
        duration: int,
        punctuation: bool = False,
        numbers: bool = False,
    ) -> str:
        random = SystemRandom()
        word_count = max(160, duration * 8)
        bank = _word_banks()[str(language)][str(difficulty)]
        tokens: list[str] = []
        previous = ""

        for index in range(word_count):
            word = random.choice(bank)
            while word == previous:
                word = random.choice(bank)
            previous = word

            if punctuation and index % 4 == 2:
                word += random.choice(_PUNCTUATION)
            tokens.append(word)

            if numbers and index % 7 == 3:
                digits = {
                    Difficulty.EASY: 2,
                    Difficulty.MEDIUM: 3,
                    Difficulty.HARD: 4,
                }[difficulty]
                tokens.append(
                    str(random.randrange(10 ** (digits - 1), 10**digits))
                )

        return " ".join(tokens)
