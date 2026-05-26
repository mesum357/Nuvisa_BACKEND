#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup.sql.gz|backup.sql>"
  echo "Restores into the running nuvisa-postgres container."
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"
BACKUP="$1"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

if ! docker ps --format '{{.Names}}' | grep -qx 'nuvisa-postgres'; then
  echo "Container nuvisa-postgres is not running. Start with: docker compose up -d"
  exit 1
fi

echo "WARNING: This will replace data in ${POSTGRES_DB}."
read -r -p "Type yes to continue: " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring from ${BACKUP}..."

if [[ "${BACKUP}" == *.gz ]]; then
  gunzip -c "${BACKUP}" | docker exec -i nuvisa-postgres psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1
else
  docker exec -i nuvisa-postgres psql \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    -v ON_ERROR_STOP=1 < "${BACKUP}"
fi

echo "Restore finished."
