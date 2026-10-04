FROM python:3.12-slim AS runtime

WORKDIR /app

# Database credentials are injected at container runtime through Docker Compose.
# Never add database secrets with ARG, ENV, or COPY in this image.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN pip install --no-cache-dir \
    "fastapi>=0.115,<1.0" \
    "uvicorn[standard]>=0.30,<1.0" \
    "pydantic-settings>=2.0,<3.0" \
    "psycopg[binary]>=3.2,<4.0" \
    "regex>=2024.11.6"

FROM runtime AS development

COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", "--reload-dir", "/app/app"]

FROM runtime AS production

COPY app ./app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
