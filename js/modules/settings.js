'use strict';

// ════════════════════════════════════════════════════════════
// SETTINGS MODULE
// ════════════════════════════════════════════════════════════

function renderSettingsModule() {
  const c = document.getElementById('settings-content');
  if (!c) return;

  c.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><i class="fa-solid fa-store text-brand"></i> ফার্মেসির তথ্য</h5>
        <div id="settings-ok" class="hidden bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs rounded-lg px-3 py-2 mb-3">
          <i class="fa-solid fa-circle-check mr-1"></i> সংরক্ষিত হয়েছে!
        </div>
        <div id="settings-err" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ফার্মেসির নাম <span class="text-red-500">*</span></label>
            <input type="text" id="set-name" value="${esc(APP_STATE.pharmacyName)}" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">মালিকের নাম</label>
            <input type="text" id="set-owner" value="${esc(APP_STATE.ownerName)}" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ফোন নম্বর</label>
            <input type="tel" id="set-phone" value="${esc(APP_STATE.phone)}" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ঠিকানা</label>
            <input type="text" id="set-address" value="${esc(APP_STATE.address)}" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">গ্লোবাল স্বল্প-স্টক সীমা</label>
            <input type="number" id="set-lowstock" value="${APP_STATE.lowStockLevel}" min="1" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            <p class="text-[11px] text-slate-400 mt-1">যেসব ওষুধের নিজস্ব রি-অর্ডার লেভেল নেই, তাদের জন্য এই সীমা প্রযোজ্য হবে।</p>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">মেয়াদ-সতর্কতা সীমা (দিন)</label>
            <input type="number" id="set-expiry-days" value="${APP_STATE.expiryAlertDays}" min="30" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            <p class="text-[11px] text-slate-400 mt-1">এর মধ্যে মেয়াদ শেষ হবে এমন ওষুধ Dashboard-এ সতর্কতা হিসেবে দেখাবে (যেমন ৬ মাস আগাম দেখতে ১৮০ বসান)। ৩০ দিনের কমে সেট করা যাবে না — এটা জরুরি-সতর্কতার নূন্যতম সীমা।</p>
          </div>
        </div>
        <button id="settings-save-btn" onclick="saveSettingsForm()" class="btn btn-primary btn-block mt-4">
          <i class="fa-solid fa-floppy-disk mr-1"></i> সংরক্ষণ করুন
        </button>
      </div>

      <div class="space-y-4">
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><i class="fa-solid fa-database text-slate-400"></i> ডেটাবেস সংযোগ</h5>
          <div id="settings-db-status" class="flex items-center gap-2 text-xs text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-300 animate-pulse"></span> লোড হচ্ছে...
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><i class="fa-solid fa-cloud text-slate-400"></i> অফলাইন সিঙ্ক স্ট্যাটাস</h5>
          <div id="settings-sync-status" class="flex items-center gap-2 text-xs text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-300 animate-pulse"></span> লোড হচ্ছে...
          </div>
        </div>

        ${!APP_STATE.isStaffMember ? `
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><i class="fa-solid fa-envelope-open-text text-slate-400"></i> ইমেইল বিজ্ঞপ্তি</h5>
          <p class="text-[11px] text-slate-400 mb-3">ট্রায়াল/সাবস্ক্রিপশন রিমাইন্ডার, পেমেন্ট-কনফার্মেশন ইত্যাদি ইমেইল — চাইলে বন্ধ করতে পারেন। ইমেইলের ফুটারেও একই টগলের একটা এক-ক্লিক লিংক আছে।</p>
          <div id="settings-email-pref" class="text-xs text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-300 animate-pulse inline-block"></span> লোড হচ্ছে...
          </div>
        </div>` : ''}

        ${!APP_STATE.isStaffMember ? `
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><i class="fa-solid fa-shield-halved text-slate-400"></i> PIN লক</h5>
          <p class="text-[11px] text-slate-400 mb-3">শেয়ার্ড/কাউন্টার ডিভাইসে ৫ মিনিট নিষ্ক্রিয় থাকলে বা অ্যাপ নতুন করে খুললে PIN চাইবে।</p>
          <div id="settings-pinlock-status" class="text-xs text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-300 animate-pulse inline-block"></span> লোড হচ্ছে...
          </div>
        </div>` : ''}

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><i class="fa-solid fa-sack-dollar text-brand"></i> নগদ ব্যালান্স</h5>
          <p class="text-[11px] text-slate-400 mb-3">ধাপ ৩২ থেকে প্রতিটা নগদ-প্রভাবিত লেনদেন স্বয়ংক্রিয়ভাবে ট্র্যাক হয়। প্রথমবার ব্যবহারের আগে নিচে আপনার হাতে/ব্যাংকে থাকা প্রকৃত নগদ পরিমাণ (physical count) বসিয়ে শুরুর পয়েন্ট সেট করুন।</p>
          <div class="mb-3">
            <span class="text-[11px] text-slate-400 block mb-1">বর্তমান হিসাবকৃত ব্যালান্স</span>
            <div id="settings-cash-balance" class="text-lg">
              <span class="w-2 h-2 rounded-full bg-slate-300 animate-pulse inline-block"></span>
            </div>
          </div>
          <div class="flex gap-2">
            <input type="number" id="cash-balance-input" placeholder="প্রকৃত নগদ পরিমাণ" min="0" step="0.01"
              class="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            <button id="cash-balance-save-btn" onclick="saveCashBalanceManual()" class="btn btn-primary btn-sm whitespace-nowrap">সেট করুন</button>
          </div>
          <p class="text-[11px] text-amber-600 mt-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>এটা বর্তমান হিসাবকৃত ব্যালান্সকে সম্পূর্ণ ওভাররাইট করবে — শুধু প্রথমবার শুরুর পয়েন্ট সেট করতে বা bookkeeping reconciliation-এর জন্য ব্যবহার করুন।</p>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3"><i class="fa-solid fa-file-export text-brand mr-1"></i> ডেটা এক্সপোর্ট</h5>
          <button onclick="exportToExcel()" class="btn btn-primary btn-block mb-2">
            <i class="fa-solid fa-download mr-1"></i> Excel-এ ডাউনলোড করুন
          </button>
          <p class="text-[11px] text-slate-400">সব ডেটা একটা .xlsx ফাইলে (প্রতিটা টেবিল আলাদা শিটে)।</p>
          <span id="settings-export-note">${renderLastExportNote()}</span>
        </div>

        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-red-600 mb-3"><i class="fa-solid fa-trash-can mr-1"></i> সম্পূর্ণ রিসেট</h5>
          <p class="text-[11px] text-slate-500 mb-3">প্র্যাকটিস ডেটা মুছে নতুন করে শুরু করতে চাইলে।</p>
          <button onclick="openResetConfirm()" class="btn btn-danger-outline btn-block">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i> সব ডেটা মুছুন
          </button>
        </div>

        <div class="bg-brand/5 border border-brand/20 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><i class="fa-solid fa-circle-info text-brand"></i> অ্যাপ তথ্য</h5>
          <div class="text-xs text-slate-500 space-y-1">
            <div>সংস্করণ: <span class="font-mono">${esc(APP_CONFIG.version)}</span></div>
            <div>অফলাইন সিঙ্ক: <span class="font-semibold ${APP_CONFIG.features.offlineSync ? 'text-emerald-600' : 'text-slate-400'}">${APP_CONFIG.features.offlineSync ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></div>
            <div>রিড-ওনলি গার্ড: <span class="font-semibold text-emerald-600">সক্রিয়</span></div>
            <div>🔒 ডেটা সংরক্ষণ: <span class="font-semibold text-emerald-600">Google Firebase (এনক্রিপ্টেড)</span></div>
          </div>
          </div>
          <div class="flex gap-3 mt-3 pt-3 border-t border-brand/10">
            <a href="privacy.html" target="_blank" class="text-[11px] text-brand hover:underline">গোপনীয়তা নীতি</a>
            <a href="terms.html" target="_blank" class="text-[11px] text-brand hover:underline">ব্যবহারের শর্তাবলী</a>
          </div>
          <button onclick="startGuidedTour()" class="btn btn-brand-outline btn-sm btn-block mt-3">
            <i class="fa-solid fa-map-signs mr-1"></i> গাইডেড ট্যুর আবার দেখুন
          </button>
        </div>
      </div>
    </div>
  `;

  updateSettingsDbStatusCard();
  refreshSettingsSyncStatusCard();
  refreshCashBalanceCard();
  if (!APP_STATE.isStaffMember) refreshEmailPrefCard();
  if (!APP_STATE.isStaffMember) refreshPinLockCard();
}

// ────────────────────────────────────────────────────────────
// ✅ আইটেম ২৩: PIN-LOCK CARD
// ────────────────────────────────────────────────────────────
function refreshPinLockCard() {
  const box = document.getElementById('settings-pinlock-status');
  if (!box) return;
  const enabled = !!APP_STATE.pinLockEnabled;
  box.innerHTML = `
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <span class="text-xs font-semibold ${enabled ? 'text-emerald-600' : 'text-slate-400'}">${enabled ? '🔒 সক্রিয়' : '🔓 নিষ্ক্রিয়'}</span>
      <div class="flex gap-2">
        ${enabled
          ? `<button onclick="openPinSetModal(true)" class="btn btn-brand-outline btn-sm">PIN পরিবর্তন</button>
             <button onclick="disablePinLock()" class="btn btn-danger-outline btn-sm">বন্ধ করুন</button>`
          : `<button onclick="openPinSetModal(false)" class="btn btn-primary btn-sm">চালু করুন</button>`}
      </div>
    </div>`;
}

function openPinSetModal(isChange) {
  if (guardReadOnly()) return;
  document.getElementById('pinset-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'pinset-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-xs w-full">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1">${isChange ? 'নতুন PIN সেট করুন' : 'PIN লক চালু করুন'}</h4>
      <p class="text-xs text-slate-400 mb-4">৪ ডিজিটের সংখ্যা — মনে রাখা সহজ কিন্তু অনুমান করা কঠিন এমন কিছু দিন।</p>
      <div id="pinset-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>
      <input type="password" id="pinset-new" inputmode="numeric" maxlength="4" placeholder="নতুন PIN"
        oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,4)"
        class="w-full text-center text-xl tracking-[0.4em] px-3 py-2 mb-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      <input type="password" id="pinset-confirm" inputmode="numeric" maxlength="4" placeholder="আবার লিখুন"
        oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,4)"
        class="w-full text-center text-xl tracking-[0.4em] px-3 py-2 mb-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      <div class="flex gap-2">
        <button id="pinset-save-btn" onclick="savePinSet()" class="btn btn-primary flex-1">সংরক্ষণ করুন</button>
        <button onclick="document.getElementById('pinset-modal').remove()" class="btn btn-secondary">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('pinset-modal', () => document.getElementById('pinset-modal')?.remove());
  document.getElementById('pinset-new').focus();
}

async function savePinSet() {
  const errEl = document.getElementById('pinset-error');
  errEl.classList.add('hidden');
  const pin1 = document.getElementById('pinset-new').value.trim();
  const pin2 = document.getElementById('pinset-confirm').value.trim();
  if (!/^\d{4}$/.test(pin1)) { errEl.textContent = 'ঠিক ৪ ডিজিটের সংখ্যা দিন।'; errEl.classList.remove('hidden'); return; }
  if (pin1 !== pin2) { errEl.textContent = 'দুটো PIN মিলছে না।'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('pinset-save-btn');
  btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...';
  try {
    const hashHex = await hashPin(pin1);
    const res = await apiSaveSettings({ pinLockEnabled: true, pinHash: hashHex });
    if (!res.success) { errEl.textContent = res.message; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }
    applyPinLockStateChange(true, hashHex);
    toast('PIN লক চালু/আপডেট হয়েছে।', 's');
    document.getElementById('pinset-modal')?.remove();
    refreshPinLockCard();
  } catch (err) {
    showFatalError('PIN সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন';
  }
}

async function disablePinLock() {
  if (guardReadOnly()) return;
  if (!confirm('PIN লক বন্ধ করবেন? এই ডিভাইসে আর PIN চাইবে না।')) return;
  try {
    const res = await apiSaveSettings({ pinLockEnabled: false });
    if (!res.success) return toast(res.message, 'w');
    applyPinLockStateChange(false);
    toast('PIN লক বন্ধ করা হয়েছে।', 's');
    refreshPinLockCard();
  } catch (err) { showFatalError('PIN লক বন্ধ করতে সমস্যা:\n' + humanizeError(err), err); }
}

// ────────────────────────────────────────────────────────────
// ✅ [আইটেম ১৩ - Unsubscribe A] EMAIL PREFERENCE CARD
// ────────────────────────────────────────────────────────────
async function refreshEmailPrefCard() {
  const box = document.getElementById('settings-email-pref');
  if (!box) return;
  try {
    const res = await apiGetEmailPreferences();
    if (!document.getElementById('settings-email-pref')) return; // ট্যাব বদলে গেলে safe no-op
    if (!res.success) {
      box.innerHTML = `<span class="text-xs text-slate-400">লোড করা যায়নি</span>`;
      return;
    }
    const subscribed = !res.unsubscribedAll;
    box.innerHTML = `
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <span class="text-xs font-semibold ${subscribed ? 'text-emerald-600' : 'text-slate-400'}">
          ${subscribed ? '✅ সক্রিয় — রিমাইন্ডার/আপডেট ইমেইল পাবেন' : '🔕 বন্ধ — কোনো লাইফসাইকেল ইমেইল যাবে না'}
        </span>
        <button id="email-pref-toggle-btn" onclick="toggleEmailUnsubscribe(${subscribed})" class="btn btn-sm ${subscribed ? 'btn-danger-outline' : 'btn-brand-outline'}">
          ${subscribed ? 'বন্ধ করুন' : 'চালু করুন'}
        </button>
      </div>`;
  } catch (err) {
    box.innerHTML = `<span class="text-xs text-slate-400">লোড ব্যর্থ</span>`;
  }
}

async function toggleEmailUnsubscribe(currentlySubscribed) {
  if (guardReadOnly()) return;
  const newUnsubscribedFlag = currentlySubscribed; // সাবস্ক্রাইবড থাকলে → নতুন স্টেট: unsubscribed = true
  const btn = document.getElementById('email-pref-toggle-btn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const res = await apiSetEmailUnsubscribed(newUnsubscribedFlag);
    if (!res.success) { toast(res.message, 'w'); refreshEmailPrefCard(); return; }
    toast(newUnsubscribedFlag ? 'ইমেইল বন্ধ করা হয়েছে।' : 'ইমেইল আবার চালু করা হয়েছে।', 's');
    refreshEmailPrefCard();
  } catch (err) {
    showFatalError('ইমেইল প্রেফারেন্স বদলাতে সমস্যা:\n' + humanizeError(err), err);
    refreshEmailPrefCard();
  }
}

// ✅ ধাপ ২২: আগে হার্ডকোডেড "Firestore সংযুক্ত" (সবুজ, সবসময়) দেখাত —
// এখন navigator.onLine অনুযায়ী আসল সংযোগ-অবস্থা দেখায়। conn-status-badge
// (header)-এর মতোই app.js-এর online/offline ইভেন্ট থেকে লাইভ আপডেট হয়,
// তাই Settings ট্যাব খোলা থাকা অবস্থায় নেট হারালে/ফিরলেও সাথে সাথে বদলায়।
function updateSettingsDbStatusCard() {
  const box = document.getElementById('settings-db-status');
  if (!box) return; // ইউজার অন্য ট্যাবে থাকলে নিরাপদে কিছু করবে না

  if (navigator.onLine) {
    box.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> Firestore সংযুক্ত`;
    box.className = 'flex items-center gap-2 text-xs text-emerald-500';
  } else {
    box.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span> অফলাইন — সংযোগ নেই`;
    box.className = 'flex items-center gap-2 text-xs text-red-500';
  }
}

// ✅ ধাপ ২১: আগে হার্ডকোডেড "নিষ্ক্রিয়" দেখাত (opacity-60 দিয়ে dimmed) —
// এখন প্রকৃত pending queue count দিয়ে আসল অবস্থা দেখায়। getPendingWriteCount()
// async, তাই render-এর পর আলাদা করে কল করে DOM আপডেট করা হচ্ছে (progressive)।
async function refreshSettingsSyncStatusCard() {
  const box = document.getElementById('settings-sync-status');
  if (!box) return; // ইউজার ইতিমধ্যে অন্য ট্যাবে চলে গেলে safe no-op

  try {
    const counts = await getPendingWriteCount();
    if (!document.getElementById('settings-sync-status')) return; // রেসের সময় ট্যাব বদলালে

    if (counts.total === 0) {
      box.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-500"></span> সক্রিয় — কোনো পেন্ডিং এন্ট্রি নেই`;
      box.className = 'flex items-center gap-2 text-xs text-emerald-600';
    } else if (counts.failed > 0) {
      box.innerHTML = `<span class="w-2 h-2 rounded-full bg-red-500"></span> ${counts.total}টা পেন্ডিং (${counts.failed}টা ব্যর্থ) — <button onclick="openSyncPanel()" class="underline font-semibold">দেখুন</button>`;
      box.className = 'flex items-center gap-2 text-xs text-red-600';
    } else {
      box.innerHTML = `<span class="w-2 h-2 rounded-full bg-amber-500"></span> ${counts.total}টা সিঙ্ক অপেক্ষমাণ — <button onclick="openSyncPanel()" class="underline font-semibold">দেখুন</button>`;
      box.className = 'flex items-center gap-2 text-xs text-amber-600';
    }
  } catch (err) {
    box.innerHTML = `<span class="w-2 h-2 rounded-full bg-slate-300"></span> স্ট্যাটাস লোড করা যায়নি`;
    box.className = 'flex items-center gap-2 text-xs text-slate-400';
  }
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ৩২.৪: CASH BALANCE CARD — বর্তমান হিসাবকৃত ব্যালান্স দেখায়
// ────────────────────────────────────────────────────────────
async function refreshCashBalanceCard() {
  const box = document.getElementById('settings-cash-balance');
  if (!box) return;
  try {
    const res = await apiGetCashBalance();
    if (!document.getElementById('settings-cash-balance')) return; // ট্যাব বদলে গেলে safe no-op
    if (!res.success) {
      box.innerHTML = `<span class="text-xs text-slate-400">লোড করা যায়নি</span>`;
      return;
    }
    const bal = res.cashBalance;
    box.innerHTML = `<span class="font-mono font-extrabold ${bal >= 0 ? 'text-emerald-600' : 'text-red-600'}">${bal < 0 ? '−' : ''}৳${fmt(Math.abs(bal))}</span>`;
  } catch (err) {
    box.innerHTML = `<span class="text-xs text-slate-400">লোড ব্যর্থ</span>`;
  }
}

async function saveCashBalanceManual() {
  if (guardReadOnly()) return;
  const input = document.getElementById('cash-balance-input');
  const amount = parseFloat(input.value);
  if (isNaN(amount) || amount < 0) { toast('সঠিক (০ বা তার বেশি) পরিমাণ দিন।', 'w'); return; }
  if (!confirm(`নগদ ব্যালান্স ৳${fmt(amount)}-এ সেট করতে চান? এটা বর্তমান হিসাবকৃত ব্যালান্সের ওপর সম্পূর্ণ ওভাররাইট হবে।`)) return;

  const btn = document.getElementById('cash-balance-save-btn');
  btn.disabled = true;
  btn.textContent = 'সংরক্ষণ হচ্ছে...';
  try {
    const res = await apiSetCashBalance(amount);
    if (!res.success) { toast(res.message, 'w'); btn.disabled = false; btn.textContent = 'সেট করুন'; return; }
    toast('নগদ ব্যালান্স সেট করা হয়েছে।', 's');
    input.value = '';
    refreshCashBalanceCard();
  } catch (err) {
    showFatalError('নগদ ব্যালান্স সেট করতে সমস্যা:\n' + humanizeError(err), err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'সেট করুন';
  }
}

async function saveSettingsForm() {
  if (guardReadOnly()) return; 
  const name = document.getElementById('set-name').value.trim();
  if (!name) { toast('ফার্মেসির নাম দিন।', 'w'); return; }

  const data = {
    pharmacyName: name,
    ownerName: document.getElementById('set-owner').value.trim(),
    phone: document.getElementById('set-phone').value.trim(),
    address: document.getElementById('set-address').value.trim(),
    lowStockLevel: parseInt(document.getElementById('set-lowstock').value) || 10,
    expiryAlertDays: Math.max(30, parseInt(document.getElementById('set-expiry-days').value) || 90),
  };

  const btn = document.getElementById('settings-save-btn');
  const errBox = document.getElementById('settings-err');
  errBox.classList.add('hidden');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> সংরক্ষণ হচ্ছে...';

  try {
    const res = await apiSaveSettings(data);
    if (!res.success) {
      errBox.textContent = res.message;
      errBox.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> সংরক্ষণ করুন';
      return;
    }

    Object.assign(APP_STATE, data);
    setText('sidebar-pharma-name', APP_STATE.pharmacyName);
    APP_STATE.inventory.forEach(inv => recalcInventoryRow(inv));

    const okBox = document.getElementById('settings-ok');
    okBox.classList.remove('hidden');
    setTimeout(() => okBox.classList.add('hidden'), 3000);
    toast('সেটিংস সংরক্ষিত হয়েছে!', 's');

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> সংরক্ষণ করুন';
  } catch (err) {
    showFatalError('সেটিংস সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> সংরক্ষণ করুন';
  }
}

// ════════════════════════════════════════════════════════════
// ✅ আইটেম ১২: রিসিট লোগো — client-side compress + Firestore
// config/settings-এ base64 হিসেবে সংরক্ষণ (Storage/Blaze লাগে না)
// ════════════════════════════════════════════════════════════
const LOGO_MAX_DIM = 160;
const LOGO_JPEG_QUALITY = 0.6;
const LOGO_MAX_BYTES = 200 * 1024; // ২০০ KB — Firestore ১ MiB ডকুমেন্ট-লিমিটের তুলনায় নিরাপদ মার্জিন

function compressLogoFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('শুধু ছবি ফাইল (JPG/PNG) আপলোড করুন।'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const scale = Math.min(1, LOGO_MAX_DIM / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); // transparency থাকলে সাদা ব্যাকগ্রাউন্ড
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', LOGO_JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error('ছবি পড়া যায়নি — ফাইলটা corrupted হতে পারে।'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('ফাইল রিড করতে ব্যর্থ।'));
    reader.readAsDataURL(file);
  });
}

function renderLogoPreview() {
  const box = document.getElementById('logo-preview-box');
  const removeBtn = document.getElementById('logo-remove-btn');
  if (!box) return;
  if (APP_STATE.logoBase64) {
    box.innerHTML = `<img src="${APP_STATE.logoBase64}" class="h-16 w-16 object-contain border border-slate-200 dark:border-slate-600 rounded-lg bg-white p-1"/>`;
    removeBtn?.classList.remove('hidden');
  } else {
    box.innerHTML = `<div class="h-16 w-16 flex items-center justify-center border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-slate-300 text-[10px] text-center px-1">কোনো লোগো নেই</div>`;
    removeBtn?.classList.add('hidden');
  }
}

async function onLogoFileSelect(event) {
  const errEl = document.getElementById('logo-error');
  errEl.classList.add('hidden');

  if (guardReadOnly()) { event.target.value = ''; return; }
  const file = event.target.files[0];
  if (!file) return;

  try {
    const dataUrl = await compressLogoFile(file);
    if (dataUrl.length > LOGO_MAX_BYTES) {
      throw new Error('কম্প্রেস করার পরও ছবির সাইজ বড় — আরও সহজ/ছোট একটা লোগো ছবি ব্যবহার করুন।');
    }
    const res = await apiSaveSettings({ logoBase64: dataUrl });
    if (!res.success) throw new Error(res.message);

    APP_STATE.logoBase64 = dataUrl;
    renderLogoPreview();
    toast('লোগো সংরক্ষণ হয়েছে।', 's');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    event.target.value = '';
  }
}

async function removeLogo() {
  if (guardReadOnly()) return;
  if (!confirm('লোগো মুছে ফেলতে চান?')) return;
  try {
    const res = await apiSaveSettings({ logoBase64: '' });
    if (!res.success) return toast(res.message, 'w');
    APP_STATE.logoBase64 = '';
    renderLogoPreview();
    toast('লোগো মুছে ফেলা হয়েছে।', 's');
  } catch (err) {
    showFatalError('লোগো মুছতে সমস্যা:\n' + humanizeError(err), err);
  }
}

// ✅ ধাপ ০.৩: এক্সপোর্ট-সফল হওয়ার পর Firestore-এ টাইমস্ট্যাম্প — fire-and-forget,
// ব্যর্থ হলেও এক্সপোর্ট নিজে (ইতিমধ্যে সফল) আটকাবে না, শুধু রিমাইন্ডার সামান্য stale থাকবে
async function recordExcelExportTimestamp() {
  APP_STATE.lastExportAt = new Date(); // ✅ optimistic — Settings/Dashboard-এ সাথে সাথে রিফ্লেক্ট
  try {
    await apiSaveSettings({ lastExportAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.warn('ব্যাকআপ-টাইমস্ট্যাম্প সংরক্ষণ ব্যর্থ (এক্সপোর্ট নিজে সফল হয়েছে):', err);
  }
}

// ✅ ধাপ ০.৩: Settings-এর "ডেটা এক্সপোর্ট" কার্ডে ছোট informational note
function renderLastExportNote() {
  if (!APP_STATE.lastExportAt) {
    return `<p class="text-[11px] text-amber-600 mt-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>এখনো কোনো ব্যাকআপ নেওয়া হয়নি।</p>`;
  }
  const ts = APP_STATE.lastExportAt;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  const colorClass = days >= 30 ? 'text-amber-600' : 'text-slate-400';
  return `<p class="text-[11px] ${colorClass} mt-2">সর্বশেষ ব্যাকআপ: ${days <= 0 ? 'আজ' : days + ' দিন আগে'}</p>`;
}

function exportToExcel() {
  const wb = XLSX.utils.book_new();
  const sheets = {
    'Medicines': APP_STATE.medicines,
    'Inventory': APP_STATE.inventory.map(i => ({ medId: i.medId, brand: i.brand, doseForm: i.doseForm, strength: i.strength, totalStock: i.totalStock, costValue: i.costValue, mrpValue: i.mrpValue, sellPrice: i.sellPrice, nearestExpiry: i.nearestExpiry, status: i.status })),
    'Customers': APP_STATE.customers,
    'Suppliers': APP_STATE.suppliers,
    'Sales': APP_STATE.sales.map(s => ({ invoiceNo: s.invoiceNo, date: s.date, customerName: s.customerName, totalBill: s.totalBill, cashPaid: s.cashPaid, due: s.due, type: s.type, items: JSON.stringify(s.items) })),
    'Purchases': APP_STATE.purchases.map(p => ({ purchaseId: p.purchaseId, date: p.date, supplierName: p.supplierName, totalCost: p.totalCost, paymentType: p.paymentType, items: JSON.stringify(p.items) })),
    'Returns': APP_STATE.returns.map(r => ({ returnId: r.returnId, date: r.date, returnType: r.returnType, refId: r.refId, refName: r.refName, amount: r.amount, reason: r.reason || '', refundMethod: r.refundMethod || '' })),
    'Expenses': APP_STATE.expenses,
    'Payments': APP_STATE.payments,
    'SupplierPayments': APP_STATE.supplierPayments,
    'OpeningEntries': APP_STATE.openingEntries,
  };
  Object.entries(sheets).forEach(([name, data]) => {
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, `${APP_STATE.pharmacyName || 'pharmacy'}_${todayStr()}.xlsx`);
  toast('Excel ফাইল ডাউনলোড হয়েছে।', 's');
  recordExcelExportTimestamp(); // ✅ ধাপ ০.৩
  const note = document.getElementById('settings-export-note');
  if (note) note.outerHTML = renderLastExportNote().replace('<p ', '<p id="settings-export-note" ');
}

function openResetConfirm() {
  const modal = document.createElement('div');
  modal.id = 'reset-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full">
      <h4 class="font-bold text-red-600 mb-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i> সম্পূর্ণ রিসেট</h4>
      <p class="text-sm text-slate-500 mb-3">এটা সব ওষুধ, বিক্রয়, ক্রয়, গ্রাহক — সব মুছে ফেলবে। এই কাজ <b>ফিরিয়ে আনা যাবে না</b>। আগে Export করে নিন।</p>
      <p class="text-xs text-slate-400 mb-2">নিশ্চিত করতে নিচে <b>RESET</b> লিখুন:</p>
      <input type="text" id="reset-confirm-input" class="w-full px-3 py-2 text-sm border border-red-300 rounded-lg mb-3 bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      <div class="flex gap-2">
        <button id="reset-confirm-btn" onclick="confirmReset()" class="btn btn-danger flex-1">মুছে ফেলুন</button>
        <button onclick="document.getElementById('reset-modal').remove()" class="btn btn-secondary">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('reset-modal', () => document.getElementById('reset-modal')?.remove());
}

async function confirmReset() {
  if (guardReadOnly()) return;
  if (document.getElementById('reset-confirm-input').value.trim() !== 'RESET') {
    toast('ঠিক করে "RESET" লিখুন।', 'w'); return;
  }
  const btn = document.getElementById('reset-confirm-btn');
  btn.disabled = true; btn.textContent = 'মুছা হচ্ছে...';
  try {
    const res = await apiResetAllData();
    if (!res.success) { toast(res.message, 'w'); btn.disabled = false; btn.textContent = 'মুছে ফেলুন'; return; }

    // ✅ ধাপ ১৯: Firestore রিসেট সফল হওয়ার পর IndexedDB-এর pending sync
    // queue-ও মুছে দেওয়া হচ্ছে, নাহলে পুরনো/অফলাইন এন্ট্রি সদ্য-খালি
    // অ্যাকাউন্টে পরে সিঙ্ক হয়ে ভুল ডেটা ঢুকিয়ে দিতে পারে।
    try {
      await clearPendingWritesForUser();
    } catch (err) {
      console.warn('Pending sync queue পরিষ্কার করতে সমস্যা:', err);
      // এটা রিসেট প্রক্রিয়াকে থামাবে না — Firestore ইতিমধ্যে খালি হয়ে গেছে,
      // এটা শুধু IndexedDB-এর একটা সেকেন্ডারি ক্লিনআপ পদক্ষেপ
    }
    APP_STATE.pendingSales = [];
    APP_STATE.pendingPurchases = [];
    APP_STATE.pendingReturns = [];
    document.getElementById('sync-status-badge')?.remove();

    document.getElementById('reset-modal').remove();
    toast('সব ডেটা মুছে ফেলা হয়েছে। রিলোড হচ্ছে...', 's');
    setTimeout(() => location.reload(), 1200);
  } catch (err) { showFatalError('রিসেট করতে সমস্যা:\n' + humanizeError(err), err); }
}
