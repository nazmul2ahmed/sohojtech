'use strict';

// ════════════════════════════════════════════════════════════
// sync-engine.js — অফলাইন queue প্রসেস করে Firestore-এ পাঠানো
// db-indexeddb.js (স্টোরেজ) আর api-client.js (Firestore call) —
// এই দুইয়ের মাঝে সেতু। এই ফাইলে কোনো IndexedDB-এর direct কল নেই,
// শুধু db-indexeddb.js-এর পাবলিক ফাংশন ব্যবহার হয়।
// ════════════════════════════════════════════════════════════

let _syncInProgress = false;

// ✅ ধাপ ২০: ব্যর্থ এন্ট্রির অসীম অটো-রিট্রাই ঠেকাতে
const MAX_AUTO_RETRY_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30000;        // প্রথম রিট্রাই বিরতি: ৩০ সেকেন্ড
const BACKOFF_MAX_MS = 30 * 60000;    // সর্বোচ্চ বিরতি: ৩০ মিনিট

function initSyncEngine() {
  // ✅ ফিক্স: গত সেশনে (ট্যাব ক্র্যাশ/বন্ধ) যদি কোনো এন্ট্রি 'syncing'
  // অবস্থায় আটকে থেকে যায়, সেটা এখন কেউ প্রসেস করছে না — তাই বুটেই
  // সেগুলোকে 'queued'-এ ফিরিয়ে দেওয়া হচ্ছে, নাহলে চিরতরে আটকে থাকবে।
  resetStuckSyncingEntries().finally(() => {
    refreshSyncBadge(); // ✅ ধাপ ১৮: বুট-টাইমে সঠিক (uid-ফিল্টারড) pending count সাথে সাথে দেখানো
    if (navigator.onLine) triggerSync();
  });

  // ✅ ফিক্স: শুধু 'online' ইভেন্টের উপর নির্ভর করা যথেষ্ট নয় — এটা মোবাইল
  // ব্রাউজারে/DevTools সিমুলেশনে মাঝেমধ্যে fire হয় না। তাই একাধিক
  // নিরাপত্তা-স্তর:
  window.addEventListener('online', () => triggerSync());

  // ট্যাব আবার visible হলে (phone unlock, app switch থেকে ফিরে আসা)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) triggerSync();
  });

  // চূড়ান্ত নিরাপত্তা-নেট — প্রতি ২০ সেকেন্ডে হালকা চেক (শুধু pending
  // থাকলে triggerSync() ভেতরে কিছু করে, নাহলে সাথে সাথে রিটার্ন করে —
  // তাই এটা ব্যাটারি/ডেটা খরচ করে না)
  setInterval(() => { if (navigator.onLine) triggerSync(); }, 20000);
}

async function triggerSync() {
  if (_syncInProgress) return; // একসাথে দুইবার না চলার গার্ড
  _syncInProgress = true;
  try {
    await processPendingQueue();
  } catch (err) {
    console.error('Sync queue প্রসেস করতে সমস্যা:', err);
  } finally {
    _syncInProgress = false;
  }
}

// ✅ ধাপ ২০: এই ব্যর্থ এন্ট্রিটা এখনই অটো-রিট্রাই করা উচিত কিনা —
// attempt-cap ও exponential backoff দুটোই বিবেচনা করে
function shouldAutoRetryFailed(entry) {
  if ((entry.attempts || 0) >= MAX_AUTO_RETRY_ATTEMPTS) return false;
  if (!entry.lastAttemptAt) return true;
  const backoffMs = Math.min(BACKOFF_BASE_MS * Math.pow(2, (entry.attempts || 1) - 1), BACKOFF_MAX_MS);
  return (Date.now() - entry.lastAttemptAt) >= backoffMs;
}

function isPermanentlyFailed(entry) {
  return entry.status === 'failed' && (entry.attempts || 0) >= MAX_AUTO_RETRY_ATTEMPTS;
}

function getSyncTypeApiMap() {
  return { sale: apiSubmitSale, purchase: apiSubmitPurchase };
}

async function processPendingQueue() {
  if (!navigator.onLine) return;
  const all = await getPendingWrites();
  // ✅ ধাপ ২০: 'queued' সবসময় প্রসেস হবে (নতুন বা ম্যানুয়াল রিট্রাই থেকে আসা)।
  // 'failed' শুধু backoff-window পার হলে এবং attempt-cap-এর নিচে থাকলেই
  // অটো-প্রসেস হবে — নাহলে ম্যানুয়াল হস্তক্ষেপের অপেক্ষায় থাকবে।
  const entries = all.filter(e => {
    if (e.status === 'syncing') return false;
    if (e.status === 'failed') return shouldAutoRetryFailed(e);
    return true;
  });

  for (const entry of entries) {
    if (!navigator.onLine) break; // মাঝপথে নেট চলে গেলে থেমে যাও, বাকিটা পরে
    await attemptSync(entry);
    refreshSyncBadge();
  }
}

async function attemptSync(entry) {
  await markSyncing(entry.tempId);
  const apiFn = getSyncTypeApiMap()[entry.type];
  if (!apiFn) { await markFailed(entry.tempId, 'অজানা এন্ট্রি টাইপ: ' + entry.type); return; }

  try {
    // ✅ ফিক্স: isRetry:true পাঠানো হচ্ছে — এই কল sync-queue থেকে retry,
    // তাই connectivity ব্যর্থ হলে apiSubmitSale/apiSubmitPurchase আবার
    // queue করবে না (duplicate entry এড়াতে), শুধু failed রিটার্ন করবে —
    // যেটা নিচে markFailed()-এ যাবে, পরের অটো-সাইকেলে আবার চেষ্টা হবে।
    const res = await apiFn(entry.payload, { isRetry: true });
    if (res.success) {
      applySyncedEntryToState(entry);
      await removePendingWrite(entry.tempId);
    } else {
      await markFailed(entry.tempId, res.message || 'সিঙ্ক ব্যর্থ');
    }
  } catch (err) {
    await markFailed(entry.tempId, err.message || 'অজানা সমস্যা');
  }
}

// ✅ সিঙ্ক সফল হলে এখানেই APP_STATE আপডেট হয় — ঠিক অনলাইন-মোডে
// pos.js/purchase.js যেভাবে করে, সেই একই লজিক এক জায়গায়
function applySyncedEntryToState(entry) {
  if (entry.type === 'sale') {
    const sale = entry.payload;
    sale.items.forEach(item => deductStockFEFO(item.medId, item.qty));
    if (sale.customerId !== 'WALK_IN') applyCustomerDueChange(sale.customerId, sale.due, sale.cashPaid);
    APP_STATE.sales.push(sale);
    APP_STATE.pendingSales = (APP_STATE.pendingSales || []).filter(s => s.invoiceNo !== sale.invoiceNo);
    toast(`Invoice ${sale.invoiceNo} সিঙ্ক হয়েছে।`, 's');
    if (APP_STATE.currentTab === 'pos') renderTodayPOSSales();
  } else if (entry.type === 'purchase') {
    const purchase = entry.payload;
    purchase.items.forEach(item => addPurchaseBatch(item, purchase.date));
    const supplier = APP_STATE.suppliers.find(s => s.id === purchase.supplierId);
    if (supplier) {
      if (purchase.paymentType === 'বাকি') applySupplierPayableChange(purchase.supplierId, purchase.totalCost, 0);
      else applySupplierPayableChange(purchase.supplierId, 0, purchase.totalCost);
    }
    APP_STATE.purchases.push(purchase);
    APP_STATE.pendingPurchases = (APP_STATE.pendingPurchases || []).filter(p => p.purchaseId !== purchase.purchaseId);
    toast(`Purchase ${purchase.purchaseId} সিঙ্ক হয়েছে।`, 's');
    if (APP_STATE.currentTab === 'purchase') renderTodayPurchases();
  }
}

// ────────────────────────────────────────────────────────────
// UI ব্যাজ — header-এ conn-status-badge-এর ঠিক আগে বসবে
// ────────────────────────────────────────────────────────────
async function refreshSyncBadge() {
  const counts = await getPendingWriteCount();
  let badge = document.getElementById('sync-status-badge');

  if (!counts.total) { badge?.remove(); return; }

  if (!badge) {
    badge = document.createElement('button');
    badge.id = 'sync-status-badge';
    badge.type = 'button';
    badge.onclick = openSyncPanel;
    const connBadge = document.getElementById('conn-status-badge');
    connBadge?.parentElement?.insertBefore(badge, connBadge);
  }

  const hasFailed = counts.failed > 0;
  badge.className = hasFailed
    ? 'inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 text-xs font-semibold'
    : 'inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded-full px-3 py-1 text-xs font-semibold';
  badge.innerHTML = hasFailed
    ? `<i class="fa-solid fa-triangle-exclamation"></i> ${counts.failed}টা সিঙ্ক ব্যর্থ`
    : `<i class="fa-solid fa-rotate fa-spin"></i> ${counts.total}টা সিঙ্ক বাকি`;
}

// ────────────────────────────────────────────────────────────
// SYNC প্যানেল — তালিকা + retry/discard
// ────────────────────────────────────────────────────────────
async function openSyncPanel() {
  const entries = await getPendingWrites();
  const modal = document.createElement('div');
  modal.id = 'sync-panel-modal';
  modal.className = 'fixed inset-0 z-[9996] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-3"><i class="fa-solid fa-rotate mr-1"></i> অফলাইন সিঙ্ক তালিকা</h4>
      ${navigator.onLine ? `<button id="sync-now-btn" class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm mb-3"><i class="fa-solid fa-rotate mr-1"></i> এখনই সিঙ্ক করুন</button>` : `<div class="text-center text-xs text-amber-600 mb-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i> এখন অফলাইন — নেট ফিরলে সিঙ্ক হবে</div>`}
      <div id="sync-panel-list" class="space-y-2 mb-4"></div>
      <button onclick="document.getElementById('sync-panel-modal').remove()" class="w-full border border-slate-300 dark:border-slate-600 rounded-lg py-2 text-sm text-slate-600 dark:text-slate-300">বন্ধ করুন</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('sync-panel-modal', () => document.getElementById('sync-panel-modal')?.remove());
  renderSyncPanelList(entries);

  document.getElementById('sync-now-btn')?.addEventListener('click', async () => {
    await triggerSync();
    renderSyncPanelList(await getPendingWrites());
    refreshSyncBadge();
  });
}

function renderSyncPanelList(entries) {
  const box = document.getElementById('sync-panel-list');
  if (!box) return;
  if (!entries.length) { box.innerHTML = `<div class="text-center text-sm text-slate-400 py-6">কোনো পেন্ডিং এন্ট্রি নেই।</div>`; return; }

  box.innerHTML = entries.map(e => {
    const label = e.type === 'sale' ? `বিক্রয় ${esc(e.payload.invoiceNo)} — ৳${fmt(e.payload.totalBill)}`
      : `ক্রয় ${esc(e.payload.purchaseId)} — ৳${fmt(e.payload.totalCost)}`;
    const permanentlyFailed = isPermanentlyFailed(e);
    const statusBadge = permanentlyFailed
      ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">স্থায়ী ব্যর্থ — ম্যানুয়াল প্রয়োজন</span>`
      : e.status === 'failed' ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">ব্যর্থ — পরে আবার চেষ্টা হবে</span>`
      : e.status === 'syncing' ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">সিঙ্ক হচ্ছে...</span>`
      : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">অপেক্ষমাণ</span>`;
    return `
      <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-3">
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm font-semibold">${label}</span>${statusBadge}
        </div>
        ${e.status === 'failed' ? `<div class="text-xs text-red-500 mb-2">${esc(e.lastError || '')}${permanentlyFailed ? ` (${e.attempts || 0}টা চেষ্টা ব্যর্থ)` : ''}</div>
        <div class="flex gap-2">
          <button data-tempid="${e.tempId}" class="sync-retry-btn text-xs text-brand hover:underline"><i class="fa-solid fa-rotate-right mr-1"></i>আবার চেষ্টা করুন</button>
          <button data-tempid="${e.tempId}" class="sync-discard-btn text-xs text-red-500 hover:underline"><i class="fa-solid fa-trash mr-1"></i>বাতিল করুন</button>
        </div>` : ''}
      </div>`;
  }).join('');

  box.querySelectorAll('.sync-retry-btn').forEach(btn => btn.addEventListener('click', async () => {
    await retryFailedWrite(btn.dataset.tempid);
    await triggerSync();
    renderSyncPanelList(await getPendingWrites());
    refreshSyncBadge();
  }));

  box.querySelectorAll('.sync-discard-btn').forEach(btn => btn.addEventListener('click', async () => {
    if (!confirm('নিশ্চিত? এই এন্ট্রি বাতিল করলে সেটা কখনো সংরক্ষিত হবে না।')) return;
    const entry = (await getPendingWrites()).find(x => x.tempId === btn.dataset.tempid);
    await discardFailedWrite(btn.dataset.tempid);
    if (entry?.type === 'sale') APP_STATE.pendingSales = (APP_STATE.pendingSales || []).filter(s => s.invoiceNo !== entry.payload.invoiceNo);
    if (entry?.type === 'purchase') APP_STATE.pendingPurchases = (APP_STATE.pendingPurchases || []).filter(p => p.purchaseId !== entry.payload.purchaseId);
    renderSyncPanelList(await getPendingWrites());
    refreshSyncBadge();
    toast('এন্ট্রি বাতিল করা হয়েছে।', 'w');
  }));
}
