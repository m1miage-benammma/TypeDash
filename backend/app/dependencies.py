from fastapi import Request
from app.application.use_cases.device_accounts import DeviceAccounts
from app.application.use_cases.typing_tests import TypingTests


def get_typing_tests(request: Request) -> TypingTests:
    return request.app.state.typing_tests


def get_device_accounts(request: Request) -> DeviceAccounts:
    return request.app.state.device_accounts
