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

The application uses an Angular frontend, a FastAPI backend well organized and PostgreSQL for persistent data. Docker Compose provides a reproducible local environment with live reload for both applications.

## Features

- Real-time character feedback with distinct correct and incorrect states
- Persistent WebSocket connection for immediate typing feedback and timer updates
- Server-calculated statistics shown only after a session finishes
- Native mobile keyboard input, including accented characters and IME composition
- English and French interfaces with dedicated localized URLs
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

TypeDash creates a random UUID in browser storage when typing begins. It does not access MAC addresses or use browser fingerprinting. The identifier lets the backend associate one browser profile with its username and typing history.

PostgreSQL data is stored in the `postgres_data` Docker volume. Running `docker compose down` keeps it; deleting the volume removes it.

## Realtime typing

The browser sends ordered key batches over `/api/tests/{id}/stream`. The backend validates input and pushes input acknowledgements and timer snapshots every 100 ms while running. WPM and accuracy are not sent or displayed during typing. Final scores appear only after persistence succeeds. The frontend only interpolates the displayed timer between snapshots; it never calculates WPM, accuracy, or final results.

Each keystroke is sent immediately when connected; the short transport interval only drains queued input after reconnection. Live frames skip prompt rendering, and timer-only updates do not rebuild the frontend passage. Server-side samples are retained for the final session chart, without streaming live scores.

The native textarea opens the phone keyboard directly on tap. Its input adapter converts native edits, spaces, deletion, and composed accents into transport keys. Paste/drop remain blocked. A desktop browser test cannot verify the actual iOS/Android keyboard: tap the passage on a real phone after deployment to confirm it opens.

The progress summary uses **all** persisted device sessions, even though the recent-history list displays at most 30. Average WPM is the sum of each session's WPM divided by the session count; best WPM is the maximum. Both are displayed with one decimal place, including the personal best above the typing test.

The former HTTP `/input`, `/inputs`, `/progress`, `/finish`, and root `/` routes have been removed. Session creation/recovery, the WebSocket stream, device/profile APIs, the calculator, and `/api/health` remain. Interactive API documentation is available locally only, not in production. Logo assets belong to the frontend.

Database checkpoints run in the background approximately once per second, and sessions are saved on disconnect. Final results are published only after the session and device-linked statistics have been persisted. Reconnection replays unacknowledged input (and recent acknowledged input if the server recovered from an older checkpoint), using sequence numbers to avoid duplicates.

Netlify builds use the existing public `TYPEDASH_API_ORIGIN` to connect directly to Render via `wss://`; no additional secret is needed. Local Angular and Docker proxies support WebSocket upgrades. The current deployment uses one backend worker/instance: live sessions are process-local. Multiple backend instances require a shared session coordinator before scaling. An abrupt server termination can lose up to the latest checkpoint interval if the client never reconnects.

Run backend realtime regression tests from `backend` with `python -B -m unittest discover -s tests -v`.

Run frontend keyboard regression tests from `frontend` with `npm test`. Both test suites run in the production workflow before deployment.

## Architecture

- Backend request DTOs: `backend/app/api/requests/`; response DTOs: `backend/app/api/responses/`. Routers handle transport, services own scoring and identity rules, and repositories own persistence.
- Frontend request DTOs: feature `requests/` folders and `core/requests/`; response DTOs: feature `responses/` folders and `core/responses/`. Domain/UI models stay in `models/`, without mixed request/response definitions.
- Every routed page has its own component, composed from shared feature components. Header and footer remain dedicated layout components.
- The typing-input component handles the native keyboard; the game component orchestrates the session. Deleted live-stat cards, mixed DTO files, and obsolete save-state controls are no longer maintained.
- Outfit fonts are bundled locally. GSAP reveals are lazy-loaded on content/progress pages only, respect reduced-motion preferences, and are cleaned up on navigation. Typing feedback is never animated by GSAP.

## Brand

TypeDash uses a palette inspired by Université Grenoble Alpes: navy `#2A2E47`, orange `#E84E10`, and white `#FFFFFF`. TypeDash is an independent project and is not presented as an official UGA service.

## Repository

Source code and project history are available at [github.com/m1miage-benammma/TypeDash](https://github.com/m1miage-benammma/TypeDash).
