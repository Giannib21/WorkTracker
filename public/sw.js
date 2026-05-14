/**
 * Service worker minimale: nessuna cache aggressiva (ogni richiesta va in rete).
 * Serve ai criteri di installazione PWA di Chrome (manifest + SW attivo).
 */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
