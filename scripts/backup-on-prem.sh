#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${KC_BACKUP_DIR:?KC_BACKUP_DIR is required}"

install -d -m 0700 "$KC_BACKUP_DIR"
backup_stamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$KC_BACKUP_DIR/kc-account-360-$backup_stamp.dump"
manifest_file="$backup_file.sha256"

pg_dump --dbname="$DATABASE_URL" --format=custom --compress=9 --no-owner --no-privileges --file="$backup_file"
sha256sum "$backup_file" > "$manifest_file"
chmod 0600 "$backup_file" "$manifest_file"
printf '%s\n' "$backup_file"
