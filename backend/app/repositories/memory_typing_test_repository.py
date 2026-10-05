from contextlib import contextmanager
from copy import deepcopy
from threading import RLock

from app.models.typing_test import TypingTest


class MemoryTypingTestRepository:
    """Volatile persistence without expiration or capacity policy."""

    def __init__(self):
        self.tests: dict[str, TypingTest] = {}
        self.lock = RLock()

    @contextmanager
    def transaction(self):
        with self.lock:
            backup = deepcopy(self.tests)
            try:
                yield self
            except Exception:
                self.tests = backup
                raise

    def find(self, test_id: str) -> TypingTest | None:
        return deepcopy(self.tests.get(test_id))

    def save(self, test: TypingTest) -> None:
        self.tests[test.id] = deepcopy(test)

    def count(self) -> int:
        return len(self.tests)

    def delete_before(self, cutoff: str) -> None:
        self.tests = {key: test for key, test in self.tests.items()
                      if test.created_at >= cutoff}
