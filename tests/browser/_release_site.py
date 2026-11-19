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

ROOT = Path(__file__).resolve().parents[2]
mimetypes.add_type('application/manifest+json', '.webmanifest')

@contextmanager
def served_site():
    with TemporaryDirectory(prefix='tmt-release-') as tmp:
        host = Path(tmp)
        app = host / 'taiwan-mahjong-trainer'
        shutil.copytree(ROOT, app, ignore=shutil.ignore_patterns(
            '.git', 'node_modules', '__pycache__', '.pytest_cache', '*.png.b64.txt',
        ))
        class Handler(SimpleHTTPRequestHandler):
            def __init__(self, *args, **kwargs):
                super().__init__(*args, directory=str(host), **kwargs)
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
