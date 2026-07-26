'use strict';

// ════════════════════════════════════════════════════════════
// CHANGELOG MODULE — growth-polish.md টায়ার ২ আইটেম ৮
// APP_CONFIG.version বনাম localStorage-এ শেষ-দেখা ভার্সন তুলনা করে
// "✨ কী নতুন হলো" পপ-আপ দেখায়। প্রথমবার-ই-লগইনে (নতুন ইউজার) দেখায় না —
// শুধু চুপচাপ flag সেট করে, কারণ onboarding+tour তখন যথেষ্ট।
//
// ⚠️ ডেভেলপার-রিমাইন্ডার: প্রতিটা ইউজার-ফেসিং ফিচার ডিপ্লয়ে এখন থেকে
// service-worker.js-এর CACHE_NAME-এর পাশাপাশি APP_CONFIG.version-ও bump
// করতে হবে (config.js), এবং নিচের CHANGELOG অ্যারেতে একটা নতুন entry
// যোগ করতে হবে — নাহলে এই ফিচার silently কাজ করবে না।
// ════════════════════════════════════════════════════════════

const CHANGELOG_STORAGE_KEY = 'pharmacy-last-seen-version';

// নতুন → পুরনো অর্ডারে (সবচেয়ে সাম্প্রতিক এন্ট্রি সবার উপরে)
const CHANGELOG = [
  {
    version: '5.1.0-pwa',
    date: '২০২৬-০৭-২৬',
    items: [
      'নতুন গাইডেড ট্যুর — Settings থেকে "আবার দেখুন" দিয়ে যেকোনো সময় সাইডবারের প্রতিটা ফিচার নতুন করে দেখে নিন',
      'যোগাযোগ ও সাবস্ক্রিপশন ট্যাব — ফোন/WhatsApp/পেমেন্ট নাম্বার ও প্ল্যান প্রাইসিং এখন এক জায়গায়',
      'ছোট বাগ ফিক্স: read-only (ট্রায়াল/সাবস্ক্রিপশন শেষ) অবস্থায় Settings সেভ করতে গেলে এখন স্পষ্ট বার্তা দেখাবে',
    ],
  },
  // ভবিষ্যতে নতুন ভার্সন এখানে উপরে যোগ হবে
];

// ✅ true রিটার্ন করে যদি modal দেখানো হয় — app.js এটা দিয়ে বুঝবে
function maybeShowChangelogModal() {
  const lastSeen = localStorage.getItem(CHANGELOG_STORAGE_KEY);
  const current = APP_CONFIG.version;

  if (!lastSeen) {
    // প্রথমবার-ই — নতুন ইউজার, popup দরকার নেই, শুধু ভবিষ্যতের জন্য baseline সেট
    localStorage.setItem(CHANGELOG_STORAGE_KEY, current);
    return false;
  }

  if (lastSeen === current) return false; // ইতিমধ্যে এই ভার্সন দেখা হয়ে গেছে

  // lastSeen-এর পরের সব এন্ট্রি বের করা (CHANGELOG নতুন→পুরনো অর্ডারে থাকায়
  // lastSeen-এর index পর্যন্ত সবকিছু "নতুন")। lastSeen array-তে না পেলে
  // (অনেক পুরনো ভার্সন, বা history-তে নেই) নিরাপদে শুধু সর্বশেষ এন্ট্রি দেখানো হয়।
  const lastSeenIdx = CHANGELOG.findIndex(c => c.version === lastSeen);
  const newEntries = lastSeenIdx === -1 ? CHANGELOG.slice(0, 1) : CHANGELOG.slice(0, lastSeenIdx);

  localStorage.setItem(CHANGELOG_STORAGE_KEY, current);
  if (!newEntries.length) return false;

  openChangelogModal(newEntries);
  return true;
}

function openChangelogModal(entries) {
  document.getElementById('changelog-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'changelog-modal';
  modal.className = 'fixed inset-0 z-[9996] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto shadow-2xl">
      <div class="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
        <span class="text-2xl">✨</span>
      </div>
      <h3 class="text-lg font-extrabold text-slate-800 dark:text-white mb-1">কী নতুন হলো!</h3>
      <p class="text-xs text-slate-400 mb-4">অ্যাপ আপডেট হয়েছে — নতুন কী যোগ হলো দেখে নিন।</p>
      <div class="space-y-4 mb-5">
        ${entries.map(entry => `
          <div>
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-[11px] font-mono font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded-full">${esc(entry.version)}</span>
              <span class="text-[11px] text-slate-400">${esc(entry.date)}</span>
            </div>
            <ul class="space-y-1.5">
              ${entry.items.map(item => `
                <li class="text-xs text-slate-600 dark:text-slate-300 flex gap-2">
                  <i class="fa-solid fa-circle text-brand text-[5px] mt-1.5 flex-shrink-0"></i>
                  <span>${esc(item)}</span>
                </li>`).join('')}
            </ul>
          </div>`).join('')}
      </div>
      <button onclick="closeAppModal()" class="btn btn-primary btn-block">বুঝেছি</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('changelog-modal', () => document.getElementById('changelog-modal')?.remove());
}
