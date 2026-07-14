#!/bin/sh
set -eu
: "${DATABASE_URL:?set DATABASE_URL}"
: "${BACKUP_DIR:=/var/backups/pathweave}"
mkdir -p "$BACKUP_DIR"
filename="$BACKUP_DIR/pathweave-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$filename"
find "$BACKUP_DIR" -type f -name 'pathweave-*.dump' -mtime +14 -delete
