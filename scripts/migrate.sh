#!/usr/bin/env bash
# ============================================================
# migrate.sh — aplica los sql/*.sql en orden y registra cuáles
# ya se corrieron por entorno, en una tabla de control
# `schema_migrations`. Evita la desincronización de esquema
# entre dev / test / prod.
#
# Todos los sql/ son IDEMPOTENTES (CREATE IF NOT EXISTS,
# INSERT ... ON DUPLICATE KEY, ALTER guardados), así que re-correr
# es seguro; la tabla de control solo salta lo ya aplicado (por
# checksum) y deja un historial auditable.
#
# Uso:
#   bash scripts/migrate.sh dev      # backend/.env            (contaft_online_dev)
#   bash scripts/migrate.sh test     # 127.0.0.1 contaft_online_test (root/root)
#   bash scripts/migrate.sh prod     # backend/.env.production (Hostinger)
#   bash scripts/migrate.sh <ruta-a-un-.env>
#
# Requiere el cliente `mysql` en el PATH.
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SQL_DIR="$ROOT/sql"
TARGET="${1:-dev}"

# --- Resolver el archivo .env / conexión según el target ---
ENV_FILE=""
case "$TARGET" in
  dev)  ENV_FILE="$ROOT/backend/.env" ;;
  prod) ENV_FILE="$ROOT/backend/.env.production" ;;
  test)
    DB_HOST=127.0.0.1; DB_PORT=3306
    DB_DATABASE=contaft_online_test; DB_USERNAME=root; DB_PASSWORD=root ;;
  *)
    if [ -f "$TARGET" ]; then ENV_FILE="$TARGET";
    else echo "❌ Target desconocido: $TARGET"; exit 1; fi ;;
esac

# strip: quita comillas simples/dobles envolventes de un valor .env
strip() { sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/'; }

if [ -n "$ENV_FILE" ]; then
  [ -f "$ENV_FILE" ] || { echo "❌ No existe $ENV_FILE"; exit 1; }
  get() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | strip; }
  DB_HOST="$(get DB_HOST)"; DB_PORT="$(get DB_PORT)"
  DB_DATABASE="$(get DB_DATABASE)"; DB_USERNAME="$(get DB_USERNAME)"
  DB_PASSWORD="$(get DB_PASSWORD)"
fi

: "${DB_PORT:=3306}"
export MYSQL_PWD="$DB_PASSWORD"   # evita problemas de quoting con -p
MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" "$DB_DATABASE" --connect-timeout=20 --default-character-set=utf8mb4)

echo "▶ Migrando [$TARGET] → $DB_USERNAME@$DB_HOST/$DB_DATABASE"
"${MYSQL[@]}" -e "SELECT 1" >/dev/null 2>&1 || { echo "❌ No se pudo conectar"; exit 1; }

# --- Tabla de control ---
"${MYSQL[@]}" -e "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) PRIMARY KEY,
  checksum   CHAR(32) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"

aplicadas=0; saltadas=0
for f in "$SQL_DIR"/*.sql; do
  name="$(basename "$f")"
  sum="$(md5sum "$f" | cut -d' ' -f1)"
  prev="$("${MYSQL[@]}" -N -e "SELECT checksum FROM schema_migrations WHERE filename='$name';")"

  if [ "$prev" = "$sum" ]; then
    echo "  = $name (sin cambios, salta)"; saltadas=$((saltadas+1)); continue
  fi

  echo "  ▶ aplicando $name ..."
  "${MYSQL[@]}" < "$f"
  "${MYSQL[@]}" -e "INSERT INTO schema_migrations (filename, checksum) VALUES ('$name','$sum')
                    ON DUPLICATE KEY UPDATE checksum='$sum', applied_at=NOW();"
  aplicadas=$((aplicadas+1))
done

echo "✔ Listo — $aplicadas aplicada(s), $saltadas sin cambios."
