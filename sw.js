/* THRIVE v6 — Service Worker
   Network-first for JS/CSS/HTML to ensure code updates reach mobile browsers immediately.
   Cache-first only for static assets (images, fonts, icons).
*/
const CACHE_NAME = 'thrive-v16';

// Static assets that rarely change — cache-first is fine for these
const STATIC_ASSETS = [
    '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
    self.skipWaiting(); // Activate immediately, don't wait for old tabs to close
});

self.addEventListener('activate', (e) => {
    // Purge ALL old caches (v2, v3, v4, etc.)
    e.waitUntil(caches.keys().then(keys =>
        Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ));
    self.clients.claim(); // Take control of all open tabs immediately
});

self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;

    const url = new URL(e.request.url);

    // API calls — NEVER cache, always go to network
    if (url.pathname.startsWith('/api/')) return;

    // JS, CSS, HTML files — NETWORK-FIRST strategy
    // Always try to get the latest version from server.
    // Only fall back to cache if offline.
    if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.html') || url.pathname === '/') {
        e.respondWith(
            fetch(e.request).then(response => {
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline — serve from cache
                return caches.match(e.request).then(cached => {
                    if (cached) return cached;
                    if (e.request.mode === 'navigate') return caches.match('/index.html');
                });
            })
        );
        return;
    }

    // Everything else (images, fonts, icons) — CACHE-FIRST for speed
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(r => {
                if (r.status === 200) {
                    const c = r.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, c));
                }
                return r;
            }).catch(() => {
                if (e.request.mode === 'navigate') return caches.match('/index.html');
            });
        })
    );
});

self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(self.clients.matchAll({ type: 'window' }).then(c => {
        if (c.length > 0) return c[0].focus();
        else return self.clients.openWindow('/');
    }));
});

self.addEventListener('push', function(event) {
    let payload = { title: "Thrive Reminder", body: "Check your tasks and finances!" };
    if (event.data) {
        try { payload = event.data.json(); } catch(e) { payload.body = event.data.text(); }
    }
    const options = {
        body: payload.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        vibrate: [200, 100, 200]
    };
    event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-thrive-data') {
        event.waitUntil(Promise.resolve());
    }
});
