/* =========================================================================
   Service Worker — Taller Gestión de Inventario
   Estrategia:
     - App shell: cache-first (precache en install)
     - CDNs (React, Tailwind, Babel, Lucide): stale-while-revalidate
     - Navegación: network-first con fallback a index.html cacheado (offline)
   ========================================================================= */

const APP_VERSION = 'taller-inventario-v2.0.0';
const SHELL_CACHE = `shell-${APP_VERSION}`;
const RUNTIME_CACHE = `runtime-${APP_VERSION}`;

// Recursos que componen el "app shell" y se precargan al instalar.
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Dominios de CDN que cacheamos en tiempo de ejecución.
const RUNTIME_HOSTS = [
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ---------------------------------------------------------------- install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // addAll falla si UNO falla; usamos individual para tolerancia.
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => null)
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// --------------------------------------------------------------- activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------------ fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Solo manejamos GET.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1) Navegaciones (HTML) → network-first con fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() =>
          caches.match('./index.html').then((cached) => cached || caches.match('./'))
        )
    );
    return;
  }

  // 2) Recursos de CDN conocidos → stale-while-revalidate.
  if (RUNTIME_HOSTS.some((host) => url.hostname.endsWith(host))) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // 3) Mismo origen → cache-first con relleno de runtime.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached);
      })
    );
    return;
  }

  // 4) Resto → intento de red, fallback a cache si existe.
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// --------------------------------------------------- helper: SWR strategy
function staleWhileRevalidate(request) {
  return caches.open(RUNTIME_CACHE).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
}

// Permite que la app fuerce la activación del SW nuevo.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
