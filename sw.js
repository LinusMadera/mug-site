// Caches the app shell and covers. Music is only stored when you download it.
const CACHE = 'egg-mug-shell-v6';
const COVERS = 'egg-mug-covers-v1';
const MAX_COVERS = 400;
const OFFLINE = 'mug-offline-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== OFFLINE && k !== COVERS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// A cover seen once shows instantly from then on, and is refreshed quietly behind it.
async function cover(url) {
  const box = await caches.open(COVERS);
  const hit = await box.match(url.href);
  const fresh = fetch(url.href, { mode: 'cors' }).then(async (res) => {
    if (res.ok) {
      await box.put(url.href, res.clone());
      const keys = await box.keys();
      for (const old of keys.slice(0, Math.max(0, keys.length - MAX_COVERS))) await box.delete(old);
    }
    return res;
  });
  if (hit) {
    fresh.catch(() => undefined);
    return hit;
  }
  return fresh.catch(async () => (await (await caches.open(OFFLINE)).match(url.origin + url.pathname)) || Response.error());
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  if (url.origin !== location.origin) {
    if (/\/Items\/[^/]+\/Images\//.test(url.pathname)) {
      e.respondWith(cover(url));
    }
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
      }
      return res;
    })),
  );
});
