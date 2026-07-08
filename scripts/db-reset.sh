#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

DB_CONTAINER="${DB_CONTAINER:-uempyris-pg}"

if command -v podman >/dev/null 2>&1; then
  CONTAINER=podman
elif command -v docker >/dev/null 2>&1; then
  CONTAINER=docker
else
  echo "Missing podman/docker."
  exit 1
fi

$CONTAINER start "$DB_CONTAINER" >/dev/null
$CONTAINER exec "$DB_CONTAINER" psql -U postgres -d postgres \
  -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'

npx drizzle-kit push
