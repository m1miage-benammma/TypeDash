<p align="center">
  <img src="frontend/public/typedash-logo.svg" width="88" alt="TypeDash logo">
</p>

<h1 align="center">TypeDash</h1>

<p align="center">
  A focused, bilingual typing test for building speed, accuracy, and consistency.
</p>

<p align="center">
  <img alt="Angular 21" src="https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi&logoColor=white">
  <img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white">
  <img alt="Docker" src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white">
</p>

## About

TypeDash is a minimal typing practice application built around a distraction-free test experience. It generates English or French exercises, measures speed and accuracy on the backend, and keeps a history linked to the current browser device.

The application uses an Angular frontend, a FastAPI backend organized with ports and adapters, and PostgreSQL for persistent data. Docker Compose provides a reproducible local environment with live reload for both applications.

## Features

- Real-time character feedback with distinct correct and incorrect states
- English and French interfaces with dedicated localized URLs
- Easy, medium, and difficult word pools
- Optional punctuation and numbers mixed into generated text
- Preset durations and custom tests from 1 to 300 seconds
- Activity-based timer that pauses after 1.2 seconds without typing
- Multiple-line and word-by-word layouts with mobile-specific behavior
- WPM, accuracy, completed-word, and active-time metrics
- Device-linked usernames and progress history
- Light and dark themes using the UGA-inspired colour palette
- Search-friendly content pages, metadata, Open Graph, JSON-LD, sitemap, and robots directives
- Responsive navigation and interface

## Technology

| Area | Stack |
| --- | --- |
| Frontend | Angular 21, TypeScript, RxJS, Tailwind CSS 4 |
| Backend | Python 3.12, FastAPI, Pydantic |
| Data | PostgreSQL 16, psycopg |
| Delivery | Docker Compose, Nginx |
| Rendering | Angular prerendering with client-rendered typing interactions |

## Quick start with Docker

### Requirements

- Docker Desktop, or Docker Engine with Docker Compose
- Git

### 1. Clone the repository

```bash
git clone https://github.com/m1miage-benammma/TypeDash.git
cd TypeDash
```

### 2. Create the local environment file

Create a private `.env` file at the repository root:

```dotenv
TYPEDASH_STORAGE=postgres
TYPEDASH_DB_HOST=postgres
TYPEDASH_DB_PORT=5432
TYPEDASH_DB_NAME=typedash
TYPEDASH_DB_USERNAME=choose_a_local_username
TYPEDASH_DB_PASSWORD=choose_a_strong_local_password
```

The `.env` file is ignored by Git. Never commit real credentials.

### 3. Start the application

```bash
docker compose up --build
```

Open:

- TypeDash: <http://localhost:4200>
- FastAPI documentation: <http://localhost:8000/docs>
- API health check: <http://localhost:8000/api/health>

After the initial build, source changes are synchronized through Docker volumes. Angular and FastAPI reload automatically.

```bash
docker compose logs -f frontend
docker compose logs -f backend
```

Stop the stack without deleting PostgreSQL data:

```bash
docker compose down
```

## Local development

### Frontend

Node.js 22.12 or newer is recommended.

```bash
cd frontend
npm ci
npm start
```

The development server runs at <http://localhost:4200> and proxies `/api` requests to FastAPI.

Create an optimized production build with:

```bash
npm run build
```

### Backend

Create a Python 3.12 virtual environment from the `backend` directory and install the runtime packages:

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
pip install "fastapi>=0.115,<1.0" "uvicorn[standard]>=0.30,<1.0" "pydantic-settings>=2.0,<3.0" "psycopg[binary]>=3.2,<4.0" "regex>=2024.11.6"
```

For a temporary backend without PostgreSQL:

```powershell
$env:TYPEDASH_STORAGE = "memory"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Memory mode is intended only for local previews. Its data disappears when the backend restarts.

## Project structure

```text
TypeDash/
├── backend/
│   └── app/
│       ├── adapters/
│       │   ├── inbound/http/       # FastAPI routers and request/response schemas
│       │   └── outbound/           # Persistence and prompt generation
│       ├── application/
│       │   ├── dto/                # Use-case input objects
│       │   └── use_cases/          # Application orchestration
│       ├── core/                    # Runtime configuration
│       ├── domain/
│       │   ├── entities/           # Typing and identity business rules
│       │   ├── enums/              # Domain values
│       │   └── ports/              # Repository and service interfaces
│       ├── dependencies.py
│       └── main.py
├── frontend/
│   └── src/app/
│       ├── core/                    # Identity, preferences, i18n, validation, SEO
│       ├── features/
│       │   ├── content/             # Guides and WPM calculator
│       │   ├── progress/            # Device statistics page
│       │   └── typing-game/         # Interactive typing experience
│       ├── layouts/                 # Shared application shell
│       └── shared/                  # Reusable UI components
├── database-schema.puml             # Relational schema documentation
└── docker-compose.yml
```

## Architecture

The backend follows a hexagonal structure:

1. Domain entities contain typing, scoring, timer, identity, and username rules.
2. Application use cases coordinate the domain through explicit DTOs.
3. Domain ports define persistence and prompt-generation contracts.
4. Inbound adapters expose standardized FastAPI requests and responses.
5. Outbound adapters implement PostgreSQL, in-memory storage, and word-bank access.

The frontend is feature-oriented. Each route has one parent page component, shared state is kept in focused services, and HTTP operations return RxJS Observables.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check API availability |
| `POST` | `/api/tests` | Prepare a typing test |
| `GET` | `/api/tests/{test_id}` | Retrieve a typing session |
| `PUT` | `/api/tests/{test_id}/progress` | Save current typing progress |
| `POST` | `/api/tests/{test_id}/finish` | Finish and score a session |
| `GET` | `/api/devices/{device_id}` | Retrieve a device profile and history |
| `PUT` | `/api/devices/{device_id}/registration` | Register a username |
| `PATCH` | `/api/devices/{device_id}/username` | Change a username |
| `DELETE` | `/api/devices/{device_id}/stats` | Clear device statistics |

Successful API responses use a `{ "data": ... }` envelope. Errors use a consistent `{ "error": { "code": "...", "message": "..." } }` format.

## Internationalization and SEO

Public pages have dedicated English and French routes, reciprocal `hreflang` links, canonical URLs, translated metadata, Open Graph tags, and JSON-LD. Editorial pages are generated as static HTML. The interactive typing test is deferred and initialized in the browser.

The production origin is configured in `frontend/src/app/core/seo/seo-pages.ts` and must stay consistent with `frontend/public/robots.txt` and `frontend/public/sitemap.xml`.

## Device identity and data

TypeDash creates a random UUID in browser storage when typing begins. It does not access MAC addresses or use browser fingerprinting. The identifier lets the backend associate one browser profile with its username and typing history.

PostgreSQL data is stored in the `postgres_data` Docker volume. Running `docker compose down` keeps it; deleting the volume removes it.

## Brand

TypeDash uses a palette inspired by Université Grenoble Alpes: navy `#2A2E47`, orange `#E84E10`, and white `#FFFFFF`. TypeDash is an independent project and is not presented as an official UGA service.

## Repository

Source code and project history are available at [github.com/m1miage-benammma/TypeDash](https://github.com/m1miage-benammma/TypeDash).
