"""Bounded, short-lived handoff cache for already committed ready tests."""
from collections import OrderedDict
from copy import deepcopy
from threading import Lock
from time import monotonic


class PreparedTestCache:
    def __init__(self, capacity=256, ttl=60, clock=monotonic):
        self.capacity = capacity
        self.ttl = ttl
        self.clock = clock
        self.entries = OrderedDict()
        self.lock = Lock()

    def put(self, test):
        with self.lock:
            self.entries[test.id] = (self.clock() + self.ttl, deepcopy(test))
            self.entries.move_to_end(test.id)
            while len(self.entries) > self.capacity:
                self.entries.popitem(last=False)

    def take(self, test_id):
        with self.lock:
            entry = self.entries.pop(test_id, None)
        if entry is None or entry[0] <= self.clock():
            return None
        return entry[1]

    def peek(self, test_id):
        with self.lock:
            entry = self.entries.get(test_id)
            if entry is None:
                return None
            if entry[0] <= self.clock():
                self.entries.pop(test_id, None)
                return None
            return deepcopy(entry[1])
