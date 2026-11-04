#!/usr/bin/env bash
set -euo pipefail
COMMUNION_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$COMMUNION_ROOT"

COMMUNION_SELECTED_PORT="${COMMUNION_PORT:-8010}"
COMMUNION_PORT_GIVEN=false
COMMUNION_UVICORN_ARGS=()
if [[ "${1:-}" != -* && $# -gt 0 ]]; then
  COMMUNION_SELECTED_PORT="$1"
  COMMUNION_PORT_GIVEN=true
  shift
fi
while [ $# -gt 0 ]; do
  case "$1" in
    --port|--port=*)
      if [ "$COMMUNION_PORT_GIVEN" = true ]; then
        echo "Pass the port only once." >&2
        exit 2
      fi
      if [ "$1" = --port ]; then
        if [ $# -lt 2 ]; then
          echo "--port requires a number." >&2
          exit 2
        fi
        COMMUNION_SELECTED_PORT="$2"
        shift
      else
        COMMUNION_SELECTED_PORT="${1#--port=}"
      fi
      COMMUNION_PORT_GIVEN=true
      ;;
    -h|--help)
      echo "Usage: ./scripts/start-communion.sh [PORT] [uvicorn options]"
      echo "       ./scripts/start-communion.sh --port PORT [uvicorn options]"
      echo "Default port: 8010 (or COMMUNION_PORT when set)."
      exit 0
      ;;
    *) COMMUNION_UVICORN_ARGS+=("$1") ;;
  esac
  shift
done
if [[ ! "$COMMUNION_SELECTED_PORT" =~ ^[0-9]{1,5}$ ]] ||
   (( 10#$COMMUNION_SELECTED_PORT < 1 || 10#$COMMUNION_SELECTED_PORT > 65535 )); then
  echo "Port must be an integer between 1 and 65535." >&2
  exit 2
fi
COMMUNION_SELECTED_PORT="$((10#$COMMUNION_SELECTED_PORT))"

if [ ! -x .venv/bin/python ]; then
  echo "Create the Python environment first. See README.md."
  exit 1
fi
if [ ! -f frontend/dist/index.html ]; then
  echo "Build the interface first: npm --prefix frontend run build"
  exit 1
fi
mkdir -p .local
# Keep the current instance discoverable if a second launch is attempted.
if [ -f .local/communion.pid ]; then
  COMMUNION_EXISTING_PID="$(cat .local/communion.pid)"
  if [[ "$COMMUNION_EXISTING_PID" =~ ^[0-9]+$ ]] &&
     ps -p "$COMMUNION_EXISTING_PID" -o command= 2>/dev/null | grep -q 'uvicorn backend.app:app'; then
    echo "Communion is already running. Stop it before starting another instance." >&2
    exit 1
  fi
fi
printf '%s\n' "$$" > .local/communion.pid
echo "Starting Communion at http://127.0.0.1:$COMMUNION_SELECTED_PORT"
echo "Press Ctrl-C to stop, or run python3 scripts/stop-communion.py from another terminal."
# macOS Bash 3.2 treats an empty array as unset under nounset.
if [ "${#COMMUNION_UVICORN_ARGS[@]}" -gt 0 ]; then
  set -- "${COMMUNION_UVICORN_ARGS[@]}"
else
  set --
fi
exec .venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port "$COMMUNION_SELECTED_PORT" --timeout-graceful-shutdown 5 "$@"
