"""Grapheme alignment shared by input handling, scoring and presentation."""
from functools import lru_cache
import unicodedata

import regex


def characters(text: str) -> list[str]:
    return regex.findall(r"\X", unicodedata.normalize("NFC", text))


@lru_cache(maxsize=128)
def prompt_characters(text: str) -> tuple[str, ...]:
    return tuple(characters(text))


def aligned_characters(text: str, typed: str, language: str) -> tuple[list[str], bool]:
    actual = characters(typed)
    if language != "fr":
        return actual, False
    expected = prompt_characters(text)
    aligned = []
    index = 0
    while index < len(actual):
        position = len(aligned)
        target = expected[position] if position < len(expected) else ""
        expansion = {"œ": "oe", "Œ": "OE"}.get(target)
        if expansion and actual[index] == expansion[0]:
            if index + 1 == len(actual):
                return [*aligned, actual[index]], True
            if actual[index + 1] == expansion[1]:
                aligned.append(target)
                index += 2
                continue
        aligned.append(actual[index])
        index += 1
    return aligned, False
