"""Petite base partagée entre les « téléphones » du test (contextes de navigateur séparés)."""
import json, threading
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
ETAT = {"db": None, "evt": []}
VERROU = threading.Lock()
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def entetes(self, code=200):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,PUT,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "content-type")
        self.send_header("Content-Type", "application/json")
        self.end_headers()
    def do_OPTIONS(self): self.entetes()
    def do_GET(self):
        with VERROU:
            if self.path.startswith("/db"): corps = json.dumps(ETAT["db"])
            elif self.path.startswith("/evt"):
                n = int(self.path.split("=")[1]); corps = json.dumps({"n": len(ETAT["evt"]), "e": ETAT["evt"][n:]})
            else: corps = "null"
        self.entetes(); self.wfile.write(corps.encode())
    def do_PUT(self):
        l = int(self.headers.get("Content-Length", 0)); c = json.loads(self.rfile.read(l) or b"null")
        with VERROU:
            ETAT["db"] = c["db"]
            if c.get("evt"): ETAT["evt"].extend(c["evt"])
        self.entetes(); self.wfile.write(b"{}")
ThreadingHTTPServer(("127.0.0.1", 8766), H).serve_forever()
