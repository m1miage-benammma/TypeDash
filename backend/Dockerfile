FROM python:3.12-slim AS builder

RUN pip install --no-cache-dir --prefix=/install \
    "fastapi>=0.115,<1.0" \
    "uvicorn[standard]>=0.30,<1.0" \
    "pydantic-settings>=2.0,<3.0" \
    "psycopg[binary]>=3.2,<4.0" \
    "regex>=2024.11.6"

FROM python:3.12-slim AS runtime

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000
COPY --from=builder /install /usr/local
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.getenv('PORT','8000')+'/api/health',timeout=3)" || exit 1

FROM runtime AS development

COPY app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/app"]

FROM runtime AS production

RUN groupadd --gid 10001 appuser && useradd --uid 10001 --gid appuser --no-create-home appuser
COPY --chown=appuser:appuser app ./app
USER appuser
ENV TYPEDASH_RUNTIME_ENVIRONMENT=production
# Secrets are injected by the host; no .env file or credential is copied.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"${PORT:-8000}\""]
