from fastapi import APIRouter, HTTPException, Request, Response

from app.api.responses.api import ApiResponse
from app.api.responses.auth import SessionIdentityResponse


def create_router() -> APIRouter:
    router = APIRouter()

    @router.post("/api/session", response_model=ApiResponse[SessionIdentityResponse])
    def session(request: Request, response: Response):
        security = request.app.state.security
        try:
            device = security.verify(request.cookies.get(security.cookie_name), "session")
        except HTTPException:
            device = security.new_device()
        response.set_cookie(security.cookie_name, security.sign(device, "session", 180 * 86400),
                            max_age=180 * 86400, httponly=True, secure=security.production,
                            samesite="strict", path="/")
        return ApiResponse(data=SessionIdentityResponse(device_id=device))

    return router
