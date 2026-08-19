// Bumping this name retires every older cache on activate.
const CACHE = 'fcstrat-v2';
const SHELL = [
  './', './index.html', './css/app.css', './icon.svg', './manifest.webmanifest',
  './js/app.js', './js/pitch.js', './js/players.js', './js/formations.js', './js/store.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/**
 * Network first, cache only as a fallback. A cache-first shell meant a deploy
 * never reached anyone who had already opened the app; this way the newest
 * code always wins when there is signal, and the cache is what keeps the board
 * working pitch-side when there is none.
 */
async function freshest(request) {
  const cache = await caches.open(CACHE);
  try {
    // `no-store` steps around the browser's own HTTP cache as well.
    const fresh = await fetch(request.url, { cache: 'no-store' });
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const hit = await cache.match(request, { ignoreSearch: true })
      ?? await cache.match('./index.html');
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(freshest(e.request));
});
