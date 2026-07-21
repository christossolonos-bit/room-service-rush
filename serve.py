"""Tiny static server for Room Service Rush.

Sends no-cache headers so the browser always loads the latest game files
(prevents the old 3D build from getting stuck in cache).
"""
import http.server
import socketserver

PORT = 5173
HOST = "127.0.0.1"


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), NoCacheHandler) as httpd:
        print(f"Room Service Rush running at http://{HOST}:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass
