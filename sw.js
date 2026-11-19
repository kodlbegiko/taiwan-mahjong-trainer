/* Offline-first, atomic shell for GitHub Pages root or /repo/ deployments.
 * IMPORTANT: change CACHE_VERSION whenever any precached file changes.
 * The install event only succeeds if the entire listed release is cached. */
const CACHE_VERSION = 'tmt-v02-training-ui-20261119-r1';
const SHELL_CACHE = `tmt-shell-${CACHE_VERSION}`;
const BASE = new URL('./', self.location.href);
const SHELL = [
  './', './index.html', './style.css', './sw.js',
  './public/manifest.webmanifest', './public/icons/icon.svg',
  './public/icons/icon-180.png', './public/icons/icon-192.png', './public/icons/icon-512.png',
  './src/app.js', './src/tiles.js', './src/practice.js', './src/shanten.js',
  './src/core/efficiency.js', './src/analysis/explain.js',
  './src/training/exercises.js', './src/training/waits.js',
  './src/training/random.js', './src/training/records.js',
  './src/training/progress.js', './src/storage/local.js', './src/storage/archive.js',
].map(path => new URL(path, BASE).href);
const SHELL_PATHS = new Set(SHELL.map(url => new URL(url).pathname));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Bypass the HTTP cache, ensuring the new release never reuses old JS bytes.
    await Promise.all(SHELL.map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error(`Precache failed: ${url} ${response.status}`);
      await cache.put(url, response);
    }));
    // Do not force skipWaiting for updates. Let open sessions finish on one
    // coherent release and prompt before activation.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('tmt-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  // HTML fallback for the application URL, never a cross-origin or API response.
  const requestedPath = url.pathname === BASE.pathname ? BASE.pathname : url.pathname;
  if (!SHELL_PATHS.has(requestedPath) && event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const cache = await caches.open(SHELL_CACHE);
    const canonical = event.request.mode === 'navigate'
      ? new URL('./index.html', BASE).href
      : new URL(url.pathname, url.origin).href;
    const cached = await cache.match(canonical);
    if (cached) return cached;
    // During the initial install and for unexpected URLs, allow an ordinary
    // network load. Do not silently fabricate or cache unverified module code.
    return fetch(event.request);
  })());
});
