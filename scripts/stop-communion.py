import os
from pathlib import Path
import signal
import subprocess
import time

root = Path(__file__).resolve().parents[1]
file = root / '.local/communion.pid'
if not file.exists():
    raise SystemExit('No recorded Communion process.')
pid = int(file.read_text().strip())
if pid <= 1:
    raise SystemExit('Invalid process ID.')
command = subprocess.run(['ps','-p',str(pid),'-o','command='],capture_output=True,text=True).stdout
if 'uvicorn backend.app:app' not in command:
    raise SystemExit('Recorded process is not Communion; no process stopped.')
os.kill(pid,signal.SIGTERM)
for _ in range(120):
    status=subprocess.run(['ps','-p',str(pid),'-o','stat='],capture_output=True,text=True).stdout.strip()
    if not status or status.startswith('Z'):
        print('Communion stopped.')
        break
    time.sleep(.1)
else:
    raise SystemExit('Communion is still stopping. Close connected browser tabs and retry before starting another instance.')
