#!/usr/bin/env python3
"""Run Physics Lab with Python 3.9+: python3 app.py

Only Python's standard library is required. The browser is the display; all
physics calculations are performed by physics.py on this local Python server.
"""

import argparse
import json
import mimetypes
from pathlib import Path
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from physics import forces, projectile, vectors

ROOT = Path(__file__).resolve().parent
MODELS = {"projectile": projectile, "forces": forces, "vectors": vectors}
ASSETS = {"/": "index.html", "/styles.css": "styles.css", "/lab.js": "lab.js"}


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; "
                         "script-src 'self'; style-src 'self'; "
                         "img-src 'self' data:; connect-src 'self'; "
                         "object-src 'none'; frame-ancestors 'none'")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # A slider change can cancel an obsolete browser request.

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path.startswith("/api/"):
            model = MODELS.get(url.path.removeprefix("/api/"))
            if not model:
                self.reply(404, b'{"error":"Unknown model."}', "application/json")
                return
            try:
                query = {key: values[-1] for key, values in
                         parse_qs(url.query, keep_blank_values=True).items()}
                result = model(query)
                body = json.dumps(result, allow_nan=False).encode()
                self.reply(200, body, "application/json; charset=utf-8")
            except ValueError as error:
                self.reply(400, json.dumps({"error": str(error)}).encode(),
                           "application/json; charset=utf-8")
        elif url.path in ASSETS:
            path = ROOT / ASSETS[url.path]
            content_type = mimetypes.guess_type(str(path))[0] or "text/plain"
            self.reply(200, path.read_bytes(), content_type + "; charset=utf-8")
        elif url.path == "/favicon.ico":
            self.reply(204, b"", "image/x-icon")
        else:
            self.reply(404, b"Not found", "text/plain")

    def log_message(self, _format, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description="Open the interactive Physics Lab.")
    parser.add_argument("--port", type=int, default=8765, help="Local port (default: 8765; 0 chooses a free port).")
    parser.add_argument("--no-browser", action="store_true", help="Print the address without opening a browser.")
    options = parser.parse_args()
    if not 0 <= options.port <= 65535:
        parser.error("--port must be between 0 and 65535")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", options.port), Handler)
    except OSError as error:
        parser.exit(1, f"Could not start Physics Lab: {error}\nTry: python3 app.py --port 0\n")
    address = f"http://127.0.0.1:{server.server_address[1]}"
    print(f"\nPhysics Lab is running at {address}\nKeep this terminal open. Press Ctrl+C to stop.\n", flush=True)
    if not options.no_browser:
        timer = threading.Timer(0.4, webbrowser.open, args=(address,))
        timer.daemon = True
        timer.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nPhysics Lab stopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
