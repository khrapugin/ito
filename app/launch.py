"""Open the browser once the loopback server is ready."""
import json
import socket
import threading
import time
import urllib.request
import webbrowser
import uvicorn

URL = 'http://127.0.0.1:8010'

def ready():
    try:
        with urllib.request.urlopen(URL + '/api/state', timeout=1) as response:
            return json.load(response).get('data', {}).get('schema_version') == 5
    except Exception:
        return False

def open_when_ready():
    for _ in range(40):
        if ready():
            webbrowser.open(URL)
            return
        time.sleep(0.25)

if __name__ == '__main__':
    if ready():
        webbrowser.open(URL)
    else:
        with socket.socket() as probe:
            if probe.connect_ex(('127.0.0.1', 8010)) == 0:
                raise SystemExit('Порт 8010 занят другим приложением. Освободите порт и повторите запуск.')
        threading.Thread(target=open_when_ready, daemon=True).start()
        uvicorn.run('app:app', host='127.0.0.1', port=8010, access_log=False)
