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


## Brand

TypeDash uses a palette inspired by Université Grenoble Alpes: navy `#2A2E47`, orange `#E84E10`, and white `#FFFFFF`. TypeDash is an independent project and is not presented as an official UGA service.

## Repository

Source code and project history are available at [github.com/m1miage-benammma/TypeDash](https://github.com/m1miage-benammma/TypeDash).
