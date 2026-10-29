const CACHE_NAME = 'coolace-shell-v1';
const OFFLINE_URL = '/offline.html';
const SHELL_URL = '/';
const BUILD_ASSETS = [];
const PRECACHE_URLS = [
  SHELL_URL,
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  ...BUILD_ASSETS,
];
const STATIC_FILE = /\.(?:avif|css|gif|ico|jpe?g|js|mjs|png|svg|webp|woff2?|ttf|otf)$/i;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_URLS.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' });
        if (response.ok && response.type === 'basic') await cache.put(url, response);
      } catch {
        if (url === OFFLINE_URL) throw new Error('No se pudo preparar la pantalla sin conexión.');
      }
    }));

    const shell = await cache.match(SHELL_URL);
    if (shell) {
      const html = await shell.text();
      const assetPaths = [...html.matchAll(/(?:src|href)="([^"]+\.(?:css|js|mjs|woff2?|ttf|otf))"/gi)]
        .map((match) => match[1]);
      await Promise.all(assetPaths.map(async (path) => {
        try {
          const assetUrl = new URL(path, self.location.origin);
          if (assetUrl.origin !== self.location.origin) return;
          const response = await fetch(assetUrl, { cache: 'reload' });
          if (response.ok && response.type === 'basic') await cache.put(assetUrl, response);
        } catch {
          // A failed optional asset must not prevent the offline shell from installing.
        }
      }));
    }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames
      .filter((name) => name.startsWith('coolace-shell-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (/\/(?:rest|auth|storage|functions|graphql)(?:\/|$)/i.test(url.pathname)) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(SHELL_URL, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(SHELL_URL) || await cache.match(OFFLINE_URL);
      }
    })());
    return;
  }

  if (!STATIC_FILE.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(url.pathname, { ignoreSearch: true, ignoreVary: true });
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
