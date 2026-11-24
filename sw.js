/* Offline-first, atomic shell for GitHub Pages root or /repo/ deployments.
 * IMPORTANT: change CACHE_VERSION whenever any precached file changes.
 * The install event only succeeds if the entire listed release is cached. */
const CACHE_VERSION = 'tmt-v02-realistic-tiles-master-academy-phase3-r7-mobile-pwa-a11y-20261124-r7.3-transaction';
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
  './src/academy-ui/academy.css', './src/table-ui/table.css',
  // BEGIN GENERATED RUNTIME JS (node scripts/runtime-precache.mjs --write)
  './src/academy-ui/academy-bridge.js',
  './src/academy-ui/academy-live.js',
  './src/academy-ui/main.js',
  './src/academy-ui/public-facade.js',
  './src/academy-ui/scenario.js',
  './src/academy/catalog.js',
  './src/academy/index.js',
  './src/academy/lessons.js',
  './src/academy/provenance.js',
  './src/academy/question-internal.js',
  './src/academy/questions.js',
  './src/academy/records.js',
  './src/academy/registry.js',
  './src/academy/scenario-scorers.js',
  './src/adaptive/ability.js',
  './src/adaptive/core.js',
  './src/adaptive/daily-training.js',
  './src/adaptive/index.js',
  './src/adaptive/learning-adapter.js',
  './src/adaptive/provenance.js',
  './src/adaptive/records.js',
  './src/adaptive/review.js',
  './src/adaptive/session.js',
  './src/adaptive/storage.js',
  './src/adaptive/validate.js',
  './src/analysis/explain.js',
  './src/app.js',
  './src/bots/controller.js',
  './src/bots/decision.js',
  './src/bots/index.js',
  './src/bots/view.js',
  './src/core/efficiency.js',
  './src/integration/master-academy-facade.js',
  './src/integration/phase3-public-facade.js',
  './src/practice.js',
  './src/replay/index.js',
  './src/replay/internal.js',
  './src/rules/complete-engine.js',
  './src/rules/engine.js',
  './src/rules/index.js',
  './src/rules/profiles.js',
  './src/rules/scoring.js',
  './src/rules/tile-constants.js',
  './src/rules/tile-identity.js',
  './src/scenario/index.js',
  './src/shanten.js',
  './src/storage/archive.js',
  './src/storage/local.js',
  './src/strategy/index.js',
  './src/strategy/simulate.js',
  './src/strategy/structure.js',
  './src/strategy/view.js',
  './src/table-ui/a11y.js',
  './src/table-ui/daily.js',
  './src/table-ui/full-round.js',
  './src/table-ui/main.js',
  './src/table-ui/session.js',
  './src/table-ui/view.js',
  './src/tile-visuals.js',
  './src/tiles.js',
  './src/training/exercises.js',
  './src/training/progress.js',
  './src/training/random.js',
  './src/training/records.js',
  './src/training/waits.js',
  // END GENERATED RUNTIME JS
  './data/academy/manifest-v1.json',
].map(path => new URL(path, BASE).href);
const SHELL_PATHS = new Set(SHELL.map(url => new URL(url).pathname));

// No writes before *all* required network responses are verified. Bounded
// batches avoid flooding small HTTP servers and keep failed fetches isolated.
async function fetchRelease() {
  const responses = [];
  for (let start = 0; start < SHELL.length; start += 8) {
    const batch = await Promise.allSettled(SHELL.slice(start, start + 8).map(async url => {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok) throw new Error('Precache failed: ' + url + ' ' + response.status);
      if (response.type === 'opaque' || response.status !== 200 || response.redirected)
        throw new Error('Invalid full response: ' + url);
      // Consume a clone before publishing any candidate cache. A truncated
      // transfer rejects here rather than during a later cache write.
      if (!(await response.clone().arrayBuffer()).byteLength)
        throw new Error('Empty asset: ' + url);
      return [url, response];
    }));
    const failed = batch.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    responses.push(...batch.map(result => result.value));
  }
  return responses;
}
async function verifyRelease() {
  if (!(await caches.has(SHELL_CACHE))) throw new Error('Release cache absent');
  const cache = await caches.open(SHELL_CACHE);
  const keys = new Set((await cache.keys()).map(request => request.url));
  if (keys.size !== SHELL.length || SHELL.some(url => !keys.has(url)))
    throw new Error('Incomplete release shell');
  return cache;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    let ownsCandidate = false;
    try {
      // A reused version could belong to the active or waiting worker. Never
      // mutate/delete it; publish a different content-versioned script instead.
      if (await caches.has(SHELL_CACHE)) throw new Error('Release cache version already exists');
      const responses = await fetchRelease();
      if (await caches.has(SHELL_CACHE)) throw new Error('Release cache version already exists');
      ownsCandidate = true;
      const cache = await caches.open(SHELL_CACHE);
      // Serialize writes: no outstanding put can race rollback. All failure
      // paths, including open/keys/put errors, share the same awaited cleanup.
      for (const [url, response] of responses) await cache.put(url, response);
      await verifyRelease();
      console.info('[tmt-sw] install committed', SHELL_CACHE, SHELL.length);
    } catch (error) {
      if (ownsCandidate) {
        await caches.delete(SHELL_CACHE);
        if (await caches.has(SHELL_CACHE)) throw new Error('Candidate rollback failed', { cause: error });
      }
      console.warn('[tmt-sw] install rejected', SHELL_CACHE, String(error));
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await verifyRelease();
    // Only remove older shell caches containing this registration's index.
    // A different app/scope on this origin may have its own valid shell.
    const index = new URL('./index.html', BASE).href;
    for (const key of await caches.keys()) {
      if (key.startsWith('tmt-shell-') && key !== SHELL_CACHE &&
          await caches.match(index, { cacheName: key })) {
        try { await caches.delete(key); }
        catch (error) { console.warn('[tmt-sw] retired cache cleanup failed', key, String(error)); }
      }
    }
    await self.clients.claim();
    console.info('[tmt-sw] activated', SHELL_CACHE);
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil((async () => {
      await verifyRelease();
      await self.skipWaiting();
    })());
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== BASE.origin || !url.pathname.startsWith(BASE.pathname)) return;
  // HTML fallback for the application URL, never a cross-origin or API response.
  const requestedPath = url.pathname === BASE.pathname ? BASE.pathname : url.pathname;
  const runtimeModule = requestedPath.startsWith(new URL('./src/', BASE).pathname) &&
    /\.(?:m?js|css)$/.test(requestedPath);
  if (!SHELL_PATHS.has(requestedPath) && !runtimeModule && event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const canonical = event.request.mode === 'navigate'
      ? new URL('./index.html', BASE).href
      : new URL(url.pathname, url.origin).href;
    const cached = await caches.match(canonical, { cacheName: SHELL_CACHE });
    if (cached) return cached;
    // A controlled client must never mix older HTML with a newer uncached JS/CSS
    // byte. Cache corruption or an incomplete deploy fails closed instead.
    if (SHELL_PATHS.has(requestedPath) || runtimeModule || event.request.mode === 'navigate') {
      return Response.error();
    }
    return fetch(event.request);
  })());
});
