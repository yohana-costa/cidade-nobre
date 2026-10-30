#!/bin/sh
set -eu

echo "[api] aplicando migrations..."
npx prisma migrate deploy

echo "[api] iniciando..."
exec node build/backend/src/server.js
