#!/bin/sh
set -e

# The SQLite database lives on the mounted volume (DATABASE_URL points there).
# Make sure its directory exists before Prisma touches it.
DB_PATH="${DATABASE_URL#file:}"
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR" 2>/dev/null || true

echo "→ Applying database migrations…"
pnpm exec prisma migrate deploy

echo "→ Seeding users (idempotent)…"
node prisma-dist/seed.js || echo "⚠  Seed failed — check SEED_USER* env vars."

echo "→ Starting Household Ledger on port ${PORT:-3000}…"
exec "$@"
