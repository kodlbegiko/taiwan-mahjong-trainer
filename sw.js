/* Offline-first, atomic shell for GitHub Pages root or /repo/ deployments.
 * IMPORTANT: change CACHE_VERSION whenever any precached file changes.
 * The install event only succeeds if the entire listed release is cached. */
const CACHE_VERSION = 'tmt-v02-realistic-tiles-master-academy-phase3-integrated-daily-20261120-r3';
const SHELL_CACHE = `tmt-shell-${CACHE_VERSION}`;
const BASE = new URL('./', self.location.href);
const SHELL = [
  './', './index.html', './style.css', './sw.js',
  './public/manifest.webmanifest', './public/icons/icon.svg',
  './public/icons/icon-180.png', './public/icons/icon-192.png', './public/icons/icon-512.png',
  './public/tiles/0.svg',
  './public/tiles/1.svg',
  './public/tiles/2.svg',
  './public/tiles/3.svg',
  './public/tiles/4.svg',
  './public/tiles/5.svg',
  './public/tiles/6.svg',
  './public/tiles/7.svg',
  './public/tiles/8.svg',
  './public/tiles/9.svg',
  './public/tiles/10.svg',
  './public/tiles/11.svg',
  './public/tiles/12.svg',
  './public/tiles/13.svg',
  './public/tiles/14.svg',
  './public/tiles/15.svg',
  './public/tiles/16.svg',
  './public/tiles/17.svg',
  './public/tiles/18.svg',
  './public/tiles/19.svg',
  './public/tiles/20.svg',
  './public/tiles/21.svg',
  './public/tiles/22.svg',
  './public/tiles/23.svg',
  './public/tiles/24.svg',
  './public/tiles/25.svg',
  './public/tiles/26.svg',
  './public/tiles/27.svg',
  './public/tiles/28.svg',
  './public/tiles/29.svg',
  './public/tiles/30.svg',
  './public/tiles/31.svg',
  './public/tiles/32.svg',
  './public/tiles/33.svg',
  './src/tile-visuals.js', './src/app.js', './src/tiles.js', './src/practice.js', './src/shanten.js',
  './src/academy-ui/main.js', './src/academy-ui/academy.css',
  './src/table-ui/main.js', './src/table-ui/session.js',
  './src/table-ui/view.js', './src/table-ui/table.css',
  './src/academy-ui/public-facade.js', './src/academy-ui/scenario.js',
  './src/academy-ui/academy-bridge.js', './src/academy-ui/academy-live.js',
  './src/core/efficiency.js', './src/analysis/explain.js',
  './src/training/exercises.js', './src/training/waits.js',
  './src/training/random.js', './src/training/records.js',
  './src/training/progress.js', './src/storage/local.js', './src/storage/archive.js',
  // Actual combined Master Academy runtime graph (no fixture-only provider).
  './src/integration/master-academy-facade.js',
  './src/academy/index.js',
  './src/academy/catalog.js',
  './src/academy/lessons.js',
  './src/academy/question-internal.js',
  './src/academy/questions.js',
  './src/academy/records.js',
  './src/academy/registry.js',
  './src/academy/scenario-scorers.js',
  './src/academy/provenance.js',
  './src/adaptive/index.js',
  './src/adaptive/core.js',
  './src/adaptive/records.js',
  './src/adaptive/ability.js',
  './src/adaptive/review.js',
  './src/adaptive/session.js',
  './src/adaptive/storage.js',
  './src/adaptive/validate.js',
  './src/adaptive/learning-adapter.js', './src/adaptive/daily-training.js',
  './src/adaptive/provenance.js',
  './src/rules/index.js',
  './src/rules/tile-constants.js',
  './src/rules/tile-identity.js',
  './src/rules/profiles.js',
  './src/rules/engine.js',
  './src/strategy/index.js',
  './src/strategy/view.js',
  './src/strategy/structure.js',
  './src/strategy/simulate.js',
  // Phase 3 staged runtime dependencies; experimental-only, NOT full game.
  './src/rules/complete-engine.js', './src/rules/scoring.js',
  './src/bots/index.js', './src/bots/decision.js', './src/bots/controller.js',
  './src/replay/index.js', './src/replay/internal.js', './src/scenario/index.js',
  './data/academy/manifest-v1.json',
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
