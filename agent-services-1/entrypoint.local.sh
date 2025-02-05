#!/bin/bash
set -e

echo "Acquiring advisory lock for additive migrations..."

export PGPASSWORD="$OB1_DB_PASSWORD_AGENTSERVICE"
PG_LOCK_QUERY="SELECT pg_advisory_lock(12345);"
PG_UNLOCK_QUERY="SELECT pg_advisory_unlock(12345);"

# Acquire advisory lock
psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_LOCK_QUERY"

echo "🏗️ Running additive migrations for agent services database..."
npx typeorm migration:run -d dist/migrations/main-data-source.migration.js

if [ $? -eq 0 ]; then
  echo "✅ Additive migrations for main database completed successfully!"
else
  echo "❌ Additive migrations for main database failed! Releasing lock and exiting..."
  # psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"
  exit 1
fi

psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"

echo "🏗️ Running additive migrations for agent services vector database..."
psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_VECTOR_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_LOCK_QUERY"

npx typeorm migration:run -d dist/migrations/vector-data-source.migration.js

if [ $? -eq 0 ]; then
  echo "✅ Additive migrations for vector database completed successfully!"
else
  echo "❌ Additive migrations for vector database failed! Releasing lock and exiting..."
  # psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"
  exit 1
fi

psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_VECTOR_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"

# Release advisory lock

echo "🚀 Starting the NestJS service..."

exec npm run start:prod
