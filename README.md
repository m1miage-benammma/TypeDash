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

The application uses an Angular frontend and a FastAPI backend with domain models, application services and repository ports. PostgreSQL/memory repositories and Redis rate limits are adapters wired at startup; services do not select SQL implementations. PostgreSQL provides persistent data. Docker Compose provides a reproducible local environment with live reload for both applications.

## Features

- Real-time character feedback with distinct correct and incorrect states
- Persistent WebSocket connection for immediate typing feedback and timer updates
- Server-calculated statistics shown only after a session finishes
- Native mobile keyboard input, including accented characters and IME composition
- English and French interfaces sharing the same URLs
- Easy, medium, and difficult word pools
- Optional punctuation and numbers mixed into generated text
- Preset durations and custom tests from 1 to 300 seconds
- Activity-based timer that pauses after 1.2 seconds without typing
- Multiple-line and word-by-word layouts with mobile-specific behavior
- Word Per Minute(WPM), accuracy, completed-word, and active-time metrics
- Device-linked usernames and progress history
- Light and dark themes using the UGA-inspired colour palette
- Search-friendly content pages, metadata, Open Graph, JSON-LD, sitemap, and robots directives
- Responsive navigation and interface

## Device identity and data

TypeDash creates a device identity on the server. Access requires a signed, HttpOnly session cookie (`Secure` and `SameSite=Strict` in production). A device UUID is a public identifier, never an authentication credential. WebSockets authenticate with a 30-second ticket bound to one device and one test, sent in the first frame rather than the URL.

The cookie lasts 180 days and is renewed when the browser initializes its session. Clearing cookies loses access to that browser's history. Legacy UUID-only identities are not automatically adopted: their ownership cannot be verified. Existing records are preserved, but users receive a new secure identity after this migration.

All application SQL transactions use the non-owner `typedash_runtime` role with `NOBYPASSRLS` and a transaction-local device context. Startup installs the schema and policies with the schema-owner connection, then validates the runtime role. A server signing key is generated once in `typedash_private.secrets`; it is shared across restarts/workers and is never exposed to the frontend or runtime SQL role. Schema initialization and the bounded retention job use the privileged connection. Cross-device ranking is restricted to one fixed, read-only `SECURITY DEFINER` function returning at most ten public usernames/scores per board, with a fixed search path and no public execute permission; private tables retain their ownership policies. Keep database credentials server-side.

Limits use atomic Redis counters when configured, otherwise atomic PostgreSQL counters, shared across workers. Requests are limited globally, by the peer address supplied by the ASGI server, and by authenticated device. Client-supplied forwarding headers are ignored by application code; configure Uvicorn's trusted proxy addresses only for the actual hosting proxy. WebSocket input is bounded to 32 keys per frame, 64 keys/second and two active streams per device per worker. Frames are limited to 8 KiB and HTTP bodies to 16 KiB.

Storage ceilings are 10,000 temporary tests, 10,000 devices and 100,000 saved sessions across the application. The newest 2,000 saved sessions per device are retained. Temporary tests expire after 24 hours; a background job removes them and expired rate counters every five minutes. A full global quota rejects new records rather than silently growing the database; review quotas and capacity before increasing them. These controls reduce abuse but are not a network-level DDoS service.

Netlify builds generate a CSP using hashes of prerendered inline scripts. JavaScript does not allow `unsafe-inline` or `unsafe-eval`; inline CSS remains allowed for Angular component styles and animations. HTTPS, frame blocking and Permissions-Policy are set for static pages, with separate security headers for FastAPI responses. Analytics connections remain allowed and are still consent-gated.

PostgreSQL data is stored in the `postgres_data` Docker volume. Running `docker compose down` keeps it; deleting the volume removes it.

## Docker development and release

Docker Desktop (Linux containers) or Docker Engine with Compose is the only local runtime prerequisite. Node, npm, Python and pip execute inside images, not on the host. Angular's development server uses Vite through `@angular/build`; the existing Angular architecture is retained.

From the repository root, configure the existing gitignored `.env` with `TYPEDASH_DB_NAME`, `TYPEDASH_DB_USERNAME` and `TYPEDASH_DB_PASSWORD`. Never commit these values. Start the development stack:

```sh
docker compose up -d --build
docker compose logs -f
docker compose down
```

The frontend runs at http://localhost:4200 and the API at http://localhost:8000. PostgreSQL retains the existing named volume. Redis is private to the Docker network with no host port, a 64 MiB memory ceiling and expiring counters. It reduces PostgreSQL writes for rate limiting, not for saved statistics. The small prepared-test handoff cache remains bounded and in-process; PostgreSQL remains the source of truth.

Build production images without local environment files or package managers:

```sh
docker compose -f docker-compose.ci.yml build backend frontend
docker build --target artifact --output type=local,dest=dist/published ./frontend
```

Only the public API origin is a frontend build argument; pass `--build-arg TYPEDASH_API_ORIGIN=https://your-backend.example` if it differs from the existing Render origin. Secrets are runtime environment values, never build arguments. Optional frontend regression checks run in Docker with `docker compose -f docker-compose.ci.yml --profile checks run --build --rm frontend-checks`.

Convenience wrappers provide the same commands: `./scripts/dev.ps1 up` in PowerShell or `sh scripts/dev.sh up` in a POSIX shell, with `down`, `logs`, `build` and `checks` actions.

Backend tests and their dependencies have been removed as requested. CI builds production images on pushes and pull requests; it does not execute test suites. The manual **Deploy production** workflow verifies Docker builds, deploys the exact commit to Render, waits for live status and health, then publishes the preserved frontend artifact using a containerized Netlify CLI. A failed backend prevents frontend publication. Netlify Git builds are skipped to avoid publishing independently of this sequence.

Deployment is one button: push to `main`, open **Actions → Deploy production → Run workflow**, select `main` and confirm. No input fields or local build commands are required. Build-only verification remains the separate Docker production builds workflow.

Configure `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` under GitHub **Settings → Secrets and variables → Actions → Secrets**, never as plaintext variables or committed `.env` files. The workflow passes secrets only into ephemeral deployment/preflight containers; build arguments contain only public origins. A pre-publication check rejects artifacts containing the configured secret values or their common encodings. Database credentials and Redis URLs stay in server runtime settings, never in Angular. Secret names in YAML are public; their values are not. Authorized repository administrators and workflow code can still access/use secrets, so review deployment changes and rotate credentials if previously exposed.

Two leaderboards sit below the typing game: average WPM over retained completed sessions and best completed-session WPM. Each lists at most ten registered usernames and rounded scores across all languages, durations and difficulties. Registration makes the username and aggregate scores public; device IDs, cookies, history and session payloads are never returned by the leaderboard. Anonymous sessions are excluded until the player registers. Ties use normalized username ordering. The backend computes and ranks all results; the UI only displays them and refreshes after profile/session changes. Historical cleanup changes the average because only retained sessions are counted.

For hosted deployments, Redis is optional: set the server-only `TYPEDASH_REDIS_URL` to a private Redis endpoint to use distributed expiring counters. Without it, the existing PostgreSQL counters remain active. When configured Redis is unavailable, requests are denied rather than bypassing limits. Redis counters are transient and reset after a Redis restart; statistics and user data remain in PostgreSQL.

The authentication change requires coordinated backend/frontend publication. Existing open tabs using the old client need a reload after deployment. The normal workflow publishes the backend first, then the frontend after a successful health check. During that short interval, the old client is denied access by the secured backend. Roll back both applications together if required; do not weaken authentication to support UUID-only clients.


## Brand

TypeDash uses a palette inspired by Université Grenoble Alpes: navy `#2A2E47`, orange `#E84E10`, and white `#FFFFFF`. TypeDash is an independent project and is not presented as an official UGA service.

## Repository

Source code and project history are available at [github.com/m1miage-benammma/TypeDash](https://github.com/m1miage-benammma/TypeDash).
