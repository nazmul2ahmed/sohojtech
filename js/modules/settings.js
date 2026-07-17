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
        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><i class="fa-solid fa-database text-slate-400"></i> ডেটাবেস সংযোগ</h5>
          <div class="flex items-center gap-2 text-xs text-emerald-500 mb-3">
            <span class="w-2 h-2 rounded-full bg-emerald-500"></span> Firestore সংযুক্ত
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2"><i class="fa-solid fa-cloud text-slate-400"></i> অফলাইন সিঙ্ক স্ট্যাটাস</h5>
          <div id="settings-sync-status" class="flex items-center gap-2 text-xs text-slate-400">
            <span class="w-2 h-2 rounded-full bg-slate-300 animate-pulse"></span> লোড হচ্ছে...
          </div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3"><i class="fa-solid fa-file-export text-brand mr-1"></i> ডেটা এক্সপোর্ট</h5>
          <button onclick="exportToExcel()" class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm mb-2">
            <i class="fa-solid fa-download mr-1"></i> Excel-এ ডাউনলোড করুন
          </button>
          <p class="text-[11px] text-slate-400">সব ডেটা একটা .xlsx ফাইলে (প্রতিটা টেবিল আলাদা শিটে)।</p>
        </div>

        <div class="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-red-600 mb-3"><i class="fa-solid fa-trash-can mr-1"></i> সম্পূর্ণ রিসেট</h5>
          <p class="text-[11px] text-slate-500 mb-3">প্র্যাকটিস ডেটা মুছে নতুন করে শুরু করতে চাইলে।</p>
          <button onclick="openResetConfirm()" class="w-full border border-red-300 text-red-600 hover:bg-red-50 font-semibold py-2 rounded-lg text-sm">
            <i class="fa-solid fa-triangle-exclamation mr-1"></i> সব ডেটা মুছুন
          </button>
        </div>

        <div class="bg-brand/5 border border-brand/20 rounded-xl p-5">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2"><i class="fa-solid fa-circle-info text-brand"></i> অ্যাপ তথ্য</h5>
          <div class="text-xs text-slate-500 space-y-1">
            <div>সংস্করণ: <span class="font-mono">${esc(APP_CONFIG.version)}</span></div>
            <div>অফলাইন সিঙ্ক: <span class="font-semibold ${APP_CONFIG.features.offlineSync ? 'text-emerald-600' : 'text-slate-400'}">${APP_CONFIG.features.offlineSync ? 'সক্রিয়' : 'নিষ্ক্রিয়'}</span></div>
            <div>রিড-ওনলি গার্ড: <span class="font-semibold text-emerald-600">সক্রিয়</span></div>
          </div>
        </div>
      </div>
    </div>
  `;

  refreshSettingsSyncStatusCard();
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
        <button id="reset-confirm-btn" onclick="confirmReset()" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-lg text-sm">মুছে ফেলুন</button>
        <button onclick="document.getElementById('reset-modal').remove()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

async function confirmReset() {
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
    document.getElementById('sync-status-badge')?.remove();

    document.getElementById('reset-modal').remove();
    toast('সব ডেটা মুছে ফেলা হয়েছে। রিলোড হচ্ছে...', 's');
    setTimeout(() => location.reload(), 1200);
  } catch (err) { showFatalError('রিসেট করতে সমস্যা:\n' + err.message); }
}
