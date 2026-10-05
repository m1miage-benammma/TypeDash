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

    def _load(self, request):
        with self.typing.test_repository.transaction() as storage:
            return self.typing._require_test(storage, str(request.test_id))

    def _persist(self, test, device_id):
        with self.typing.test_repository.transaction() as storage:
            storage.save(test)
        if test.result:
            self.typing._record_result(test, device_id, utc_now().isoformat())

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
        await socket.accept()
        test_id = str(request.test_id)
        if not request.device_id or test_id in self.typing.live_tests:
            await socket.close(code=1008)
            return
        self.typing.live_tests[test_id] = None
        test = None
        writer = None
        final_saved = False
        checkpoint = None
        last_saved = monotonic()
        last_sent = monotonic()
        last_status = None
        word_by_word = request.word_by_word
        device_id = str(request.device_id)
        try:
            test = await asyncio.to_thread(self._load, request)
            checkpoint = (test.revision, test.status, test.active_seconds)
            self.typing.live_tests[test_id] = test
            await socket.send_json(self.typing._response(test, utc_now(), word_by_word).model_dump(mode="json"))
            while not test.result:
                try:
                    payload = await asyncio.wait_for(socket.receive_text(), timeout=0.1)
                except asyncio.TimeoutError:
                    payload = None
                now = utc_now()
                if payload is not None:
                    if len(payload) > 65536:
                        await socket.close(code=1009)
                        break
                    batch = TypingBatchRequest.model_validate_json(payload)
                    if str(batch.device_id) != device_id:
                        raise TypingTestError("device_mismatch")
                    candidate = deepcopy(test)
                    for entry in batch.inputs:
                        apply_input(candidate, entry.key, entry.sequence, entry.word_by_word, now)
                    test = candidate
                    word_by_word = batch.inputs[-1].word_by_word
                    self.typing.live_tests[test_id] = test
                else:
                    update_test(test, test.typed, test.revision, elapsed(test, now) >= test.duration, now)
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
