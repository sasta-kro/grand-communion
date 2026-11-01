#!/usr/bin/env bash
set -euo pipefail
COMMUNION_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$COMMUNION_ROOT/.local"
printf '%s\n' "$$" > "$COMMUNION_ROOT/.local/sillytavern.pid"
cd "$COMMUNION_ROOT/tools/SillyTavern"
export NODE_ENV=production
exec node "$COMMUNION_ROOT/tools/SillyTavern/server.js" "$@"
