#!/usr/bin/env bash
# One-time migration: Supabase-hosted Postgres -> VPS Docker Postgres
#
# Prerequisites on VPS:
#   1. docker compose up -d   (empty DB is OK)
#   2. pg_dump installed OR use a machine with Docker + network to Supabase
#
# Usage:
#   export SUPABASE_DIRECT_URL='postgresql://postgres.[ref]:[PASSWORD]@aws-0-....pooler.supabase.com:5432/postgres'
#   ./scripts/migrate-from-supabase.sh
#
# Use the *direct* session URL (port 5432), not the transaction pooler (6543).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ -z "${SUPABASE_DIRECT_URL:-}" ]]; then
  echo "Set SUPABASE_DIRECT_URL to your Supabase direct Postgres URL (port 5432)."
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

if ! docker ps --format '{{.Names}}' | grep -qx 'nuvisa-postgres'; then
  echo "Start Postgres first: cd ${ROOT} && docker compose up -d"
  exit 1
fi

DUMP_DIR="${ROOT}/backups"
mkdir -p "${DUMP_DIR}"
STAMP="$(date +%Y%m%d_%H%M%S)"
DUMP="${DUMP_DIR}/supabase_export_${STAMP}.sql"

echo "Exporting from Supabase..."
pg_dump "${SUPABASE_DIRECT_URL}" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  -f "${DUMP}"

echo "Importing into VPS Postgres (${POSTGRES_DB})..."
docker exec -i nuvisa-postgres psql \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -v ON_ERROR_STOP=1 < "${DUMP}"

echo "Migration dump saved at ${DUMP}"
echo "Next: point app DATABASE_URL to VPS (see README.md connection strings)."
