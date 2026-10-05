class TypingTestError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


class IdentityError(ValueError):
    def __init__(self, code: str):
        self.code = code
        super().__init__(code)
