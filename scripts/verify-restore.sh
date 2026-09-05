#!/usr/bin/env bash
set -euo pipefail

: "${KC_RESTORE_DATABASE_URL:?KC_RESTORE_DATABASE_URL is required and must point to an empty verification database}"
backup_file="${1:?Usage: scripts/verify-restore.sh /absolute/path/to/backup.dump}"

test -f "$backup_file"
test -f "$backup_file.sha256"
(cd "$(dirname "$backup_file")" && sha256sum --check "$(basename "$backup_file").sha256")
pg_restore --dbname="$KC_RESTORE_DATABASE_URL" --clean --if-exists --no-owner --no-privileges "$backup_file"
psql "$KC_RESTORE_DATABASE_URL" --set ON_ERROR_STOP=1 --tuples-only --command="select case when to_regclass('public.journal_entries') is not null and to_regclass('public.period_close_runs') is not null then 'RESTORE_OK' else 'RESTORE_INCOMPLETE' end;"
