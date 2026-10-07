from app.api.requests.session import SessionRequest
from app.api.responses.api import ApiResponse
from app.api.responses.session import SessionResponse
from app.models.errors import TypingTestError
from app.services.typing_view import result_chart
from app.ports.device_repository import DeviceRepository


class SessionService:
    """Read durable, device-scoped session details; no live test dependency."""

    def __init__(self, repository: DeviceRepository):
        self.repository = repository

    def get(self, request: SessionRequest) -> ApiResponse[SessionResponse]:
        with self.repository.transaction() as storage:
            stat = storage.find_stat(str(request.device_id), str(request.stat_id))
        if stat is None:
            raise TypingTestError("not_found")
        result = {key: getattr(stat, key) for key in (
            "wpm", "accuracy", "correct_characters", "incorrect_characters",
            "typed_characters", "completed_words", "elapsed_seconds", "finished_at", "samples",
        )}
        return ApiResponse[SessionResponse](data=SessionResponse.model_validate({
            "id": stat.id, "difficulty": stat.difficulty, "language": stat.language,
            "duration": stat.duration, "punctuation": stat.punctuation, "numbers": stat.numbers,
            "result": result, "view": {"result_chart": result_chart(result)},
        }))
