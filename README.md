# TypeDash

A focused typing practice app built with Angular 21, Tailwind CSS and FastAPI.

TypeDash generates word tests with optional punctuation and numbers, three
difficulty levels, durations from 1 to 300 seconds, dark mode, English/French
content and a local progress history.

## Run with Docker

Create a private `.env` in this directory and define all of these variables:
`TYPEDASH_STORAGE`, `TYPEDASH_DB_HOST`, `TYPEDASH_DB_PORT`,
`TYPEDASH_DB_NAME`, `TYPEDASH_DB_USERNAME` and `TYPEDASH_DB_PASSWORD`.
Keep their real values out of source code and never commit this file.

Then run:

    docker compose up --build -d

- App: http://localhost:4200
- API documentation: http://localhost:8000/docs
- Stop without deleting data: docker compose down

The services are Angular served by Nginx, FastAPI and PostgreSQL 16. PostgreSQL
uses a persistent named volume and is not exposed on a public port. No
.dockerignore or requirements.txt file is used.

Database settings are injected into the backend container at runtime. They are
not copied into either Docker image and are never exposed to the Angular app.

## Local development

Install Node.js 22.12+ and Python 3.12+. From backend:

    python -m venv .venv
    # Windows PowerShell: .\.venv\Scripts\Activate.ps1
    # macOS/Linux: source .venv/bin/activate
    pip install "fastapi>=0.115,<1.0" "uvicorn[standard]>=0.30,<1.0" "pydantic-settings>=2.0,<3.0" "psycopg[binary]>=3.2,<4.0" "regex>=2024.11.6"

For a temporary preview without PostgreSQL:

    $env:TYPEDASH_STORAGE = "memory"
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

From frontend, in another terminal:

    npm ci
    npm start

Open http://localhost:4200. The development server proxies /api to FastAPI.

## Behavior

- The timer starts on the first changed character.
- After 1.2 seconds without a keystroke, active time pauses; the next changed
  character resumes it from the same remaining time.
- The backend is authoritative for elapsed time, WPM, accuracy and completed
  words. Angular only renders immediate character feedback.
- Pasting and dropping text during a test are blocked.
- WPM uses correct characters divided by five and active minutes.
- Accuracy compares the current input with the prompt character by character.
- Results retain WPM, accuracy and completed words. The progress page displays
  median WPM and median accuracy for the last 30 local results.
- Desktop defaults to multiple lines. Mobile uses the compact word-by-word view
  and hides the layout control.

## Architecture

Frontend:

- layouts/app-shell: shared navigation, theme, language and footer.
- features/typing-game/pages: the parent test page.
- features/progress/pages: the parent progress page.
- features/typing-game/services: HTTP Observables and local history.
- core/services: preferences and translations.
- shared/components: reusable visual components.

Backend:

- domain/entities and domain/enums: framework-independent typing rules.
- domain/ports: repository and prompt-source interfaces.
- application/dto: use-case commands.
- application/use_cases: session orchestration.
- adapters/inbound/http: standardized data responses and structured errors.
- adapters/outbound/services: PostgreSQL/memory repositories and prompt
  generation.
- adapters/outbound/static/word_banks.json: cached English/French word pool with
  more than 1,000 entries.

The local AGENT_INSTRUCTIONS.md contains private project guidance and is ignored
by Git.
