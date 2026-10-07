"""Realtime transport; scoring stays in the existing typing services."""
import asyncio
from copy import deepcopy
from time import monotonic

from fastapi import WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.api.requests.typing import GetTypingTestRequest, TypingBatchRequest
from app.core.clock import utc_now
from app.models.errors import TypingTestError
from app.services.typing_engine import elapsed, update_test
from app.services.typing_input import apply_input
from app.services.typing_service import TypingService


class TypingStreamService:
    def __init__(self, typing: TypingService):
        self.typing = typing
        self.connections: dict[str, str] = {}

    def _load(self, request):
        prepared = self.typing.prepared_tests.take(str(request.test_id))
        if prepared is not None:
            self.typing.require_owner(prepared)
            return prepared
        with self.typing.test_repository.transaction() as storage:
            return self.typing._require_test(storage, str(request.test_id))

    def _persist(self, test, device_id):
        self.typing.persist(test, device_id)

    def _frame(self, test, now, word_by_word):
        # Static prompt/options are sent once at connection time. Subsequent
        # frames contain timer/input acknowledgements; scores are end-only.
        return self.typing._response(test, now, word_by_word, include_words=False).model_dump(
            mode="json", exclude={"data": {
                "text": True, "punctuation": True, "numbers": True,
                "difficulty": True, "language": True, "duration": True,
                "view": {"words": True},
            }},
        )

    async def connect(self, socket: WebSocket, request: GetTypingTestRequest):
        test_id = str(request.test_id)
        if (not request.device_id or test_id in self.typing.live_tests
                or len(self.connections) >= 32
                or list(self.connections.values()).count(str(request.device_id)) >= 2):
            await socket.close(code=1008)
            return
        self.typing.live_tests[test_id] = None
        self.connections[test_id] = str(request.device_id)
        test = None
        writer = None
        final_saved = False
        checkpoint = None
        last_saved = monotonic()
        last_sent = monotonic()
        last_status = None
        word_by_word = request.word_by_word
        device_id = str(request.device_id)
        window_started = monotonic()
        input_count = 0
        frame_count = 0
        connected_at = monotonic()
        try:
            test = await asyncio.to_thread(self._load, request)
            checkpoint = (test.revision, test.status, test.active_seconds)
            self.typing.live_tests[test_id] = test
            if test.result:
                await asyncio.to_thread(self._persist, deepcopy(test), device_id)
                final_saved = True
            # New clients already have the committed prompt from HTTP. Older
            # clients retain the complete first frame during rolling deploys.
            initial = (self._frame(test, utc_now(), word_by_word) if request.compact else
                       self.typing._response(test, utc_now(), word_by_word).model_dump(mode="json"))
            await socket.send_json(initial)
            while not test.result:
                if monotonic() - connected_at > 1800:
                    await socket.close(code=1000, reason="Session idle timeout.")
                    break
                try:
                    payload = await asyncio.wait_for(socket.receive_text(), timeout=0.1)
                except asyncio.TimeoutError:
                    payload = None
                now = utc_now()
                if payload is not None:
                    if len(payload) > 8192:
                        await socket.close(code=1009)
                        break
                    batch = TypingBatchRequest.model_validate_json(payload)
                    if str(batch.device_id) != device_id:
                        raise TypingTestError("device_mismatch")
                    if monotonic() - window_started >= 1:
                        window_started, input_count, frame_count = monotonic(), 0, 0
                    input_count += len(batch.inputs)
                    frame_count += 1
                    if input_count > 64 or frame_count > 40:
                        await socket.close(code=1008, reason="Typing rate limit exceeded.")
                        break
                    # Bound work per frame and keep CPU-heavy scoring off the event loop.
                    test = await asyncio.to_thread(self._apply_batch, test, batch, now)
                    word_by_word = batch.inputs[-1].word_by_word
                    self.typing.live_tests[test_id] = test
                else:
                    await asyncio.to_thread(update_test, test, test.typed, test.revision,
                                            elapsed(test, now) >= test.duration, now)
                if writer is not None and writer.done():
                    await writer
                    writer = None
                if test.result:
                    if writer is not None:
                        await writer
                        writer = None
                    await asyncio.to_thread(self._persist, deepcopy(test), device_id)
                    final_saved = True
                elif (test.revision, test.status, test.active_seconds) != checkpoint and monotonic() - last_saved >= 1 and writer is None:
                    writer = asyncio.create_task(asyncio.to_thread(self._persist, deepcopy(test), device_id))
                    checkpoint = (test.revision, test.status, test.active_seconds)
                    last_saved = monotonic()
                if payload is not None or test.status == "running" or test.status != last_status or test.result or monotonic() - last_sent >= 1:
                    await socket.send_json(self._frame(test, now, word_by_word))
                    last_sent = monotonic()
                    last_status = test.status
            if test.result:
                await socket.close(code=1000)
        except WebSocketDisconnect:
            pass
        except (ValidationError, TypingTestError):
            await socket.close(code=1008)
        finally:
            try:
                if writer is not None:
                    await writer
                if test is not None and not final_saved:
                    await asyncio.to_thread(self._persist, deepcopy(test), device_id)
            finally:
                self.typing.live_tests.pop(test_id, None)
                self.connections.pop(test_id, None)

    @staticmethod
    def _apply_batch(test, batch, now):
        candidate = deepcopy(test)
        for entry in batch.inputs:
            apply_input(candidate, entry.key, entry.sequence, entry.word_by_word, now)
        return candidate
