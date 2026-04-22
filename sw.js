// ====================================================
//  ClassManager Pro — Service Worker
//  גרסה: 1.0.0
// ====================================================

const CACHE_NAME = 'classmanager-v1';
const STATIC_CACHE = 'classmanager-static-v1';

// קבצים לשמירה במטמון (עובדים אופליין)
const STATIC_ASSETS = [
  './',
  './index.html',
  './script.js',
  './manifest.json'
];

// CDN resources to cache on first use
const CDN_HOSTS = [
  'cdn.tailwindcss.com',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ── INSTALL: cache static assets ──
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Some assets failed to cache:', err);
      });
    }).then(() => {
      console.log('[SW] Static assets cached');
      return self.skipWaiting(); // activate immediately
    })
  );
});

// ── ACTIVATE: clean old caches ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== STATIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── FETCH: serve from cache, fallback to network ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip OpenAI API calls — always network
  if (url.hostname === 'api.openai.com') return;

  // Skip chrome-extension and other non-http
  if (!url.protocol.startsWith('http')) return;

  // CDN resources: cache-first (they rarely change)
  if (CDN_HOSTS.some(host => url.hostname.includes(host))) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  // Local assets: network-first with cache fallback
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(event.request));
    return;
  }
});

// ── STRATEGIES ──

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return offline page if index.html is requested
    if (request.destination === 'document') {
      return caches.match('./index.html');
    }
    return new Response('', { status: 408, statusText: 'Offline' });
  }
}

// ── MESSAGE: force update ──
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
