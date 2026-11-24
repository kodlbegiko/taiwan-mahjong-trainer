"""Isolated localhost server at a GitHub Pages-style /taiwan-mahjong-trainer/ path.

The fixtures copy source into a temporary directory; update tests never edit checkout.
"""
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import mimetypes
import shutil
import hashlib
import socket
from time import time

ROOT = Path(__file__).resolve().parents[2]
mimetypes.add_type('application/manifest+json', '.webmanifest')

@contextmanager
def served_site(*, fresh_sw=False, faults=None, update_http=None):
    with TemporaryDirectory(prefix='tmt-release-') as tmp:
        host = Path(tmp)
        app = host / 'taiwan-mahjong-trainer'
        shutil.copytree(ROOT, app, ignore=shutil.ignore_patterns(
            '.git', 'node_modules', '__pycache__', '.pytest_cache', '*.png.b64.txt',
        ))
        class Handler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(host), **kwargs)
            def do_GET(self):
                path = self.path.split('?', 1)[0]
                if update_http is not None and path.endswith('/sw.js'):
                    update_http.append({'at': time(), 'path': path,
                                        'swSha256': hashlib.sha256((app/'sw.js').read_bytes()).hexdigest(),
                                        'ifModifiedSince': self.headers.get('If-Modified-Since')})
                if fresh_sw and path.endswith('/sw.js'):
                    # A test deployment may publish several distinct worker scripts
                    # within one second. HTTP-date precision cannot identify them.
                    # Serve actual candidate bytes, not a stale conditional 304.
                    for name in ('If-Modified-Since', 'If-None-Match'):
                        if name in self.headers: del self.headers[name]
                fault = (faults or {}).get(path)
                if fault == 'disconnect':
                    if update_http is not None:
                        update_http.append({'at':time(),'path':path,'fault':fault})
                    self.close_connection = True
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                if fault == 'truncated':
                    if update_http is not None:
                        update_http.append({'at':time(),'path':path,'fault':fault})
                    self.send_response(200)
                    self.send_header('Content-Type','text/css')
                    self.send_header('Content-Length','1000')
                    self.end_headers()
                    self.wfile.write(b'/* incomplete')
                    self.wfile.flush()
                    self.close_connection = True
                    return
                super().do_GET()
            def send_response(self, code, message=None):
                if update_http is not None and self.path.split('?',1)[0].endswith('/sw.js'):
                    update_http.append({'at':time(),'path':self.path,'httpStatus':code})
                super().send_response(code,message)
            def end_headers(self):
                if fresh_sw and self.path.split('?',1)[0].endswith('/sw.js'):
                    self.send_header('Cache-Control','no-store')
                super().end_headers()
            def log_message(self, *_args):
                pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        worker = Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            port = server.server_address[1]
            yield f'http://127.0.0.1:{port}/taiwan-mahjong-trainer/', app
        finally:
            server.shutdown()
            server.server_close()
            worker.join(timeout=5)

def deterministic_uuids(context):
    # Used exclusively for reproducible exercise seeds: no app scoring logic patched.
    context.add_init_script("""
      (() => {
        let serial = 0;
        window.__releaseSeedQueue = [];
        window.__releaseLastId = '';
        Object.defineProperty(Crypto.prototype, 'randomUUID', {
          configurable: true,
          value: () => {
            const seed = window.__releaseSeedQueue.shift() ?? 'release-fallback-' + (++serial);
            window.__releaseLastId = seed;
            return seed;
          },
        });
      })();
    """)

def queue_seed(page, seed):
    page.evaluate('(s) => window.__releaseSeedQueue.push(s)', seed)

def canonical_exercise(page, seed, mode='discard', level='intermediate'):
    return page.evaluate("""async ({seed,mode,level}) => {
      const {createExercise} = await import('./src/training/exercises.js');
      return createExercise({seed,index:0,taskType:mode,level});
    }""", {'seed': seed, 'mode': mode, 'level': level})

def archive(page):
    return page.evaluate("""() => JSON.parse(
      localStorage.getItem('tw-mahjong-trainer:archive:v3'))""")
