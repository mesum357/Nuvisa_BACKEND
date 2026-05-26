#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}. Copy .env.example to .env first."
  exit 1
fi

# shellcheck disable=SC1090
source "${ENV_FILE}"

BACKUP_DIR="${ROOT}/backups"
mkdir -p "${BACKUP_DIR}"

STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="${BACKUP_DIR}/nuvisa_${STAMP}.sql.gz"

echo "Backing up database ${POSTGRES_DB} to ${OUT}..."

docker exec nuvisa-postgres pg_dump \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --no-owner \
  --no-acl \
  | gzip > "${OUT}"

echo "Done. Size: $(du -h "${OUT}" | cut -f1)"
