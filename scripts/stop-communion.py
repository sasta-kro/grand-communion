import os
from pathlib import Path
import signal
import shlex
import subprocess
import time

def main():
    root = Path(__file__).resolve().parents[1]
    file = root / ".local/communion.pid"
    if not file.exists():
        print("Communion is not running through the launcher.")
        return
    recorded = file.read_text().strip()
    try:
        pid = int(recorded)
        if pid <= 1:
            raise ValueError
    except ValueError:
        raise SystemExit("Invalid recorded process ID. No process stopped.") from None

    def clear_record():
        # Do not remove a new instance's record during shutdown.
        if file.exists() and file.read_text().strip() == recorded:
            file.unlink()

    command = subprocess.run(
        ["ps", "-p", str(pid), "-o", "command="], capture_output=True, text=True
    ).stdout.strip()
    if not command:
        clear_record()
        print("Communion is already stopped.")
        return
    if "uvicorn backend.app:app" not in command:
        raise SystemExit("Recorded process is not Communion. No process stopped.")
    args = shlex.split(command)
    port = args[args.index("--port") + 1] if "--port" in args else "8010"
    print(f"Stopping Communion on port {port}...")
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        clear_record()
        print("Communion is already stopped.")
        return
    for _ in range(120):
        status = subprocess.run(
            ["ps", "-p", str(pid), "-o", "stat="], capture_output=True, text=True
        ).stdout.strip()
        if not status or status.startswith("Z"):
            clear_record()
            print(f"Communion stopped. Port {port} released.")
            return
        time.sleep(0.1)
    raise SystemExit("Communion is still stopping. Retry before starting another instance.")


if __name__ == "__main__":
    main()
