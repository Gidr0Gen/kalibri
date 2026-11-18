// Kalibri service worker: precache the app shell, network-first with cache fallback
// (always fresh when online, fully working offline). Bump CACHE when adding shell files.
const CACHE = 'kalibri-shell-v5';
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './src/main.js', './src/styles/tokens.css', './src/styles/app.css',
  './src/lib/util.js', './src/lib/storage.js', './src/lib/estimator.js', './src/lib/nutrition.js', './src/lib/router.js', './src/lib/ui.js', './src/lib/icons.js', './src/lib/analytics.js',
  './src/screens/today.js', './src/screens/scanner.js', './src/screens/progress.js', './src/screens/profile.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-512-maskable.png', './icons/apple-touch-icon.png', './icons/favicon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return cache.match('./index.html');
      return Response.error();
    }
  })());
});
