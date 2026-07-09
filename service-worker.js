'use strict';

const CACHE_NAME = 'sohojtech-shell-v3'; // ভার্সন বাড়ানো — নতুন strategy কার্যকর করতে

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
    caches.open(CACHE_NAME).then((cache) =>
      // ✅ ফিক্স: addAll() এর বদলে একে একে — একটা ফাইল 404 হলেও বাকিগুলো cache হবে
      Promise.all(PRECACHE_URLS.map((url) =>
        cache.add(url).catch((err) => console.warn('SW precache failed:', url, err))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ✅ Network-First: অনলাইনে সবসময় সর্বশেষ ফাইল, অফলাইনে cache fallback
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
