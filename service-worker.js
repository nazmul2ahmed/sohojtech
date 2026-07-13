'use strict';

const CACHE_NAME = 'sohojtech-shell-v8'; // ✅ JS/CSS/HTML সবসময় network-first (cache-busting query সহ), শুধু আইকন cache-first — তাই এখন থেকে এটা বাড়ানো জরুরি না, শুধু PRECACHE_URLS/STATIC_ASSET_PATHS লিস্ট বদলালে বাড়ালেই যথেষ্ট
const NETWORK_TIMEOUT_MS = 3000;

// ══════════════════════════════════════════════════════════
// APP SHELL — শুধু precache (install-এর সময় ডাউনলোড করে রাখা হয়,
// যাতে প্রথমবার অফলাইনেও অ্যাপ ওপেন হয়)। runtime fetch-এ এই
// লিস্টের JS/CSS/HTML ফাইলগুলো network-first স্ট্র্যাটেজিতে সার্ভ
// হয় (নিচে দেখুন) — শুধু আইকন cache-first, বাকিগুলো না।
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

// ══════════════════════════════════════════════════════════
// STATIC ASSETS — এগুলো কখনো বদলায় না (আইকন), তাই এখনো
// Cache-First রাখা হয়েছে instant লোডের জন্য। কোড ফাইল (JS/CSS/HTML)
// এখানে রাখবেন না — সেগুলো নিচে সবসময় network-first থাকবে।
// ══════════════════════════════════════════════════════════
const STATIC_ASSET_PATHS = new Set(
  ['./assets/icons/icon-192.png', './assets/icons/icon-512.png']
    .map((u) => new URL(u, self.location.href).pathname)
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
//   ১) স্ট্যাটিক আইকন (কখনো বদলায় না) → Cache-First (instant লোড)
//   ২) JS/CSS/HTML/অন্য সব → Network-First + ৩সে Timeout Race
//      (কোড আপডেট মিস হওয়ার সুযোগ নেই, নেট না থাকলে ক্যাশ ফলব্যাক)
// Firestore/CDN ইত্যাদি cross-origin কল SW স্পর্শ করে না (আগের মতোই)।
// ══════════════════════════════════════════════════════════
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  const isStaticAsset = STATIC_ASSET_PATHS.has(url.pathname);

  e.respondWith(isStaticAsset ? cacheFirst(e.request) : networkFirstWithTimeout(e.request));
});

// ── স্ট্যাটিক আইকন: Cache-First + ব্যাকগ্রাউন্ডে রিভ্যালিডেট ──
// cache-এ থাকলে সাথে সাথে সার্ভ করবে (instant), নেটওয়ার্ক কল
// ব্যাকগ্রাউন্ডে চলে cache আপডেট করে রাখবে (কখনো বদলালে সেটাও ধরবে)।
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
  return fresh || Response.error();
}

// ── JS/CSS/HTML ও অন্যান্য same-origin কল: Network-First + ৩সে Timeout Race ──
function networkFirstWithTimeout(request) {
  return new Promise((resolve) => {
    let settled = false;

    const timer = setTimeout(async () => {
      if (settled) return;
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) { settled = true; resolve(cached); }
      // cache-ও miss হলে এখানে কিছু resolve হবে না — নিচের fetch().then/.catch
      // যখনই শেষ হবে তখন resolve হবে, UI hang না করে।
    }, NETWORK_TIMEOUT_MS);

    fetch(request, { cache: 'no-store' }).then((res) => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
    }).catch(async () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        const cached = await caches.match(request, { ignoreSearch: true });
        resolve(cached || Response.error());
      }
    });
  });
}
