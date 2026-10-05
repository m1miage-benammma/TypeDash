from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from app.api.routers.calculator import router as calculator_router

from app.api.schemas.api import ApiResponse
from app.api.schemas.health import RootResponse
from app.services.system_service import SystemService

from app.api.error_handlers import install_error_handlers
from app.api.routers.devices import create_router as create_devices_router
from app.api.routers.health import router as health_router
from app.api.routers.typing import create_router as create_typing_router
from app.core.config import settings
from app.repositories.device_repository import PostgresDeviceRepository
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.repositories.typing_test_repository import PostgresTypingTestRepository
from app.services.device_service import DeviceService
from app.services.prompt_service import PromptService
from app.services.typing_service import TypingService


if settings.storage == "memory":
    test_repository = MemoryTypingTestRepository()
    device_repository = MemoryDeviceRepository()
else:
    test_repository = PostgresTypingTestRepository(settings)
    device_repository = PostgresDeviceRepository(settings)

device_service = DeviceService(device_repository)
typing_service = TypingService(test_repository, device_repository, PromptService())


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.storage == "memory":
        logging.warning(
            "TypeDash uses volatile memory storage "
            "(explicit local development mode)."
        )
    else:
        test_repository.initialize()
        device_repository.initialize()
    yield


app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    debug=settings.debug,
    lifespan=lifespan,
)
install_error_handlers(app)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def prevent_api_caching(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "private, no-store"
    return response


app.include_router(calculator_router)
app.include_router(health_router, prefix="/api")
app.include_router(create_typing_router(typing_service))
app.include_router(create_devices_router(device_service))


@app.get("/", tags=["system"], response_model=ApiResponse[RootResponse])
def read_root() -> ApiResponse[RootResponse]:
    """Return a minimal API status response."""
    return SystemService.root()
