#!/bin/sh
set -eu

node /app/scripts/run-migrations.mjs
exec node /app/.output/server/index.mjs