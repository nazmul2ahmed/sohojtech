'use strict';

const CACHE_NAME = 'sohojtech-shell-v5'; // প্রতিটা নতুন ডিপ্লয়ে এই নম্বর বাড়ান
const NETWORK_TIMEOUT_MS = 3000;

// ══════════════════════════════════════════════════════════
// APP SHELL — এই ফাইলগুলো Cache-First স্ট্র্যাটেজিতে সার্ভ হবে
// (analytics.js যোগ করা হলো — আগে ভুলে বাদ ছিল)
// ══════════════════════════════════════════════════════════
const PRECACHE_URLS = [
  './', './index.html', './manifest.json', './css/styles.css',
  './js/config.js', './js/utils.js', './js/state.js', './js/ui-components.js',
  './js/modules/dashboard.js', './js/modules/pos.js', './js/modules/purchase.js',
  './js/modules/returns.js', './js/modules/opening.js', './js/modules/inventory.js',
  './js/modules/medicine.js', './js/modules/customers.js', './js/modules/suppliers.js',
  './js/modules/accounts.js', './js/modules/settings.js', './js/modules/admin.js',
  './js/auth.js', './js/api-client.js', './js/modules/analytics.js', './js/app.js',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
];

// দ্রুত lookup-এর জন্য pathname-ভিত্তিক Set — fetch হ্যান্ডলারে cache-first
// বনাম network-first সিদ্ধান্ত নিতে ব্যবহৃত হবে
const SHELL_PATHS = new Set(
  PRECACHE_URLS
    .filter((u) => u !== './')
    .map((u) => new URL(u, self.location.origin).pathname)
);

// ══════════════════════════════════════════════════════════
// INSTALL — precache করবে, skipWaiting() শর্তহীন কল করবে না।
// নতুন SW "waiting" অবস্থায় থাকবে, পেজ থেকে ইউজারের সম্মতিতে
// (SKIP_WAITING মেসেজ পেলে) তবেই activate হবে।
// ══════════════════════════════════════════════════════════
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) =>
        cache.add(url).catch((err) => console.warn('SW precache failed:', url, err))
      ))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ✅ ইউজার "এখনই আপডেট করুন" বাটনে ক্লিক করলে index.html থেকে এই মেসেজ আসবে
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ══════════════════════════════════════════════════════════
// FETCH — same-origin GET-এর জন্য দুই আলাদা স্ট্র্যাটেজি:
//   ১) App shell (JS/CSS/HTML/icons) → Cache-First (stale-while-revalidate)
//   ২) অন্য সব same-origin GET (ভবিষ্যতে কোনো ডেটা-কল হলে) → Network-First + Timeout Race
// Firestore/CDN ইত্যাদি cross-origin কল SW স্পর্শ করে না (আগের মতোই)।
// ══════════════════════════════════════════════════════════
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isAppShell = url.pathname === '/' || SHELL_PATHS.has(url.pathname);

  e.respondWith(isAppShell ? cacheFirst(e.request) : networkFirstWithTimeout(e.request));
});

// ── App Shell: Cache-First + ব্যাকগ্রাউন্ডে রিভ্যালিডেট ──
// cache-এ থাকলে সাথে সাথে সার্ভ করবে (instant load), নেটওয়ার্ক কল
// ব্যাকগ্রাউন্ডে চলে cache আপডেট করে রাখবে পরের ভিজিটের জন্য।
async function cacheFirst(request) {
  const cached = await caches.match(request);

  const revalidate = fetch(request).then((res) => {
    if (res.ok) {
      const clone = res.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
    }
    return res;
  }).catch(() => null);

  if (cached) return cached; // ব্লক না করে সাথে সাথে cache থেকে response
  const fresh = await revalidate;
  return fresh || caches.match('./index.html');
}

// ── ডেটা/অন্যান্য same-origin কল: Network-First + ৩সে Timeout Race ──
function networkFirstWithTimeout(request) {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(async () => {
      if (settled) return;
      const cached = await caches.match(request);
      if (cached) { settled = true; resolve(cached); }
      // cache-ও miss হলে এখানে কিছু resolve হবে না — নিচের fetch().then/.catch
      // যখনই শেষ হবে তখন resolve হবে, UI hang না করে।
    }, NETWORK_TIMEOUT_MS);

    fetch(request).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(async () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const cached = await caches.match(request);
        resolve(cached || Response.error());
      }
    });
  });
}
