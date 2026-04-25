// PAUSE App — Service Worker v3
// FIX 2: Proper offline support — cache-first with network fallback

const CACHE_NAME = 'pause-app-v3';

// All files to pre-cache at install time
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
  '/data.js',
  '/state.js',
  '/badges.js',
  '/notifications.js',
  '/assessment.js',
  '/results.js',
  '/progress.js',
  '/share.js',
  '/logbook.js',
  '/motivation.js',
  '/weekly.js',
  '/cbt.js',
  '/screentime.js',
  '/app.js',
  '/nav.js',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png'
];

// ─── INSTALL ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Add all assets; individual failures won't break install
      return Promise.allSettled(
        PRECACHE_ASSETS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Could not cache:', url, err);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;

  // Only handle GET requests on our own origin
  if (req.method !== 'GET') return;
  if (!req.url.startsWith(self.location.origin)) return;

  // Skip Supabase, Google APIs, and external CDNs — let them go to network
  const skipPatterns = [
    'supabase.co',
    'googleapis.com',
    'accounts.google.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.jsdelivr.net'
  ];
  if (skipPatterns.some(p => req.url.includes(p))) return;

  event.respondWith(
    caches.match(req).then(cached => {
      // Return cached version immediately if available
      if (cached) {
        // Refresh cache in background (stale-while-revalidate)
        fetch(req).then(fresh => {
          if (fresh && fresh.ok) {
            caches.open(CACHE_NAME).then(c => c.put(req, fresh));
          }
        }).catch(() => {});
        return cached;
      }

      // Not in cache — try network
      return fetch(req).then(response => {
        if (!response || !response.ok) return response;
        // Cache successful responses
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
        return response;
      }).catch(() => {
        // Network failed and nothing cached — return index.html (SPA fallback)
        console.warn('[SW] Offline, serving fallback for:', req.url);
        return caches.match('/index.html');
      });
    })
  );
});

// ─── BACKGROUND SYNC (for Supabase syncing when back online) ────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-assessments') {
    console.log('[SW] Background sync triggered');
    // The app's state.js handles the actual sync when back online
  }
});
