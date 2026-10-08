from contextlib import asynccontextmanager
import logging
import asyncio
import secrets
from contextlib import suppress

from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from app.api.routers.calculator import router as calculator_router
from app.api.routers.auth import create_router as create_auth_router
from app.api.security_middleware import SecurityMiddleware
from app.core.security import Security
from app.core.redis import RedisConnection
from app.core.security_database import initialize_security, maintain_security
from app.repositories.rate_limit_repository import RateLimits
from app.repositories.redis_rate_limit_repository import RedisRateLimits
from app.repositories.redis_cache import RedisResponseCache

from app.api.error_handlers import install_error_handlers
from app.api.routers.devices import create_router as create_devices_router
from app.api.routers.health import router as health_router
from app.api.routers.typing import create_router as create_typing_router
from app.core.config import settings
from app.core.postgres import PostgresDatabase
from app.repositories.device_repository import PostgresDeviceRepository
from app.repositories.memory_device_repository import MemoryDeviceRepository
from app.repositories.memory_typing_test_repository import MemoryTypingTestRepository
from app.repositories.typing_test_repository import PostgresTypingTestRepository
from app.services.device_service import DeviceService
from app.services.prompt_service import PromptService
from app.services.typing_service import TypingService
from app.api.routers.leaderboard import create_router as create_leaderboard_router
from app.repositories.leaderboard_repository import PostgresLeaderboardRepository
from app.repositories.memory_leaderboard_repository import MemoryLeaderboardRepository
from app.services.leaderboard_service import LeaderboardService


database = None
redis_connection = (
    RedisConnection(settings.redis_url.get_secret_value()) if settings.redis_url else None
)
if settings.storage == "memory":
    test_repository = MemoryTypingTestRepository()
    device_repository = MemoryDeviceRepository()
else:
    database = PostgresDatabase(settings)
    test_repository = PostgresTypingTestRepository(database)
    device_repository = PostgresDeviceRepository(database)

device_service = DeviceService(device_repository)
leaderboard_service = LeaderboardService(
    (MemoryLeaderboardRepository(device_repository) if database is None
     else PostgresLeaderboardRepository(database)),
    RedisResponseCache(redis_connection.client) if redis_connection else None,
)
typing_service = TypingService(
    test_repository, device_repository, PromptService(),
    capacity_check=(lambda storage: storage.count() < 2000) if settings.storage == "memory" else None,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    maintenance = None
    redis_limits = RedisRateLimits(redis_connection.client) if redis_connection else None
    if settings.storage == "memory":
        logging.warning(
            "TypeDash uses volatile memory storage "
            "(explicit local development mode)."
        )
        _app.state.security = Security(secrets.token_urlsafe(48), False)
        _app.state.rate_limits = redis_limits or RateLimits()
    else:
        try:
            database.open()
            test_repository.initialize()
            device_repository.initialize()
            key = initialize_security(database)
            _app.state.security = Security(key, settings.runtime_environment == "production")
            _app.state.rate_limits = redis_limits or RateLimits(database)
            maintenance = asyncio.create_task(maintain_database())
            yield
        finally:
            if maintenance:
                maintenance.cancel()
                with suppress(asyncio.CancelledError):
                    await maintenance
            database.close()
            if redis_connection:
                redis_connection.close()
        return
    try:
        yield
    finally:
        if redis_connection:
            redis_connection.close()


async def maintain_database():
    while True:
        try:
            await asyncio.to_thread(maintain_security, database)
        except Exception:
            logging.error("Database retention maintenance failed.")
        await asyncio.sleep(300)


app = FastAPI(
    title=settings.app_name,
    version="1.1.0",
    debug=settings.debug,
    lifespan=lifespan,
    docs_url=None if settings.runtime_environment == "production" else "/docs",
    redoc_url=None if settings.runtime_environment == "production" else "/redoc",
    openapi_url=None if settings.runtime_environment == "production" else "/openapi.json",
)
install_error_handlers(app)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(SecurityMiddleware)


app.include_router(calculator_router)
app.include_router(create_auth_router(device_service))
app.include_router(health_router, prefix="/api")
app.include_router(create_typing_router(typing_service))
app.include_router(create_devices_router(device_service))
app.include_router(create_leaderboard_router(leaderboard_service))
