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
- Lightweight HTTP typing transport: key batches every 400 ms, no persistent connection
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

TypeDash creates a device identity on the server. Access requires a signed, HttpOnly session cookie (`Secure` and `SameSite=Strict` in production). A device UUID is a public identifier, never an authentication credential.

The cookie lasts 180 days and is renewed when the browser initializes its session. Clearing cookies loses access to that browser's history. Legacy UUID-only identities are not automatically adopted: their ownership cannot be verified. Existing records are preserved, but users receive a new secure identity after this migration.

All application SQL transactions use the non-owner `typedash_runtime` role with `NOBYPASSRLS` and a transaction-local device context. Startup installs the schema and policies with the schema-owner connection, then validates the runtime role. A server signing key is generated once in `typedash_private.secrets`; it is shared across restarts/workers and is never exposed to the frontend or runtime SQL role. Schema initialization and the bounded retention job use the privileged connection. Cross-device ranking is restricted to one fixed, read-only `SECURITY DEFINER` function returning at most ten public usernames/scores per board, with a fixed search path and no public execute permission; private tables retain their ownership policies. Keep database credentials server-side.

Limits use atomic Redis counters when configured, otherwise atomic PostgreSQL counters, shared across workers. Requests are limited globally, by the peer address supplied by the ASGI server, and by authenticated device. Client-supplied forwarding headers are ignored by application code; configure Uvicorn's trusted proxy addresses only for the actual hosting proxy. Typing input is bounded to 32 keys per request, and HTTP bodies are limited to 16 KiB.

Storage ceilings are 10,000 temporary tests, 10,000 devices and 100,000 saved sessions across the application. The newest 2,000 saved sessions per device are retained. Temporary tests expire after 24 hours; a background job removes them and expired rate counters every five minutes. A full global quota rejects new records rather than silently growing the database; review quotas and capacity before increasing them. These controls reduce abuse but are not a network-level DDoS service.

Cloudflare Pages builds generate a CSP using hashes of prerendered inline scripts. JavaScript does not allow `unsafe-inline` or `unsafe-eval`; inline CSS remains allowed for Angular component styles and animations. HTTPS, frame blocking and Permissions-Policy are set for static pages, with separate security headers for FastAPI responses. Analytics connections remain allowed and are still consent-gated.

## Brand

TypeDash uses a palette inspired by Université Grenoble Alpes: navy `#2A2E47`, orange `#E84E10`, and white `#FFFFFF`. TypeDash is an independent project and is not presented as an official UGA service.

