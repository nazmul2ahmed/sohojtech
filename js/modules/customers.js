'use strict';

// ════════════════════════════════════════════════════════════
// CUSTOMERS MODULE — তালিকা, Add/Edit/Delete, বাকি আদায় (Collect Due)
// ✅ ফিক্স: genCustomerId() এখন timestamp-ভিত্তিক (আগে APP_STATE.length
// গুনে বানাত, যেটা রিফ্রেশে রিসেট হয়ে Firestore-এ থাকা পুরনো ID-র
// সাথে সংঘর্ষ করত — নতুন গ্রাহক যোগ ব্যর্থ হতো)
// ════════════════════════════════════════════════════════════

function genCustomerId() {
  return 'C-' + Date.now();
}

// ════════════════════════════════════════════════════════════
// ✅  due/totalPaid বদলানোর একমাত্র পাবলিক পথ — অন্য মডিউল
// থেকে customer.due = ... সরাসরি লেখার বদলে এই ফাংশন কল করা উচিত।
// delta-ভিত্তিক (কত বাড়বে/কমবে), সবসময় 0-এর নিচে যেতে বাধা দেয়।
// ════════════════════════════════════════════════════════════
function applyCustomerDueChange(custId, dueDelta = 0, totalPaidDelta = 0) {
  const cust = APP_STATE.customers.find(c => c.id === custId);
  if (!cust) return;
  if (dueDelta !== 0) cust.due = Math.max(0, round2((cust.due || 0) + dueDelta));
  if (totalPaidDelta !== 0) cust.totalPaid = Math.max(0, round2((cust.totalPaid || 0) + totalPaidDelta));
}

// ────────────────────────────────────────────────────────────
// MAIN RENDER
// ────────────────────────────────────────────────────────────
function renderCustomersModule() {
  const c = document.getElementById('customers-content');
  if (!c) return;
  APP_STATE.custSearch = APP_STATE.custSearch || '';

  const custs = APP_STATE.customers;
  const totalDue = custs.reduce((a, b) => a + (b.due || 0), 0);
  const dueCount = custs.filter(x => x.due > 0).length;

  c.innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard('মোট গ্রাহক', custs.length + ' জন', 'fa-users', 'blue')}
      ${statCard('বাকি আছে', dueCount + ' জন', 'fa-triangle-exclamation', 'orange')}
      ${statCard('মোট বাকি', '৳' + fmtK(totalDue), 'fa-hand-holding-dollar', 'red')}
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3 flex-wrap">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-users text-brand mr-1"></i> গ্রাহক তালিকা</h5>
        <div class="flex items-center gap-2">
          <input type="text" id="cust-search" placeholder="নাম/ফোন খুঁজুন..." value="${esc(APP_STATE.custSearch)}"
            oninput="onCustSearch(this.value)"
            class="w-40 sm:w-56 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          <button onclick="openCustomerForm(null)" class="bg-brand hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg whitespace-nowrap">
            <i class="fa-solid fa-plus mr-1"></i> নতুন গ্রাহক
          </button>
        </div>
      </div>
      <div id="cust-table-body"></div>
    </div>
  `;
  renderCustTable();
}

function onCustSearch(val) {
  APP_STATE.custSearch = val;
  renderCustTable();
}

function renderCustTable() {
  const body = document.getElementById('cust-table-body');
  if (!body) return;
  const q = (APP_STATE.custSearch || '').toLowerCase();
  const list = APP_STATE.customers
    .filter(c => !q || (c.name + ' ' + (c.phone || '')).toLowerCase().includes(q))
    .slice()
    .sort((a, b) => (b.due || 0) - (a.due || 0) || a.name.localeCompare(b.name));

  if (!list.length) {
    body.innerHTML = `<div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-users text-2xl opacity-30 mb-2 block"></i>কোনো গ্রাহক পাওয়া যায়নি</div>`;
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
          <th class="px-4 py-2.5 text-right">বাকি</th>
          <th class="px-4 py-2.5 text-right hidden lg:table-cell">মোট পরিশোধ</th>
          <th class="px-4 py-2.5 text-center">অ্যাকশন</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(c => `
        <tr class="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3">
            <div class="font-semibold text-slate-800 dark:text-white">${esc(c.name)}</div>
            <div class="text-[11px] font-mono text-slate-400">${esc(c.id)}</div>
          </td>
          <td class="px-4 py-3 hidden sm:table-cell text-slate-600 dark:text-slate-300 text-xs font-mono">${esc(c.phone || '—')}</td>
          <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-500 truncate max-w-[160px]">${esc(c.address || '—')}</td>
          <td class="px-4 py-3 text-right font-mono font-bold ${c.due > 0 ? 'text-red-600' : 'text-slate-400'}">৳${fmt(c.due || 0)}</td>
          <td class="px-4 py-3 hidden lg:table-cell text-right font-mono text-xs text-slate-500">৳${fmt(c.totalPaid || 0)}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            ${c.due > 0 ? `<button onclick="openCollectDue('${c.id}')" class="text-emerald-600 hover:underline text-xs mr-3"><i class="fa-solid fa-money-bill-transfer mr-1"></i>আদায়</button>` : ''}
            <button onclick="openCustomerForm('${c.id}')" class="text-brand hover:underline text-xs mr-3"><i class="fa-solid fa-pen mr-1"></i>এডিট</button>
            <button onclick="deleteCustomerConfirm('${c.id}')" class="text-red-500 hover:underline text-xs"><i class="fa-solid fa-trash mr-1"></i>মুছুন</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

// ────────────────────────────────────────────────────────────
// ADD / EDIT MODAL
// ────────────────────────────────────────────────────────────
function openCustomerForm(custId) {
  const isEdit = !!custId;
  const cust = isEdit ? APP_STATE.customers.find(c => c.id === custId) : null;
  if (isEdit && !cust) return;

  const modal = document.createElement('div');
  modal.id = 'customer-form-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1">${isEdit ? 'গ্রাহক এডিট' : 'নতুন গ্রাহক'}</h4>
      ${isEdit ? `<p class="text-xs text-slate-400 mb-4 font-mono">${esc(cust.id)}</p>` : `<p class="text-xs text-slate-400 mb-4">ID অটো-জেনারেট হবে</p>`}
      <div id="cust-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-4"></div>
      <div class="space-y-3 mb-4">
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">নাম *</label>
          <input type="text" id="cf-name" value="${esc(cust?.name || '')}" placeholder="গ্রাহকের নাম"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ফোন</label>
          <input type="text" id="cf-phone" value="${esc(cust?.phone || '')}" placeholder="017XXXXXXXX"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ঠিকানা</label>
          <input type="text" id="cf-address" value="${esc(cust?.address || '')}" placeholder="ঐচ্ছিক"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="cust-save-btn" onclick="saveCustomer(${isEdit ? `'${custId}'` : 'null'})" class="flex-1 bg-brand hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm">সংরক্ষণ করুন</button>
        <button onclick="closeCustomerForm()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('customer-form-modal', closeCustomerForm);
  document.getElementById('cf-name').focus();
}

function closeCustomerForm() {
  document.getElementById('customer-form-modal')?.remove();
}

async function saveCustomer(custId) {
  if (guardReadOnly()) return;
  const isEdit = !!custId;
  const errEl = document.getElementById('cust-form-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  const name = document.getElementById('cf-name').value.trim();
  const phone = document.getElementById('cf-phone').value.trim();
  const address = document.getElementById('cf-address').value.trim();

  if (!name) return showErr('নাম আবশ্যক।');

  const btn = document.getElementById('cust-save-btn');
  btn.disabled = true;
  btn.textContent = 'সংরক্ষণ হচ্ছে...';

  try {
    if (isEdit) {
      const res = await apiUpdateCustomer(custId, { name, phone, address });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }
      const cust = APP_STATE.customers.find(c => c.id === custId);
      Object.assign(cust, { name, phone, address });
      toast('গ্রাহক আপডেট হয়েছে।', 's');
    } else {
      const id = genCustomerId();
      const res = await apiAddCustomer({ id, name, phone, address });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }

      if (res.queued) {
        toast(res.message, 'w');
        refreshSyncBadge();
      } else {
        APP_STATE.customers.push({ id, name, phone, address, due: 0, totalPaid: 0 });
        toast(`"${name}" নিবন্ধিত হয়েছে।`, 's');
      }
    }
    closeCustomerForm();
    renderCustTable();
    if (typeof initPOSCustomerDropdown === 'function' && document.getElementById('sd-pos-customer')) {
      initPOSCustomerDropdown();
    }
  } catch (err) {
    showFatalError('গ্রাহক সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'সংরক্ষণ করুন';
  }
}

// ────────────────────────────────────────────────────────────
// DELETE
// ────────────────────────────────────────────────────────────
async function deleteCustomerConfirm(custId) {
  if (guardReadOnly()) return;
  const cust = APP_STATE.customers.find(c => c.id === custId);
  if (!cust) return;
  if (cust.due > 0) {
    toast(`৳${fmt(cust.due)} বাকি আছে। পরিশোধের পর মুছুন।`, 'w');
    return;
  }
  if (!confirm(`"${cust.name}" মুছে ফেলতে চান?`)) return;

  try {
    const res = await apiDeleteCustomer(custId);
    if (!res.success) { toast(res.message, 'w'); return; }
    APP_STATE.customers = APP_STATE.customers.filter(c => c.id !== custId);
    toast('গ্রাহক মুছে ফেলা হয়েছে।', 's');
    renderCustTable();
  } catch (err) {
    showFatalError('গ্রাহক মুছতে সমস্যা:\n' + humanizeError(err), err);
  }
}

// ────────────────────────────────────────────────────────────
// COLLECT DUE
// ────────────────────────────────────────────────────────────
function openCollectDue(custId) {
  const cust = APP_STATE.customers.find(c => c.id === custId);
  if (!cust || cust.due <= 0) return;

  const modal = document.createElement('div');
  modal.id = 'collect-due-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto">
     <h4 class="font-bold text-slate-800 dark:text-white mb-1">বাকি আদায় — ${esc(cust.name)}</h4>
      <p class="text-xs text-slate-400 mb-4">বর্তমান বাকি: <span class="font-mono font-bold text-red-600">৳${fmt(cust.due)}</span></p>
      <div id="cd-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-4"></div>
      <div class="mb-4">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">আদায়কৃত পরিমাণ</label>
        <input type="number" id="cd-amount" value="${cust.due}" min="0.01" max="${cust.due}" step="0.01"
          class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
      </div>
      <div class="mb-4">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">নোট (ঐচ্ছিক)</label>
        <input type="text" id="cd-note" placeholder="যেমন: নগদ পরিশোধ"
          class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      </div>
      <div class="flex gap-2">
        <button id="cd-save-btn" onclick="saveCollectDue('${custId}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 rounded-lg text-sm">গ্রহণ করুন</button>
        <button onclick="closeCollectDue()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('collect-due-modal', closeCollectDue);
  document.getElementById('cd-amount').focus();
}

function closeCollectDue() {
  document.getElementById('collect-due-modal')?.remove();
}

async function saveCollectDue(custId) {
  if (guardReadOnly()) return;
  const cust = APP_STATE.customers.find(c => c.id === custId);
  if (!cust) return;
  const errEl = document.getElementById('cd-form-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  const amount = round2(parseFloat(document.getElementById('cd-amount').value) || 0);
  const note = document.getElementById('cd-note').value.trim();

  if (amount <= 0) return showErr('সঠিক পরিমাণ দিন।');
  if (amount > cust.due + 0.01) return showErr(`বাকির (৳${fmt(cust.due)}) চেয়ে বেশি নেওয়া যাবে না।`);

  const btn = document.getElementById('cd-save-btn');
  btn.disabled = true;
  btn.textContent = 'প্রক্রিয়াকরণ হচ্ছে...';

  // ✅ ধাপ ০.১.২: paymentId এখানেই জেনারেট — অফলাইন queue হলে এই ID-ই
  // idempotency-key হিসেবে কাজ করবে sync-time-এ
  const paymentId = 'PAY-' + Date.now();

  try {
    const res = await apiCollectCustomerDue(paymentId, custId, amount, note, cust);
    if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'গ্রহণ করুন'; return; }

    if (res.queued) {
      // ✅ অফলাইন — sale/purchase-এর প্যাটার্ন অনুসরণ করে local state এখনই
      // বদলানো হচ্ছে না, sync সফল হলে applySyncedCustomerDue() এটা করবে
      toast(res.message, 'w');
      refreshSyncBadge();
    } else {
      applyCustomerDueChange(custId, -amount, amount);
      APP_STATE.payments.push({ paymentId, date: todayStr(), customerId: custId, customerName: cust.name, amount, note: note || 'বাকি আদায়' });
      toast(res.message, 's');
    }

    closeCollectDue();
    renderCustTable();
  } catch (err) {
    showFatalError('বাকি আদায়ে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'গ্রহণ করুন';
  }
}
