#!/usr/bin/env sh
set -eu

for variable in POSTGRES_MIGRATION_USER POSTGRES_MIGRATION_PASSWORD POSTGRES_API_USER POSTGRES_API_PASSWORD; do
  value=$(printenv "$variable" || true)
  if [ -z "$value" ]; then
    echo "Missing required $variable for initial Postgres role setup." >&2
    exit 1
  fi
done

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=database="$POSTGRES_DB" \
  --set=migration_user="$POSTGRES_MIGRATION_USER" \
  --set=migration_password="$POSTGRES_MIGRATION_PASSWORD" \
  --set=api_user="$POSTGRES_API_USER" \
  --set=api_password="$POSTGRES_API_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'migration_user', :'migration_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'migration_user')\gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'api_user', :'api_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'api_user')\gexec

GRANT CONNECT ON DATABASE :"database" TO :"migration_user", :"api_user";
GRANT USAGE, CREATE ON SCHEMA public TO :"migration_user";
GRANT USAGE ON SCHEMA public TO :"api_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_user" IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"api_user";
ALTER DEFAULT PRIVILEGES FOR ROLE :"migration_user" IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"api_user";
SQL
