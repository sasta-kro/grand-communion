#!/usr/bin/env bash
set -euo pipefail
COMMUNION_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$COMMUNION_ROOT"
mkdir -p .local
printf '%s\n' "$$" > .local/communion.pid
if [ ! -x .venv/bin/python ]; then
  echo "Create the Python environment first. See README.md."
  exit 1
fi
if [ ! -f frontend/dist/index.html ]; then
  echo "Build the interface first: npm --prefix frontend run build"
  exit 1
fi
exec .venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port "${COMMUNION_PORT:-8010}" --timeout-graceful-shutdown 5 "$@"
