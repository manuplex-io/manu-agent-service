#!/bin/bash
set -e

echo "Acquiring advisory lock for additive migrations..."
export OB1_DB_PASSWORD_AGENTSERVICE=$(cat /run/secrets/AGENT_SERVICES_OB1_DB_PASSWORD | tr -d '\n')
export ANTHROPIC_API_KEY=$(cat /run/secrets/AGENT_SERVICES_ANTHROPIC_API_KEY)
export OPENAI_API_KEY=$(cat /run/secrets/AGENT_SERVICES_OPENAI_API_KEY)
export PORTKEY_API_KEY=$(cat /run/secrets/AGENT_SERVICES_PORTKEY_API_KEY)
export REDIS_STACK_PASSWORD=$(cat /run/secrets/AGENT_SERVICES_REDIS_STACK_PASSWORD)
export LAMBDA_ROLE_ARN=$(cat /run/secrets/AGENT_SERVICES_LAMBDA_ROLE_ARN)
export AWS_ACCESS_KEY_ID=$(cat /run/secrets/AGENT_SERVICES_AWS_ACCESS_KEY_ID)
export AWS_SECRET_ACCESS_KEY=$(cat /run/secrets/AGENT_SERVICES_AWS_SECRET_ACCESS_KEY)
export PGPASSWORD="$OB1_DB_PASSWORD_AGENTSERVICE"
PG_LOCK_QUERY="SELECT pg_advisory_lock(12345);"
PG_UNLOCK_QUERY="SELECT pg_advisory_unlock(12345);"

# Acquire advisory lock
psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_LOCK_QUERY"

echo "🏗️ Running additive migrations for agent services database..."
npx typeorm migration:run -d dist/migrations/main-data-source.migration.js

if [ $? -eq 0 ]; then
  echo "✅ Additive migrations completed successfully!"
else
  echo "❌ Additive migrations failed! Releasing lock and exiting..."
  psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"
  exit 1
fi

# Release advisory lock
psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"

echo "🏗️ Running additive migrations for agent services vector database..."
psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_VECTOR_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_LOCK_QUERY"
npx typeorm migration:run -d dist/migrations/vector-data-source.migration.js

if [ $? -eq 0 ]; then
  echo "✅ Additive migrations completed successfully!"
else
  echo "❌ Additive migrations failed! Releasing lock and exiting..."
  psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_VECTOR_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"
  exit 1
fi

# Release advisory lock
psql -U "$OB1_DB_USERNAME_AGENTSERVICE" -h "$OB1_VECTOR_DB_HOST" -d "$OB1_DB_DATABASE_AGENTSERVICE" -c "$PG_UNLOCK_QUERY"
echo "🚀 Starting the NestJS service..."

exec npm run start:prod
