#!/usr/bin/env bash
# Backup verification: dump the SOURCE (production) database, restore it into a
# throwaway TARGET, and assert core tables restored with data. Proves the backup
# is usable — a backup you never restore is not a backup.
#
# Env:
#   SOURCE_DATABASE_URL  production (read-only is enough for pg_dump)
#   TARGET_DATABASE_URL  throwaway restore target (wiped)
set -euo pipefail

: "${SOURCE_DATABASE_URL:?SOURCE_DATABASE_URL is required}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL is required}"

DUMP="$(mktemp -d)/backup.dump"

echo "==> Dumping source…"
pg_dump --format=custom --no-owner --no-privileges "$SOURCE_DATABASE_URL" -f "$DUMP"
echo "    dump size: $(du -h "$DUMP" | cut -f1)"

echo "==> Restoring into target…"
pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$TARGET_DATABASE_URL" "$DUMP"

echo "==> Verifying restored row counts…"
fail=0
for table in User Organization Assessment Finding; do
  count=$(psql "$TARGET_DATABASE_URL" -tAc "SELECT count(*) FROM \"$table\";" 2>/dev/null || echo "ERR")
  echo "    $table: $count"
  if [ "$count" = "ERR" ]; then echo "    !! table $table missing"; fail=1; fi
done

# At least the User table must have rows for the restore to be meaningful.
users=$(psql "$TARGET_DATABASE_URL" -tAc 'SELECT count(*) FROM "User";' 2>/dev/null || echo 0)
if [ "${users:-0}" -lt 1 ]; then echo "!! No users restored — backup is empty or invalid"; fail=1; fi

rm -rf "$(dirname "$DUMP")"
if [ "$fail" -ne 0 ]; then echo "BACKUP VERIFICATION FAILED"; exit 1; fi
echo "Backup verification PASSED."
