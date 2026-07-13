'use strict';

const CACHE_NAME = 'sohojtech-shell-v4'; // প্রতিটা নতুন ডিপ্লয়ে এই নম্বর বাড়ান
const NETWORK_TIMEOUT_MS = 3000;

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
      Promise.all(PRECACHE_URLS.map((url) =>
        cache.add(url).catch((err) => console.warn('SW precache failed:', url, err))
      ))
    )
    // ✅ ফিক্স: skipWaiting() এখানে আর শর্তহীনভাবে কল হয় না। নতুন SW
    // "waiting" অবস্থায় থাকবে, পেজ থেকে ইউজারের সম্মতিতে (SKIP_WAITING
    // মেসেজ পেলে) তবেই activate হবে — চলমান বিক্রয়/লেনদেনের মাঝখানে
    // হঠাৎ কোড বদলে যাবে না।
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ✅ ইউজার "এখনই আপডেট করুন" বাটনে ক্লিক করলে app.js থেকে এই মেসেজ আসবে
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ✅ ফিক্স: network আর timeout-এর race — স্লো/স্টল্ড কানেকশনে ৩ সেকেন্ডের
// বেশি অপেক্ষা না করে cache fallback-এ চলে যাবে, UI hang করবে না।
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    Promise.race([
      fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
        }
        return res;
      }),
      new Promise((resolve) =>
        setTimeout(() => caches.match(e.request).then(resolve), NETWORK_TIMEOUT_MS)
      ),
    ]).catch(() => caches.match(e.request))
  );
});
