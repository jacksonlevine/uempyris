#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "Created .env.local from .env.example. Fill the blank values, then rerun."
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

DATABASE_URL="${DATABASE_URL:-postgres://postgres:dev@localhost:5433/postgres}"
DB_CONTAINER="${DB_CONTAINER:-uempyris-pg}"
DB_IMAGE="${DB_IMAGE:-docker.io/postgres:16}"

if command -v podman >/dev/null 2>&1; then
  CONTAINER=podman
elif command -v docker >/dev/null 2>&1; then
  CONTAINER=docker
else
  echo "Missing podman/docker."
  exit 1
fi

if ! $CONTAINER container exists "$DB_CONTAINER" 2>/dev/null; then
  $CONTAINER run -d \
    --name "$DB_CONTAINER" \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=dev \
    -e POSTGRES_DB=postgres \
    -p 5433:5432 \
    "$DB_IMAGE" >/dev/null
else
  $CONTAINER start "$DB_CONTAINER" >/dev/null
fi

until $CONTAINER exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1; do
  sleep 1
done

if [ ! -d node_modules ]; then
  npm install
fi

npx drizzle-kit push

pids=()
cleanup() {
  for pid in "${pids[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

npx trigger.dev@latest dev &
pids+=("$!")

npm run dev &
pids+=("$!")

wait -n "${pids[@]}"
