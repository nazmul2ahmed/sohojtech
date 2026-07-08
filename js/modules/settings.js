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
        </div>
        <button id="settings-save-btn" onclick="saveSettingsForm()" class="w-full mt-4 bg-brand hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm">
          <i class="fa-solid fa-floppy-disk mr-1"></i> সংরক্ষণ করুন
        </button>
      </div>

      <div class="space-y-4">
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 opacity-60">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><i class="fa-solid fa-database text-slate-400"></i> ডেটাবেস সংযোগ</h5>
          <div class="flex items-center gap-2 text-xs text-emerald-500 mb-3">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Firestore সংযুক্ত
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 opacity-60">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><i class="fa-solid fa-cloud text-slate-400"></i> অফলাইন সিঙ্ক স্ট্যাটাস</h5>
          <div class="flex items-center gap-2 text-xs text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-300"></span> নিষ্ক্রিয় (Phase E-তে সক্রিয় হবে)
          </div>
        </div>

        <div class="bg-brand/5 border border-brand/20 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><i class="fa-solid fa-circle-info text-brand"></i> অ্যাপ তথ্য</h5>
          <div class="text-xs text-slate-500 space-y-1">
            <div>সংস্করণ: <span class="font-mono">${esc(APP_CONFIG.version)}</span></div>
            <div>ধাপ: Phase D — Firestore রিওয়্যারিং</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function saveSettingsForm() {
  const name = document.getElementById('set-name').value.trim();
  if (!name) { toast('ফার্মেসির নাম দিন।', 'w'); return; }

  const data = {
    pharmacyName: name,
    ownerName: document.getElementById('set-owner').value.trim(),
    phone: document.getElementById('set-phone').value.trim(),
    address: document.getElementById('set-address').value.trim(),
    lowStockLevel: parseInt(document.getElementById('set-lowstock').value) || 10,
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
    showFatalError('সেটিংস সংরক্ষণে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk mr-1"></i> সংরক্ষণ করুন';
  }
}