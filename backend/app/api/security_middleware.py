from fastapi import HTTPException
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.security_context import device_context


class SecurityMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith("/api/"):
            return await self.app(scope, receive, send)
        request = Request(scope)
        security = request.app.state.security
        limits = request.app.state.rate_limits

        async def secure_send(message):
            if message["type"] == "http.response.start":
                message["headers"] += [(b"cache-control", b"private, no-store"),
                                       (b"x-content-type-options", b"nosniff"),
                                       (b"x-frame-options", b"DENY"),
                                       (b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"),
                                       (b"referrer-policy", b"no-referrer")]
                if security.production:
                    message["headers"].append((b"strict-transport-security", b"max-age=31536000"))
            await send(message)

        token = device_context.set("")
        try:
            if scope["path"] != "/api/health":
                if request.method not in {"GET", "HEAD", "OPTIONS"}:
                    if (request.headers.get("origin") not in security.origins
                            or request.headers.get("x-typedash-request") != "1"):
                        raise HTTPException(403, "Request origin is not allowed.")
                # Never trust arbitrary X-Forwarded-For / client-supplied headers.
                peer = request.client.host if request.client else "unknown"
                if not await run_in_threadpool(limits.allow_many, [
                    ("http-global", 6000), ("ip:" + security.client_key(peer), 480),
                ]):
                    raise HTTPException(429, "Too many requests.")
                checks = []
                if scope["path"] != "/api/session":
                    device = security.verify(request.cookies.get(security.cookie_name), "session")
                    device_context.set(device)
                    # Key batches arrive ~2/s; give them a separate bucket so typing never starves reads.
                    if scope["path"].endswith("/inputs"):
                        checks.append(("device-input:" + device, 300))
                    else:
                        checks.append(("device:" + device, 180))
                if request.method == "POST" and scope["path"] in {"/api/session", "/api/tests"}:
                    group = scope["path"]
                    checks.extend([("create-global:" + group, 120),
                                   ("create-ip:" + group + security.client_key(peer), 30)])
                    if device_context.get():
                        checks.append(("create-device:" + group + device_context.get(), 30))
                if checks and not await run_in_threadpool(limits.allow_many, checks):
                    raise HTTPException(429, "Too many requests. Please wait.")
                # Buffer a small bounded body before JSON parsing, including chunked requests.
                body = bytearray()
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    body.extend(message.get("body", b""))
                    if len(body) > 16384:
                        raise HTTPException(413, "Request body is too large.")
                    if not message.get("more_body", False):
                        break
                consumed = False

                async def bounded_receive():
                    nonlocal consumed
                    if consumed:
                        return await receive()
                    consumed = True
                    return {"type": "http.request", "body": bytes(body), "more_body": False}

                return await self.app(scope, bounded_receive, secure_send)
            return await self.app(scope, receive, secure_send)
        except HTTPException as error:
            headers = {"Retry-After": "60"} if error.status_code == 429 else None
            response = JSONResponse({"error": {"code": "request_rejected", "message": error.detail}},
                                    status_code=error.status_code, headers=headers)
            await response(scope, receive, secure_send)
        finally:
            device_context.reset(token)
