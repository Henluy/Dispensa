// Nom et version du cache (mets à jour si tu changes des fichiers importants)
const CACHE_NAME = 'stockristorante-v1.0.0';

const ASSETS = [
  '/', // racine
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-192-72.png',
  '/assets/icon-192-144.png',
  '/assets/icon-512.png',
  '/assets/icon-512-72.png',
  '/assets/icon-512-144.png',
  '/assets/icon-512-256.png'
  // ajoute ici d'autres fichiers nécessaires (ex: favicon, fonts)
];

// Install event: cache l'app shell
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching assets...');
      return cache.addAll(ASSETS);
    })
  );
});

// Activate event: nettoyage des vieux caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Suppression du vieux cache:', key);
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch event: cache-first pour l'app, network-first pour API cloud
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first pour Supabase ou autres APIs cloud
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then(res => res)
        .catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first pour les assets/app shell
  event.respondWith(
    caches.match(req).then(response =>
      response ||
      fetch(req).then(res => {
        // Optionnel: ajoute dynamiquement les nouvelles ressources au cache
        if (res.status === 200 && req.method === 'GET' && req.url.startsWith(self.location.origin)) {
          caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        }
        return res;
      }).catch(() => {
        // Optionnel: fallback HTML (offline.html) si tu veux une page d’erreur personnalisée
        // return caches.match('/offline.html');
      })
    )
  );
});

// (Optionnel) Message SW <-> app pour forcer update
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    console.log('[SW] Aggiornamento forzato!');
  }
});
