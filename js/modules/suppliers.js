'use strict';

// ════════════════════════════════════════════════════════════
// SUPPLIERS MODULE — তালিকা, Add/Edit/Delete, পাওনা পরিশোধ (Pay Payable)
// ✅ ফিক্স: genSupplierId() এখন timestamp-ভিত্তিক (একই কারণ, Customers দেখুন)
// ════════════════════════════════════════════════════════════

function genSupplierId() {
  return 'S-' + Date.now();
}

// ════════════════════════════════════════════════════════════
// ✅  totalPayable/totalPaid বদলানোর একমাত্র পাবলিক পথ —
// অন্য মডিউল থেকে supplier.totalPayable = ... সরাসরি লেখার বদলে
// এই ফাংশন কল করা উচিত। delta-ভিত্তিক, 0-এর নিচে যেতে বাধা দেয়।
// ════════════════════════════════════════════════════════════
function applySupplierPayableChange(supId, payableDelta = 0, totalPaidDelta = 0) {
  const sup = APP_STATE.suppliers.find(s => s.id === supId);
  if (!sup) return;
  if (payableDelta !== 0) sup.totalPayable = Math.max(0, round2((sup.totalPayable || 0) + payableDelta));
  if (totalPaidDelta !== 0) sup.totalPaid = Math.max(0, round2((sup.totalPaid || 0) + totalPaidDelta));
}

// ────────────────────────────────────────────────────────────
// MAIN RENDER
// ────────────────────────────────────────────────────────────
function renderSuppliersModule() {
  const c = document.getElementById('suppliers-content');
  if (!c) return;
  APP_STATE.supSearch = APP_STATE.supSearch || '';

  const sups = APP_STATE.suppliers;
  const totalPayable = sups.reduce((a, b) => a + (b.totalPayable || 0), 0);
  const payableCount = sups.filter(x => x.totalPayable > 0).length;

  c.innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard('মোট সরবরাহকারী', sups.length + ' জন', 'fa-building', 'blue')}
      ${statCard('পাওনা আছে', payableCount + ' জন', 'fa-triangle-exclamation', 'orange')}
      ${statCard('মোট পাওনা', '৳' + fmtK(totalPayable), 'fa-hand-holding-dollar', 'red')}
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3 flex-wrap">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-building text-brand mr-1"></i> সরবরাহকারী তালিকা</h5>
        <div class="flex items-center gap-2">
          <input type="text" id="sup-search" placeholder="নাম/ফোন খুঁজুন..." value="${esc(APP_STATE.supSearch)}"
            oninput="onSupSearch(this.value)"
            class="w-40 sm:w-56 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          <button onclick="openSupplierForm(null)" class="btn btn-primary btn-sm">
            <i class="fa-solid fa-plus"></i> নতুন সরবরাহকারী
          </button>
        </div>
      </div>
      <div id="sup-table-body"></div>
    </div>
  `;
  renderSupTable();
}

function onSupSearch(val) {
  APP_STATE.supSearch = val;
  renderSupTable();
}

function renderSupTable() {
  const body = document.getElementById('sup-table-body');
  if (!body) return;
  const q = (APP_STATE.supSearch || '').toLowerCase();
  const list = APP_STATE.suppliers
    .filter(s => !q || (s.name + ' ' + (s.phone || '')).toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (b.totalPayable || 0) - (a.totalPayable || 0) || a.name.localeCompare(b.name));

  if (!list.length) {
    body.innerHTML = `<div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-building text-2xl opacity-30 mb-2 block"></i>কোনো সরবরাহকারী পাওয়া যায়নি</div>`;
    return;
  }

  body.innerHTML = `
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase text-slate-500 dark:text-slate-400">
        <tr>
          <th class="px-4 py-2.5 text-left">নাম</th>
          <th class="px-4 py-2.5 text-left hidden sm:table-cell">ফোন</th>
          <th class="px-4 py-2.5 text-left hidden md:table-cell">ঠিকানা</th>
          <th class="px-4 py-2.5 text-right">পাওনা</th>
          <th class="px-4 py-2.5 text-right hidden lg:table-cell">মোট পরিশোধ</th>
          <th class="px-4 py-2.5 text-center">অ্যাকশন</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(s => `
        <tr class="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3">
            <div class="font-semibold text-slate-800 dark:text-white">${esc(s.name)}</div>
            <div class="text-[11px] font-mono text-slate-400">${esc(s.id)}</div>
          </td>
          <td class="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-300 text-xs font-mono">${esc(s.phone || '—')}</td>
          <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-500 truncate max-w-[160px]">${esc(s.address || '—')}</td>
          <td class="px-4 py-3 text-right font-mono font-bold ${s.totalPayable > 0 ? 'text-amber-600' : 'text-slate-400'}">৳${fmt(s.totalPayable || 0)}</td>
          <td class="px-4 py-3 hidden lg:table-cell text-right font-mono text-xs text-slate-500">৳${fmt(s.totalPaid || 0)}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            ${s.totalPayable > 0 ? `<button onclick="openPayPayable('${s.id}')" class="text-emerald-600 hover:underline text-xs mr-3"><i class="fa-solid fa-money-bill-transfer mr-1"></i>পরিশোধ</button>` : ''}
            <button onclick="openSupplierHistory('${s.id}')" class="text-slate-500 hover:underline text-xs mr-3"><i class="fa-solid fa-clock-rotate-left mr-1"></i>ইতিহাস</button>
            <button onclick="openRepresentativesModal('${s.id}')" class="text-slate-500 hover:underline text-xs mr-3"><i class="fa-solid fa-user-tie mr-1"></i>প্রতিনিধি</button>
            <button onclick="openSupplierForm('${s.id}')" class="text-brand hover:underline text-xs mr-3"><i class="fa-solid fa-pen mr-1"></i>এডিট</button>
            <button onclick="deleteSupplierConfirm('${s.id}')" class="text-red-500 hover:underline text-xs"><i class="fa-solid fa-trash mr-1"></i>মুছুন</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

// ────────────────────────────────────────────────────────────
// ADD / EDIT MODAL
// ────────────────────────────────────────────────────────────
function openSupplierForm(supId) {
  const isEdit = !!supId;
  const sup = isEdit ? APP_STATE.suppliers.find(s => s.id === supId) : null;
  if (isEdit && !sup) return;

  const modal = document.createElement('div');
  modal.id = 'supplier-form-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1">${isEdit ? 'সরবরাহকারী এডিট' : 'নতুন সরবরাহকারী'}</h4>
      ${isEdit ? `<p class="text-xs text-slate-400 mb-4 font-mono">${esc(sup.id)}</p>` : `<p class="text-xs text-slate-400 mb-4">ID অটো-জেনারেট হবে</p>`}
      <div id="sup-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-4"></div>
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">নাম *</label>
          <input type="text" id="sf-name" value="${esc(sup?.name || '')}" placeholder="সরবরাহকারীর নাম"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ফোন</label>
          <input type="text" id="sf-phone" value="${esc(sup?.phone || '')}" placeholder="02XXXXXXXX"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ঠিকানা</label>
          <input type="text" id="sf-address" value="${esc(sup?.address || '')}" placeholder="ঐচ্ছিক"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">সাপ্লায়ার ধরন (ঐচ্ছিক)</label>
          <select id="sf-category" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            <option value="">— নির্বাচন করুন —</option>
            <option value="manufacturer_rep" ${sup?.supplierCategory === 'manufacturer_rep' ? 'selected' : ''}>ম্যানুফ্যাকচারার প্রতিনিধি</option>
            <option value="wholesaler" ${sup?.supplierCategory === 'wholesaler' ? 'selected' : ''}>পাইকার (একাধিক কোম্পানি)</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ম্যানুফ্যাকচারার নাম (কমা দিয়ে আলাদা)</label>
          <input type="text" id="sf-manufacturers" value="${esc((sup?.manufacturerNames || []).join(', '))}" placeholder="যেমন: Beximco, Square"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          <p class="text-[11px] text-slate-400 mt-1">প্রতিনিধি হলে সাধারণত একটাই কোম্পানি, পাইকার হলে একাধিক বা খালি রাখতে পারেন — এটা শুধু গ্রুপিং/ফিল্টারের জন্য।</p>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="sup-save-btn" onclick="saveSupplier(${isEdit ? `'${supId}'` : 'null'})" class="btn btn-primary flex-1">সংরক্ষণ করুন</button>
        <button onclick="closeSupplierForm()" class="btn btn-secondary">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('supplier-form-modal', closeSupplierForm);
  document.getElementById('sf-name').focus();
}

function closeSupplierForm() {
  document.getElementById('supplier-form-modal')?.remove();
}

async function saveSupplier(supId) {
  if (guardReadOnly()) return;
  const isEdit = !!supId;
  const errEl = document.getElementById('sup-form-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  const name = document.getElementById('sf-name').value.trim();
  const phone = document.getElementById('sf-phone').value.trim();
  const address = document.getElementById('sf-address').value.trim();
  const supplierCategory = document.getElementById('sf-category').value;
  const manufacturerNames = document.getElementById('sf-manufacturers').value.split(',').map(s => s.trim()).filter(Boolean);

  if (!name) return showErr('নাম আবশ্যক।');

  const btn = document.getElementById('sup-save-btn');
  btn.disabled = true;
  btn.textContent = 'সংরক্ষণ হচ্ছে...';

  try {
    if (isEdit) {
      const res = await apiUpdateSupplier(supId, { name, phone, address, supplierCategory, manufacturerNames });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }
      const sup = APP_STATE.suppliers.find(s => s.id === supId);
      Object.assign(sup, { name, phone, address, supplierCategory, manufacturerNames });
      toast('সরবরাহকারী আপডেট হয়েছে।', 's');
    } else {
      const id = genSupplierId();
      const res = await apiAddSupplier({ id, name, phone, address, supplierCategory, manufacturerNames });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }

      if (res.queued) {
        toast(res.message, 'w');
        refreshSyncBadge();
      } else {
        APP_STATE.suppliers.push({ id, name, phone, address, supplierCategory, manufacturerNames, totalPayable: 0, totalPaid: 0 });
        toast(`"${name}" যোগ হয়েছে।`, 's');
      }
    }
    closeSupplierForm();
    renderSupTable();
    if (typeof initPurSupplierDropdown === 'function' && document.getElementById('sd-pur-supplier')) {
      initPurSupplierDropdown();
    }
  } catch (err) {
    showFatalError('সরবরাহকারী সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'সংরক্ষণ করুন';
  }
}

// ────────────────────────────────────────────────────────────
// DELETE
// ────────────────────────────────────────────────────────────
async function deleteSupplierConfirm(supId) {
  if (guardReadOnly()) return;
  const sup = APP_STATE.suppliers.find(s => s.id === supId);
  if (!sup) return;
  if (sup.totalPayable > 0) {
    toast(`৳${fmt(sup.totalPayable)} পাওনা আছে। পরিশোধের পর মুছুন।`, 'w');
    return;
  }
  if (!confirm(`"${sup.name}" মুছে ফেলতে চান?`)) return;

  try {
    const res = await apiDeleteSupplier(supId);
    if (!res.success) { toast(res.message, 'w'); return; }
    APP_STATE.suppliers = APP_STATE.suppliers.filter(s => s.id !== supId);
    toast('সরবরাহকারী মুছে ফেলা হয়েছে।', 's');
    renderSupTable();
  } catch (err) {
    showFatalError('সরবরাহকারী মুছতে সমস্যা:\n' + humanizeError(err), err);
  }
}

// ────────────────────────────────────────────────────────────
// PAY PAYABLE
// ────────────────────────────────────────────────────────────
function openPayPayable(supId) {
  const sup = APP_STATE.suppliers.find(s => s.id === supId);
  if (!sup || sup.totalPayable <= 0) return;

  const modal = document.createElement('div');
  modal.id = 'pay-payable-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1">পাওনা পরিশোধ — ${esc(sup.name)}</h4>
      <p class="text-xs text-slate-400 mb-4">বর্তমান পাওনা: <span class="font-mono font-bold text-amber-600">৳${fmt(sup.totalPayable)}</span></p>
      <div id="pp-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-4"></div>
      <div class="mb-4">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">পরিশোধের পরিমাণ</label>
        <input type="number" id="pp-amount" value="${sup.totalPayable}" min="0.01" max="${sup.totalPayable}" step="0.01"
          class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
      </div>
      <div class="mb-4">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">নোট (ঐচ্ছিক)</label>
        <input type="text" id="pp-note" placeholder="যেমন: চেক পেমেন্ট"
          class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      </div>
      <div class="flex gap-2">
        <button id="pp-save-btn" onclick="savePayPayable('${supId}')" class="btn btn-success flex-1">পরিশোধ করুন</button>
        <button onclick="closePayPayable()" class="btn btn-secondary">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('pay-payable-modal', closePayPayable);
  document.getElementById('pp-amount').focus();
}

function closePayPayable() {
  document.getElementById('pay-payable-modal')?.remove();
}

async function savePayPayable(supId) {
  if (guardReadOnly()) return;
  const sup = APP_STATE.suppliers.find(s => s.id === supId);
  if (!sup) return;
  const errEl = document.getElementById('pp-form-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  const amount = round2(parseFloat(document.getElementById('pp-amount').value) || 0);
  const note = document.getElementById('pp-note').value.trim();

  if (amount <= 0) return showErr('সঠিক পরিমাণ দিন।');
  if (amount > sup.totalPayable + 0.01) return showErr(`পাওনার (৳${fmt(sup.totalPayable)}) চেয়ে বেশি দেওয়া যাবে না।`);

  const btn = document.getElementById('pp-save-btn');
  btn.disabled = true;
  btn.textContent = 'প্রক্রিয়াকরণ হচ্ছে...';

  const paymentId = 'SPAY-' + Date.now();

  try {
    const res = await apiPaySupplierPayable(paymentId, supId, amount, note, sup);
    if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'পরিশোধ করুন'; return; }

    if (res.queued) {
      toast(res.message, 'w');
      refreshSyncBadge();
    } else {
      applySupplierPayableChange(supId, -amount, amount);
      APP_STATE.supplierPayments.push({ paymentId, date: todayStr(), supplierId: supId, supplierName: sup.name, amount, note: note || 'পাওনা পরিশোধ' });
      toast(res.message, 's');
    }

    closePayPayable();
    renderSupTable();
  } catch (err) {
    showFatalError('পাওনা পরিশোধে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'পরিশোধ করুন';
  }
} 

// ════════════════════════════════════════════════════════════
// ✅ টায়ার ২: SUPPLIER-WISE HISTORY VIEW
// customers.js-এর openCustomerHistory()-এর সমান্তরাল প্যাটার্ন —
// বিদ্যমান APP_STATE (purchases/returns/supplierPayments/openingEntries)
// থেকে chronological লেজার। কোনো নতুন Firestore query লাগে না।
// ⚠️ payable-change লজিক api-client.js-এর apiSubmitPurchase()/
// apiSubmitSupplierReturn()-এর সাথে হুবহু মিলিয়ে রাখা হয়েছে:
//   - ক্রয় (বাকি) → +totalCost, ক্রয় (নগদ) → পাওনায় প্রভাব নেই
//   - রিটার্ন (ফেরত + পাওনা সমন্বয়) → −amount, অন্য কম্বিনেশনে প্রভাব নেই
//   - রাইট-অফ (ধ্বংস) → পাওনায় কোনো প্রভাব নেই (pure loss)
//   - পরিশোধ → −amount, opening entry → +amount
// ════════════════════════════════════════════════════════════

function buildSupplierHistoryEntries(supId) {
  const entries = [];

  APP_STATE.purchases.filter(p => p.supplierId === supId).forEach(p => {
    const isDue = p.paymentType === 'বাকি';
    entries.push({
      date: p.date, type: 'purchase',
      label: `ক্রয় ${p.purchaseId}`,
      detail: `৳${fmt(p.totalCost)} — ${esc(p.paymentType)}`,
      payableChange: isDue ? p.totalCost : 0,
    });
  });

  APP_STATE.returns.filter(r => r.returnType === 'supplier' && r.partyId === supId).forEach(r => {
    const isPayableAdjust = r.reason === 'ফেরত' && r.refundMethod === 'পাওনা সমন্বয়';
    const label = r.reason === 'ধ্বংস' ? `রাইট-অফ ${r.refId}` : `রিটার্ন ${r.refId}`;
    entries.push({
      date: r.date, type: 'return',
      label,
      detail: r.reason === 'ধ্বংস' ? `৳${fmt(r.amount)} — মেয়াদোত্তীর্ণ ক্ষতি` : `৳${fmt(r.amount)} — ${esc(r.refundMethod || '—')}`,
      payableChange: isPayableAdjust ? -r.amount : 0,
    });
  });

  (APP_STATE.supplierPayments || []).filter(p => p.supplierId === supId).forEach(p => {
    entries.push({
      date: p.date, type: 'payment',
      label: `পাওনা পরিশোধ${p.note ? ' — ' + p.note : ''}`,
      detail: `৳${fmt(p.amount)}`,
      payableChange: -p.amount,
    });
  });

  (APP_STATE.openingEntries || []).filter(e => e.category === 'সরবরাহকারী বাকি' && e.supplierId === supId).forEach(e => {
    entries.push({
      date: e.date, type: 'opening',
      label: 'পূর্বের হিসাব (Opening)',
      detail: e.description || '৳' + fmt(e.amount),
      payableChange: e.amount || 0,
    });
  });

  entries.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  let running = 0;
  entries.forEach(e => { running = round2(running + e.payableChange); e.runningPayable = running; });

  return entries.reverse();
}

function openSupplierHistory(supId) {
  const sup = APP_STATE.suppliers.find(s => s.id === supId);
  if (!sup) return;

  const entries = buildSupplierHistoryEntries(supId);
  const totalPurchases = entries.filter(e => e.type === 'purchase').length;
  const totalPaid = round2(entries.filter(e => e.type === 'payment').reduce((a, e) => a - e.payableChange, 0));
  const totalReturns = entries.filter(e => e.type === 'return').length;

  const anyCapReached = APP_STATE.capReached && (APP_STATE.capReached.purchases || APP_STATE.capReached.returns);
  const capWarning = (anyCapReached && !APP_STATE.olderHistoryLoaded)
    ? `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 mb-3">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> সাম্প্রতিক ৮,০০০টার বেশি এন্ট্রি থাকলে এই ইতিহাস অসম্পূর্ণ হতে পারে — চলমান পাওনার হিসাব বর্তমান প্রকৃত পাওনার (৳${fmt(sup.totalPayable || 0)}) সাথে না মিলতে পারে। Analytics ট্যাব থেকে "১২ মাসের আগের হিস্টোরি লোড করুন" চাপলে ঠিক হয়ে যাবে।
      </div>` : '';

  const modal = document.createElement('div');
  modal.id = 'sup-history-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-clock-rotate-left text-brand mr-1"></i> ইতিহাস — ${esc(sup.name)}</h4>
      <p class="text-xs text-slate-400 mb-4">${esc(sup.phone || '')} ${sup.address ? '• ' + esc(sup.address) : ''}</p>

      ${capWarning}

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <div class="bg-brand/5 rounded-lg p-2.5 text-center">
          <div class="text-[10px] text-slate-400">মোট ক্রয়</div>
          <div class="font-mono font-bold text-brand">${totalPurchases} টি</div>
        </div>
        <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-2.5 text-center">
          <div class="text-[10px] text-slate-400">মোট পরিশোধ</div>
          <div class="font-mono font-bold text-emerald-600">৳${fmt(totalPaid)}</div>
        </div>
        <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-2.5 text-center">
          <div class="text-[10px] text-slate-400">রিটার্ন/রাইট-অফ</div>
          <div class="font-mono font-bold text-red-500">${totalReturns} টি</div>
        </div>
        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2.5 text-center">
          <div class="text-[10px] text-slate-400">বর্তমান পাওনা</div>
          <div class="font-mono font-bold text-amber-600">৳${fmt(sup.totalPayable || 0)}</div>
        </div>
      </div>

      <div class="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
        <div class="max-h-96 overflow-y-auto">
          ${entries.length ? entries.map(e => renderSupHistoryRow(e)).join('') : `
            <div class="px-4 py-8 text-center text-slate-400 text-sm">কোনো লেনদেন পাওয়া যায়নি</div>`}
        </div>
      </div>

      <button onclick="document.getElementById('sup-history-modal').remove()" class="btn btn-secondary btn-block mt-4">বন্ধ করুন</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('sup-history-modal', () => document.getElementById('sup-history-modal')?.remove());
}

function renderSupHistoryRow(e) {
  const typeIcon = { purchase: 'fa-truck-field text-brand', return: 'fa-rotate-left text-red-500', payment: 'fa-money-bill-transfer text-emerald-500', opening: 'fa-clock-rotate-left text-slate-400' }[e.type];
  const payableChangeText = e.payableChange === 0 ? '' :
    `<span class="font-mono text-xs ${e.payableChange > 0 ? 'text-red-500' : 'text-emerald-600'}">${e.payableChange > 0 ? '+' : ''}৳${fmt(Math.abs(e.payableChange))}</span>`;
  return `
    <div class="px-4 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center gap-2 text-sm">
      <div class="min-w-0 flex items-center gap-2">
        <i class="fa-solid ${typeIcon} text-xs w-4 text-center flex-shrink-0"></i>
        <div class="min-w-0">
          <div class="font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(e.label)}</div>
          <div class="text-[11px] text-slate-400">${esc(e.date)} • ${esc(e.detail)}</div>
        </div>
      </div>
      <div class="text-right flex-shrink-0">
        ${payableChangeText}
        <div class="text-[10px] text-slate-400">পাওনা: ৳${fmt(e.runningPayable)}</div>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ৩৩.১: SUPPLIER REPRESENTATIVES MODAL
// একই সাপ্লায়ার-কোম্পানির একাধিক প্রতিনিধি (ভিন্ন প্রোডাক্ট-গ্রুপ নিয়ে
// কাজ করেন) আলাদাভাবে যোগ/মুছার জন্য। ধাপ ৩৩.৩-এ Reorder Quick-List
// প্যানেল এই ডেটা ব্যবহার করবে (medicine.preferredRepId → এই রেকর্ড)।
// ════════════════════════════════════════════════════════════
let _repCache = []; // সর্বশেষ লোড করা প্রতিনিধি তালিকা — delete/render-এ রেফারেন্সের জন্য

function openRepresentativesModal(supId) {
  const sup = APP_STATE.suppliers.find(s => s.id === supId);
  if (!sup) return;
  document.getElementById('rep-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'rep-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-user-tie text-brand mr-1"></i> প্রতিনিধি — ${esc(sup.name)}</h4>
      <p class="text-xs text-slate-400 mb-4">একই সাপ্লায়ার-কোম্পানির একাধিক প্রতিনিধি (বিভিন্ন প্রোডাক্ট-গ্রুপ নিয়ে কাজ করেন এমন) এখানে যোগ করুন।</p>
      <div id="rep-list" class="space-y-2 mb-4">
        <div class="text-center text-xs text-slate-400 py-4"><i class="fa-solid fa-spinner fa-spin mr-1"></i>লোড হচ্ছে...</div>
      </div>
      <div class="border-t border-slate-200 dark:border-slate-700 pt-4">
        <h5 class="text-xs font-semibold text-slate-500 uppercase mb-2">নতুন প্রতিনিধি যোগ করুন</h5>
        <div id="rep-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>
        <div class="space-y-2 mb-3">
          <input type="text" id="rep-name" placeholder="প্রতিনিধির নাম"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          <input type="text" id="rep-phone" placeholder="ফোন"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          <input type="text" id="rep-groups" placeholder="প্রোডাক্ট-গ্রুপ (কমা দিয়ে, ঐচ্ছিক) — যেমন: কার্ডিয়াক, অ্যান্টিবায়োটিক"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <button id="rep-add-btn" onclick="submitAddRepresentative('${supId}')" class="btn btn-primary btn-block btn-sm">যোগ করুন</button>
      </div>
      <button onclick="document.getElementById('rep-modal').remove()" class="btn btn-secondary btn-block mt-4">বন্ধ করুন</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('rep-modal', () => document.getElementById('rep-modal')?.remove());
  loadAndRenderRepresentatives(supId);
}

async function loadAndRenderRepresentatives(supId) {
  const box = document.getElementById('rep-list');
  if (!box) return;
  const res = await apiGetRepresentatives(supId);
  if (!document.getElementById('rep-list')) return; // মডাল বন্ধ হয়ে গেলে safe no-op
  if (!res.success) {
    box.innerHTML = `<div class="text-center text-xs text-red-500 py-4">লোড ব্যর্থ: ${esc(res.message)}</div>`;
    return;
  }
  _repCache = res.representatives;
  renderRepresentativesList(supId);
}

function renderRepresentativesList(supId) {
  const box = document.getElementById('rep-list');
  if (!box) return;
  if (!_repCache.length) {
    box.innerHTML = `<div class="text-center text-xs text-slate-400 py-4">এখনো কোনো প্রতিনিধি যোগ করা হয়নি।</div>`;
    return;
  }
  box.innerHTML = _repCache.map(r => `
    <div class="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-800 dark:text-white truncate">${esc(r.name)}</div>
        <div class="text-[11px] text-slate-400 truncate">${esc(r.phone || '—')}${(r.groups && r.groups.length) ? ' • ' + esc(r.groups.join(', ')) : ''}</div>
      </div>
      <button onclick="deleteRepresentativeConfirm('${supId}','${esc(r.id)}')" class="text-red-400 hover:text-red-600 flex-shrink-0"><i class="fa-solid fa-trash text-xs"></i></button>
    </div>`).join('');
}

async function submitAddRepresentative(supId) {
  if (guardReadOnly()) return;
  const errEl = document.getElementById('rep-form-error');
  errEl.classList.add('hidden');
  const name = document.getElementById('rep-name').value.trim();
  const phone = document.getElementById('rep-phone').value.trim();
  const groups = document.getElementById('rep-groups').value.split(',').map(s => s.trim()).filter(Boolean);
  if (!name) { errEl.textContent = 'নাম আবশ্যক।'; errEl.classList.remove('hidden'); return; }

  const btn = document.getElementById('rep-add-btn');
  btn.disabled = true;
  btn.textContent = 'যোগ হচ্ছে...';
  try {
    const res = await apiAddRepresentative(supId, { name, phone, groups });
    if (!res.success) { errEl.textContent = res.message; errEl.classList.remove('hidden'); btn.disabled = false; btn.textContent = 'যোগ করুন'; return; }
    document.getElementById('rep-name').value = '';
    document.getElementById('rep-phone').value = '';
    document.getElementById('rep-groups').value = '';
    toast('প্রতিনিধি যোগ হয়েছে।', 's');
    await loadAndRenderRepresentatives(supId);
  } catch (err) {
    errEl.textContent = humanizeError(err);
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.textContent = 'যোগ করুন';
  }
}

async function deleteRepresentativeConfirm(supId, repId) {
  if (guardReadOnly()) return;
  if (!confirm('এই প্রতিনিধি মুছে ফেলতে চান?')) return;
  try {
    const res = await apiDeleteRepresentative(supId, repId);
    if (!res.success) return toast(res.message, 'w');
    toast('প্রতিনিধি মুছে ফেলা হয়েছে।', 's');
    await loadAndRenderRepresentatives(supId);
  } catch (err) {
    showFatalError('প্রতিনিধি মুছতে সমস্যা:\n' + humanizeError(err), err);
  }
}
