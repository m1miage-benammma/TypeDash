class PersistenceConflict(Exception):
    """A database uniqueness conflict, without application-level policy."""

    def __init__(self, constraint: str | None):
        super().__init__(constraint)
        self.constraint = constraint
