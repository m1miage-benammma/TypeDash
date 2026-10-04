from fastapi import Request
from app.application.use_cases.typing_tests import TypingTests


def get_typing_tests(request: Request) -> TypingTests:
    return request.app.state.typing_tests
