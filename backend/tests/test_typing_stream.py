import asyncio
import json
import os
import time
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from fastapi import WebSocketDisconnect

from app.api.requests.typing import CreateTypingTestRequest, GetTypingTestRequest
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
with patch.dict(os.environ, {"TYPEDASH_STORAGE": "memory", "TYPEDASH_RUNTIME_ENVIRONMENT": "development"}):
    from app.services.typing_service import TypingService
    from app.services.typing_stream_service import TypingStreamService


class Socket:
    def __init__(self):
        self.incoming = asyncio.Queue()
        self.outgoing = asyncio.Queue()
        self.code = None

    async def accept(self):
        pass

    async def receive_text(self):
        value = await self.incoming.get()
        if value is None:
            raise WebSocketDisconnect()
        return value

    async def send_json(self, response):
        await self.outgoing.put(response["data"])

    async def close(self, code):
        self.code = code


class TypingStreamTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.devices = MemoryDeviceRepository()
        self.tests = MemoryTypingTestRepository()
        self.typing = TypingService(self.tests, self.devices, Mock(generate=Mock(return_value="hello world")))
        self.stream = TypingStreamService(self.typing)
        self.device = uuid4()

    async def start(self, duration=30, test_id=None):
        test_id = test_id or self.typing.prepare(CreateTypingTestRequest(duration=duration)).data.id
        socket = Socket()
        request = GetTypingTestRequest(test_id=test_id, device_id=self.device)
        task = asyncio.create_task(self.stream.connect(socket, request))
        self.addAsyncCleanup(self.stop, socket, task)
        initial = await asyncio.wait_for(socket.outgoing.get(), 2)
        return socket, task, initial

    async def stop(self, socket, task):
        if not task.done():
            await socket.incoming.put(None)
        await asyncio.wait_for(task, 3)

    async def keys(self, socket, entries):
        await socket.incoming.put(json.dumps({"device_id": str(self.device), "inputs": [
            {"key": key, "sequence": sequence} for sequence, key in entries
        ]}))

    async def revision(self, socket, revision):
        while True:
            response = await asyncio.wait_for(socket.outgoing.get(), 2)
            if response["revision"] == revision:
                return response

    async def test_input_acknowledgement_and_idempotent_reconnect(self):
        socket, task, initial = await self.start()
        await self.keys(socket, [(0, "h"), (1, "x")])
        response = await self.revision(socket, 1)
        self.assertNotIn("metrics", response)
        self.assertNotIn("text", response)
        self.assertNotIn("words", response["view"])
        await self.stop(socket, task)
        self.assertFalse(self.typing.live_tests)
        second, _, recovered = await self.start(test_id=initial["id"])
        self.assertEqual(recovered["typed"], "hx")
        await self.keys(second, [(0, "h"), (1, "x"), (2, "Backspace"), (3, "e")])
        response = await self.revision(second, 3)
        self.assertEqual(response["typed"], "he")
        self.assertNotIn("metrics", response)

    async def test_live_frame_does_not_render_the_prompt(self):
        socket, _, _ = await self.start()
        with patch("app.services.typing_view._prompt_words", side_effect=AssertionError("Expensive prompt rendering")):
            await self.keys(socket, [(0, "h")])
            response = await self.revision(socket, 0)
        self.assertNotIn("metrics", response)

    async def test_scores_are_not_published_during_typing(self):
        socket, _, _ = await self.start()
        await self.keys(socket, [(0, "h")])
        response = await self.revision(socket, 0)
        self.assertNotIn("metrics", response)

    async def test_api_keeps_only_used_typing_endpoints(self):
        with patch.dict(os.environ, {"TYPEDASH_STORAGE": "memory", "TYPEDASH_RUNTIME_ENVIRONMENT": "development"}):
            from app.main import app
        paths = app.openapi()["paths"]
        self.assertIn("/api/tests", paths)
        self.assertIn("/api/tests/{test_id}", paths)
        self.assertIn("/api/health", paths)
        self.assertNotIn("/", paths)
        for obsolete in ("input", "inputs", "progress", "finish"):
            self.assertNotIn(f"/api/tests/{{test_id}}/{obsolete}", paths)

    async def test_timer_pushes_without_http_polling_and_saves_final_result(self):
        socket, task, initial = await self.start(duration=1)
        await self.keys(socket, [(0, "h")])
        first = await self.revision(socket, 0)
        next_tick = await asyncio.wait_for(socket.outgoing.get(), 1)
        self.assertLess(next_tick["remaining_seconds"], first["remaining_seconds"])
        await asyncio.wait_for(task, 2)
        self.assertEqual(socket.code, 1000)
        self.assertEqual(len(self.devices.stats), 1)
        self.assertEqual(self.devices.stats[initial["id"]].device_id, str(self.device))
        self.assertIsNotNone(self.tests.find(initial["id"]).result)

    async def test_completed_prompt_is_saved_once_and_published(self):
        socket, task, initial = await self.start()
        await self.keys(socket, list(enumerate("hello world")))
        await asyncio.wait_for(task, 2)
        final = await self.revision(socket, 10)
        self.assertIsNotNone(final["result"])
        self.assertEqual(final["result"]["accuracy"], 100)
        self.assertEqual(socket.code, 1000)
        self.assertEqual(len(self.devices.stats), 1)
        self.assertEqual(self.tests.find(initial["id"]).typed, "hello world")

    async def test_final_frame_is_sent_only_after_durable_history_is_saved(self):
        socket, task, initial = await self.start(duration=1)
        send = socket.send_json

        async def verified_send(response):
            if response["data"].get("result"):
                self.assertIn(initial["id"], self.devices.stats)
                self.assertIsNotNone(self.tests.find(initial["id"]).result)
            await send(response)

        socket.send_json = verified_send
        await self.keys(socket, [(0, "h")])
        await asyncio.wait_for(task, 2)

    async def test_finished_reconnect_recovers_missing_durable_history(self):
        socket, task, initial = await self.start()
        await self.keys(socket, list(enumerate("hello world")))
        await asyncio.wait_for(task, 2)
        self.devices.stats.clear()
        _, second_task, recovered = await self.start(test_id=initial["id"])
        self.assertIsNotNone(recovered["result"])
        self.assertIn(initial["id"], self.devices.stats)
        await asyncio.wait_for(second_task, 2)

    async def test_idle_pause_is_authoritative(self):
        socket, _, _ = await self.start()
        await self.keys(socket, [(0, "h")])
        while True:
            response = await asyncio.wait_for(socket.outgoing.get(), 2)
            if response["status"] == "paused":
                break
        self.assertAlmostEqual(response["remaining_seconds"], 28.8, places=1)

    async def test_invalid_batch_is_atomic(self):
        socket, task, initial = await self.start()
        await self.keys(socket, [(0, "h"), (2, "e")])
        await asyncio.wait_for(task, 2)
        self.assertEqual(socket.code, 1008)
        self.assertEqual(self.tests.find(initial["id"]).revision, -1)

    async def test_slow_database_does_not_block_input_acknowledgements(self):
        persist = self.stream._persist

        def slow_persist(test, device):
            time.sleep(0.5)
            persist(test, device)

        self.stream._persist = slow_persist
        socket, _, _ = await self.start()
        await self.keys(socket, [(0, "h")])
        await self.revision(socket, 0)
        await asyncio.sleep(1.1)  # Background checkpoint is now sleeping.
        started = time.monotonic()
        await self.keys(socket, [(1, "e")])
        response = await self.revision(socket, 1)
        self.assertLess(time.monotonic() - started, 0.2)
        self.assertNotIn("metrics", response)


if __name__ == "__main__":
    unittest.main()
