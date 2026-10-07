#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
case "${1:-up}" in
  up) exec docker compose up -d --build ;;
  down) exec docker compose down ;;
  logs) exec docker compose logs -f ;;
  build) exec docker compose -f docker-compose.ci.yml build backend frontend ;;
  checks) exec docker compose -f docker-compose.ci.yml --profile checks run --build --rm frontend-checks ;;
  *) echo 'Usage: sh scripts/dev.sh [up|down|logs|build|checks]' >&2; exit 2 ;;
esac
