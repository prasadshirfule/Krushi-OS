#!/usr/bin/env bash
# KRUSHI OS — Automated PostgreSQL Backup Script (Bash)
set -eo pipefail

OUTPUT_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$OUTPUT_DIR"

BACKUP_FILE="${OUTPUT_DIR}/krushi_os_backup_${TIMESTAMP}.sql"
ARCHIVE_FILE="${BACKUP_FILE}.gz"

echo "================================================================"
echo "🌾 KRUSHI OS — AUTOMATED DATABASE BACKUP"
echo "================================================================"
echo "Target: ${ARCHIVE_FILE}"

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-postgres}"

if ! command -v pg_dump &> /dev/null; then
  echo "Error: pg_dump could not be found. Please install postgresql-client."
  exit 1
fi

echo "Dumping database ${DB_NAME} from ${DB_HOST}:${DB_PORT}..."
pg_dump -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl | gzip -9 > "${ARCHIVE_FILE}"

if [ -f "${ARCHIVE_FILE}" ]; then
  FILESIZE=$(ls -lh "${ARCHIVE_FILE}" | awk '{print $5}')
  echo "✓ Backup successful! Archive size: ${FILESIZE}"
else
  echo "Error: Backup file was not generated."
  exit 1
fi
