// ═══════════════════════════════════════════════════════════
// SERVICE WORKER — Merdi & Bénédicte Fat Loss Apps
// Stratégie : Network First pour HTML/JS, Cache First pour icônes
// ═══════════════════════════════════════════════════════════

const CACHE_NAME = 'fatLoss-v1';
const CACHE_STATIC = 'fatLoss-static-v1';

// Fichiers à mettre en cache immédiatement à l'installation
const STATIC_ASSETS = [
  './merdi_fat_loss_v3_responsive.html',
  './benedicte_fat_loss_v3_responsive.html',
  './icon_merdi_192.png',
  './icon_merdi_512.png',
  './icon_benedicte_192.png',
  './icon_benedicte_512.png',
  './manifest_merdi.json',
  './manifest_benedicte.json'
];

// ── Installation : mise en cache des assets statiques ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Certains assets non mis en cache :', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// ── Activation : supprimer les anciens caches ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME && key !== CACHE_STATIC)
          .map(key => {
            console.log('[SW] Suppression ancien cache :', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ── Fetch : stratégie selon le type de ressource ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ne pas intercepter les requêtes Firestore (toujours réseau)
  if (url.hostname.includes('firestore.googleapis.com') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('fonts.googleapis.com')) {
    return;
  }

  // Icônes et manifests : Cache First
  if (
    event.request.url.match(/\.(png|ico|json)$/) &&
    !event.request.url.includes('firestore')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Fichiers HTML : Network First, fallback cache
  if (event.request.mode === 'navigate' || event.request.url.match(/\.html$/)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then(cached => {
            if (cached) return cached;
            // Fallback générique si hors ligne
            return new Response(
              '<html><body style="font-family:sans-serif;text-align:center;padding:2rem;background:#040508;color:#fff"><h2>📵 Hors ligne</h2><p>Ouvre l\'app quand tu es connecté pour synchroniser tes données.</p></body></html>',
              { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
          });
        })
    );
    return;
  }
});

// ── Message : forcer la mise à jour depuis l'app ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
