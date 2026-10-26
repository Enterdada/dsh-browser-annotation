"""Dev-only fixture server for the dsh-browser-annotation acceptance run.

Serves dev/fixture over http://127.0.0.1:8123 and appends every /__probe
request to dev/report.log. The probe is used only by the temporary dev gate
inside client.js and is removed from the delivered plugin.
"""

from __future__ import annotations

import datetime
import http.server
import os
import socketserver

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "fixture")
LOG = os.path.join(HERE, "report.log")
PORT = 8123


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):  # noqa: N802 (stdlib naming)
        if self.path.startswith("/__probe"):
            stamp = datetime.datetime.now().isoformat(timespec="milliseconds")
            with open(LOG, "a", encoding="utf-8") as handle:
                handle.write(stamp + " " + self.path + "\n")
            body = b"ok"
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, fmt, *args):  # keep the console quiet
        pass


class ReusableServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    os.makedirs(ROOT, exist_ok=True)
    with ReusableServer(("127.0.0.1", PORT), Handler) as httpd:
        print(f"fixture server: http://127.0.0.1:{PORT}/", flush=True)
        print(f"probe log: {LOG}", flush=True)
        httpd.serve_forever()
