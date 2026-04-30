// PAUSE App — Service Worker v3
// FIX 2: Proper offline support — cache-first with network fallback

const CACHE_NAME = 'pause-app-v10-aurora';

// All files to pre-cache at install time
// NH2 FIX: derive base path from SW location so caching works on any subdirectory.
// On GitHub Pages at jaideeprao22.github.io/Pause-App/, BASE = '/Pause-App/'
const BASE = self.location.pathname.replace(/sw\.js$/, '');

const PRECACHE_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'terms.html',
  BASE + 'style.css',
  BASE + 'manifest.json',
  BASE + 'data.js',
  BASE + 'state.js',
  BASE + 'badges.js',
  BASE + 'notifications.js',
  BASE + 'assessment.js',
  BASE + 'results.js',
  BASE + 'progress.js',
  BASE + 'share.js',
  BASE + 'logbook.js',
  BASE + 'motivation.js',
  BASE + 'weekly.js',
  BASE + 'cbt.js',
  BASE + 'screentime.js',
  BASE + 'app.js',
  BASE + 'nav.js',
  BASE + 'icons/icon-72.png',
  BASE + 'icons/icon-96.png',
  BASE + 'icons/icon-128.png',
  BASE + 'icons/icon-144.png',
  BASE + 'icons/icon-152.png',
  BASE + 'icons/icon-192.png',
  BASE + 'icons/icon-384.png',
  BASE + 'icons/icon-512.png'
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
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'  // Bug B FIX: Tone.js CDN — don't intercept external libraries
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
        return caches.match(BASE + 'index.html');
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
