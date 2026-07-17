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
          <button onclick="openSupplierForm(null)" class="bg-brand hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg whitespace-nowrap">
            <i class="fa-solid fa-plus mr-1"></i> নতুন সরবরাহকারী
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
      </div>
      <div class="flex gap-2">
        <button id="sup-save-btn" onclick="saveSupplier(${isEdit ? `'${supId}'` : 'null'})" class="flex-1 bg-brand hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm">সংরক্ষণ করুন</button>
        <button onclick="closeSupplierForm()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
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

  if (!name) return showErr('নাম আবশ্যক।');

  const btn = document.getElementById('sup-save-btn');
  btn.disabled = true;
  btn.textContent = 'সংরক্ষণ হচ্ছে...';

  try {
    if (isEdit) {
      const res = await apiUpdateSupplier(supId, { name, phone, address });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }
      const sup = APP_STATE.suppliers.find(s => s.id === supId);
      Object.assign(sup, { name, phone, address });
      toast('সরবরাহকারী আপডেট হয়েছে।', 's');
    } else {
      const id = genSupplierId();
      const res = await apiAddSupplier({ id, name, phone, address });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }
      APP_STATE.suppliers.push({ id, name, phone, address, totalPayable: 0, totalPaid: 0 });
      toast(`"${name}" যোগ হয়েছে।`, 's');
    }
    closeSupplierForm();
    renderSupTable();
    if (typeof initPurSupplierDropdown === 'function' && document.getElementById('sd-pur-supplier')) {
      initPurSupplierDropdown();
    }
  } catch (err) {
    showFatalError('সরবরাহকারী সংরক্ষণে সমস্যা:\n' + err.message);
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
    showFatalError('সরবরাহকারী মুছতে সমস্যা:\n' + err.message);
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
        <button id="pp-save-btn" onclick="savePayPayable('${supId}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm">পরিশোধ করুন</button>
        <button onclick="closePayPayable()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
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

  try {
    const res = await apiPaySupplierPayable(supId, sup.totalPayable, sup.totalPaid || 0, amount, note, sup);
    if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'পরিশোধ করুন'; return; }

    applySupplierPayableChange(supId, -amount, amount);
    APP_STATE.supplierPayments.push({
      paymentId: 'SPAY-' + Date.now(), date: todayStr(), supplierId: supId,
      supplierName: sup.name, amount, note: note || 'পাওনা পরিশোধ',
    });

    toast(res.message, 's');
    closePayPayable();
    renderSupTable();
  } catch (err) {
    showFatalError('পাওনা পরিশোধে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.textContent = 'পরিশোধ করুন';
  }
}
