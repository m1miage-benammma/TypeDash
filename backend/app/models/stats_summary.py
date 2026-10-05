from dataclasses import dataclass


@dataclass(frozen=True)
class StatsSummary:
    sessions: int
    best_wpm: float
    average_wpm: float
    average_accuracy: float
