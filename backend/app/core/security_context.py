from contextvars import ContextVar

# Set only after server-side authentication; copied into FastAPI worker threads.
device_context: ContextVar[str] = ContextVar("device_context", default="")
