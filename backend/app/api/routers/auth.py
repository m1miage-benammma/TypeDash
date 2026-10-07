from fastapi import APIRouter, HTTPException, Request, Response

from app.api.responses.api import ApiResponse
from app.api.responses.auth import SessionIdentityResponse
from app.core.clock import utc_now
from app.core.security_context import device_context
from app.services.device_service import DeviceService


def create_router(devices: DeviceService) -> APIRouter:
    router = APIRouter()

    @router.post("/api/session", response_model=ApiResponse[SessionIdentityResponse])
    def session(request: Request, response: Response):
        security = request.app.state.security
        try:
            device = security.verify(request.cookies.get(security.cookie_name), "session")
        except HTTPException:
            device = security.new_device()
        context = device_context.set(device)
        try:
            with devices.repository.transaction() as storage:
                DeviceService.touch(storage, device, utc_now().isoformat())
        finally:
            device_context.reset(context)
        response.set_cookie(security.cookie_name, security.sign(device, "session", 180 * 86400),
                            max_age=180 * 86400, httponly=True, secure=security.production,
                            samesite="strict", path="/")
        return ApiResponse(data=SessionIdentityResponse(device_id=device))

    return router
