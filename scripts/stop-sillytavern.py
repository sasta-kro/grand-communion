"""Stop only the SillyTavern process recorded by this workspace's launcher."""
import os
from pathlib import Path
import signal
import subprocess

root = Path(__file__).resolve().parents[1]
pid_path = root / '.local/sillytavern.pid'
if not pid_path.exists():
    raise SystemExit('No recorded SillyTavern process.')
pid = int(pid_path.read_text().strip())
if pid <= 1:
    raise SystemExit('Invalid recorded process ID.')
command = subprocess.run(['ps', '-p', str(pid), '-o', 'command='],
                         capture_output=True, text=True).stdout.strip()
expected = str(root / 'tools/SillyTavern/server.js')
if expected not in command:
    raise SystemExit('Recorded process is not this SillyTavern instance; no process stopped.')
os.kill(pid, signal.SIGTERM)
print('SillyTavern stop requested.')
