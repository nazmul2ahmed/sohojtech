'use strict';

// ════════════════════════════════════════════════════════════
// SERVICE WORKER — app-shell cache (install-ability + offline load)
// Firestore ডেটা-সিঙ্ক এখানে হ্যান্ডেল হয় না — সেটা enablePersistence()
// নিজেই সামলায়। এই SW শুধু static file (HTML/CSS/JS/icons) cache করে।
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'sohojtech-shell-v1'; // ভবিষ্যতে ফাইল বদলালে ভার্সন বাড়ান (v2, v3...)

const PRECACHE_URLS = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/config.js', './js/utils.js', './js/state.js', './js/ui-components.js',
  './js/modules/dashboard.js', './js/modules/pos.js', './js/modules/purchase.js',
  './js/modules/returns.js', './js/modules/opening.js', './js/modules/inventory.js',
  './js/modules/medicine.js', './js/modules/customers.js', './js/modules/suppliers.js',
  './js/modules/accounts.js', './js/modules/settings.js', './js/modules/admin.js',
  './js/auth.js', './js/api-client.js', './js/app.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// শুধু same-origin GET রিকোয়েস্ট cache করি — Firebase/Firestore-এর নিজস্ব
// ডোমেইনে (googleapis.com ইত্যাদি) কিছুই ছুঁই না, ওটা SDK নিজে সামলায়
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});