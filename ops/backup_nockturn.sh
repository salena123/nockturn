#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/project1/nockturn}"
ENV_FILE="${ENV_FILE:-$APP_DIR/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/nockturn}"
RETENTION_COUNT="${RETENTION_COUNT:-30}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

if [[ -z "${POSTGRES_DB:-}" || -z "${POSTGRES_USER:-}" || -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "POSTGRES_DB, POSTGRES_USER and BACKUP_ENCRYPTION_KEY must be set in $ENV_FILE" >&2
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
target_dir="$BACKUP_DIR/$timestamp"
mkdir -p "$target_dir"

cd "$APP_DIR"

echo "[1/4] Dumping PostgreSQL database..."
$COMPOSE_CMD --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$target_dir/postgres.dump"

echo "[2/4] Archiving encrypted document storage..."
$COMPOSE_CMD --env-file "$ENV_FILE" exec -T backend \
  tar -C /app -czf - uploads > "$target_dir/uploads.tar.gz"

echo "[3/4] Writing manifest..."
cat > "$target_dir/manifest.txt" <<EOF
created_at=$(date --iso-8601=seconds)
postgres_db=$POSTGRES_DB
app_dir=$APP_DIR
files=postgres.dump,uploads.tar.gz
EOF

echo "[4/4] Encrypting backup bundle..."
tar -C "$target_dir" -czf - postgres.dump uploads.tar.gz manifest.txt \
  | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$BACKUP_ENCRYPTION_KEY" \
  > "$BACKUP_DIR/${timestamp}.tar.gz.enc"

rm -rf "$target_dir"

echo "Pruning old backups..."
find "$BACKUP_DIR" -maxdepth 1 -type f -name "*.tar.gz.enc" \
  | sort -r \
  | awk -v keep="$RETENTION_COUNT" 'NR > keep { print }' \
  | while read -r old_backup; do
      rm -f "$old_backup"
    done

echo "Backup complete: $BACKUP_DIR/${timestamp}.tar.gz.enc"
