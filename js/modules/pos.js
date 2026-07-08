'use strict';

// ════════════════════════════════════════════════════════════
// POS / SALES MODULE
// ════════════════════════════════════════════════════════════
// ✅ Cash/Due Split বাগ ফিক্স: cashPaid ও due এখন Sale-লেভেলে।
// ✅ Keyboard flow: Enter = আইটেম যোগ, Ctrl+Enter = চেকআউট।
// ✅ Firestore রিওয়্যার: submitPOSSale() এখন apiSubmitSale() কল করে,
//    সফল হলেই APP_STATE-এ optimistic আপডেট হয় (আগে উল্টো ছিল)।
// ════════════════════════════════════════════════════════════

function renderPOSModule() {
  const container = document.getElementById('pos-content');
  if (!container) return;

  container.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- ══ বিলিং ফর্ম ══ -->
      <div class="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <i class="fa-solid fa-file-invoice text-brand"></i> নতুন বিক্রয় বিল
          </h5>
          <button onclick="resetPOS()" class="text-xs text-red-600 hover:underline flex items-center gap-1">
            <i class="fa-solid fa-rotate-left"></i> রিসেট
          </button>
        </div>

        <div id="pos-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-3"></div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">গ্রাহক <span class="text-red-500">*</span></label>
            <div id="sd-pos-customer"></div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">তারিখ</label>
            <input type="date" id="pos-date" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          </div>
        </div>

        <div id="pos-items-list" class="space-y-2 mb-3"></div>

        <button onclick="addPOSItem()" class="text-brand text-sm font-semibold flex items-center gap-1.5 mb-4 hover:underline">
          <i class="fa-solid fa-plus"></i> ওষুধ যোগ করুন
        </button>

        <div class="grid grid-cols-3 gap-3 mb-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">মোট (৳)</label>
            <input type="text" id="pos-total" readonly class="w-full px-3 py-2 text-sm font-mono font-bold bg-brand/10 text-brand border border-brand/30 rounded-lg"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">নগদ (৳) <span class="text-red-500">*</span></label>
            <input type="number" id="pos-cash" min="0" placeholder="০" oninput="onPOSCashChange()"
              class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">বাকি (৳)</label>
            <input type="text" id="pos-due" readonly class="w-full px-3 py-2 text-sm font-mono font-bold bg-red-50 dark:bg-red-900/20 text-red-600 border border-red-200 dark:border-red-800 rounded-lg"/>
          </div>
        </div>

        <button onclick="submitPOSSale()" id="pos-submit-btn"
          class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition">
          <i class="fa-solid fa-circle-check"></i> বিক্রয় নিশ্চিত করুন
          <span class="text-[11px] font-normal opacity-70 hidden sm:inline">(Ctrl+Enter)</span>
        </button>
      </div>

      <!-- ══ সাইড প্যানেল ══ -->
      <div class="space-y-4">
        <div class="bg-[#0D1B2A] rounded-xl p-5 text-white">
          <h6 class="text-[11px] uppercase tracking-wider text-white/40 mb-3">বিল সারসংক্ষেপ</h6>
          <div class="flex justify-between text-sm py-1.5 border-b border-white/10"><span class="text-white/70">মোট ওষুধ মূল্য</span><span id="bs-med" class="font-mono">৳০.০০</span></div>
          <div class="flex justify-between text-sm py-1.5 border-b border-white/10"><span class="text-white/70">ডিসকাউন্ট</span><span id="bs-disc" class="font-mono">৳০.০০</span></div>
          <div class="flex justify-between items-center py-2 border-b border-white/10"><span class="font-semibold">মোট দেয়</span><span id="bs-total" class="font-mono font-bold text-lg text-[#5AB4FF]">৳০.০০</span></div>
          <div class="flex justify-between text-sm py-1.5"><span class="text-white/70">নগদ</span><span id="bs-cash" class="font-mono">৳০.০০</span></div>
          <div class="flex justify-between text-sm py-1.5"><span class="text-white/70">বাকি</span><span id="bs-due" class="font-mono text-red-300">৳০.০০</span></div>
        </div>

        <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
          <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <h6 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-clock-rotate-left text-brand mr-1"></i> আজকের বিক্রয়</h6>
          </div>
          <div id="pos-today-sales" class="max-h-72 overflow-y-auto"></div>
        </div>
      </div>
    </div>
  `;

  initPOSCustomerDropdown();
  document.getElementById('pos-date').value = todayStr();
  APP_STATE.posItems = [];
  addPOSItem();
  calcPOSTotals();
  renderTodayPOSSales();

  setTimeout(() => focusMedicineInput(0), 50);
}

// ────────────────────────────────────────────────────────────
// CUSTOMER DROPDOWN
// ────────────────────────────────────────────────────────────
function initPOSCustomerDropdown() {
  const opts = [{ value: 'WALK_IN', label: 'নগদ গ্রাহক (Walk-In)', sub: 'কোনো নিবন্ধন নেই' }];
  APP_STATE.customers.forEach(c => opts.push({
    value: c.id, label: c.name,
    sub: (c.phone || '') + (c.due > 0 ? ` • বাকি: ৳${fmt(c.due)}` : ''),
    badge: c.due > 0 ? `৳${fmt(c.due)}` : null, badgeClass: 'bg-red-50 text-red-600',
  }));
  createSD('sd-pos-customer', opts, () => {}, '— গ্রাহক খুঁজুন —');
  sdSelect('sd-pos-customer', 'WALK_IN', 'নগদ গ্রাহক (Walk-In)');
}

// ────────────────────────────────────────────────────────────
// ITEM ROWS
// ────────────────────────────────────────────────────────────
function addPOSItem() {
  APP_STATE.posItems.push({ medId: '', name: '', qty: 1, price: 0, costPrice: 0, discountPct: 0 });
  renderPOSItems();
}

function removePOSItem(i) {
  if (APP_STATE.posItems.length <= 1) { toast('কমপক্ষে একটি সারি থাকতে হবে।', 'w'); return; }
  APP_STATE.posItems.splice(i, 1);
  renderPOSItems();
  calcPOSTotals();
}

function renderPOSItems() {
  const container = document.getElementById('pos-items-list');
  if (!container) return;
  const stockedMeds = APP_STATE.inventory.filter(m => m.totalStock > 0);

  container.innerHTML = APP_STATE.posItems.map((item, i) => {
    const currentMed = APP_STATE.inventory.find(m => m.medId === item.medId);
    const displayVal = currentMed ? buildMedDisplayText(currentMed) : '';
    return `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-3 relative bg-slate-50 dark:bg-slate-900/30">
      <button onclick="removePOSItem(${i})" class="absolute top-2 right-2 text-slate-400 hover:text-red-500">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="grid grid-cols-12 gap-2">
        <div class="col-span-12 md:col-span-5">
          <label class="block text-[11px] text-slate-400 mb-1">ওষুধ <span class="text-red-500">*</span></label>
          <input type="text" id="pos-med-input-${i}" list="pos-med-list-${i}" value="${esc(displayVal)}"
            placeholder="— স্ক্যান করুন বা টাইপ করুন —" autocomplete="off"
            onchange="onPOSMedicineChange(${i})"
            onkeydown="onPOSMedicineKeydown(event, ${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          <datalist id="pos-med-list-${i}">
            ${stockedMeds.map(m => `<option value="${esc(buildMedDisplayText(m))}"></option>`).join('')}
          </datalist>
        </div>
        <div class="col-span-4 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">Qty</label>
          <input type="number" id="pos-qty-${i}" value="${item.qty}" min="1"
            onkeydown="onPOSFieldKeydown(event, ${i})" oninput="onPOSFieldChange(${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-4 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">মূল্য (৳)</label>
          <input type="number" id="pos-price-${i}" value="${item.price}" min="0" step="0.01"
            onkeydown="onPOSFieldKeydown(event, ${i})" oninput="onPOSFieldChange(${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-4 md:col-span-1">
          <label class="block text-[11px] text-slate-400 mb-1">Disc %</label>
          <input type="number" id="pos-disc-${i}" value="${item.discountPct}" min="0" max="100"
            onkeydown="onPOSFieldKeydown(event, ${i})" oninput="onPOSFieldChange(${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-12 md:col-span-2 flex flex-col justify-end">
          <label class="block text-[11px] text-slate-400 mb-1">লাইন টোটাল</label>
          <div id="pos-linetotal-${i}" class="px-2.5 py-1.5 text-sm font-mono font-bold text-brand">৳০.০০</div>
        </div>
      </div>
    </div>`;
  }).join('');

  APP_STATE.posItems.forEach((_, i) => updateLineTotal(i));
}

function buildMedDisplayText(m) {
  return `${m.brand} ${m.doseForm || ''} ${m.strength || ''} [স্টক:${m.totalStock}]`.trim();
}

function matchMedicineFromInput(i) {
  const val = (document.getElementById(`pos-med-input-${i}`)?.value || '').trim();
  if (!val) return null;
  let match = APP_STATE.inventory.find(m => buildMedDisplayText(m) === val && m.totalStock > 0);
  if (!match) {
    const lc = val.toLowerCase();
    match = APP_STATE.inventory.find(m => m.totalStock > 0 &&
      (m.brand + ' ' + (m.doseForm || '') + ' ' + (m.strength || '')).toLowerCase().includes(lc));
  }
  return match || null;
}

function onPOSMedicineChange(i) {
  const med = matchMedicineFromInput(i);
  applyMedicineToItem(i, med);
}

function applyMedicineToItem(i, med) {
  if (med) {
    const nearestBatch = (med.batches && med.batches[0]) || { cost: 0 };
    APP_STATE.posItems[i] = {
      medId: med.medId, name: med.brand, qty: APP_STATE.posItems[i].qty || 1,
      price: med.sellPrice || 0, costPrice: nearestBatch.cost || 0,
      discountPct: APP_STATE.posItems[i].discountPct || 0,
    };
    document.getElementById(`pos-price-${i}`).value = med.sellPrice || 0;
  } else {
    APP_STATE.posItems[i] = { medId: '', name: '', qty: 1, price: 0, costPrice: 0, discountPct: 0 };
  }
  updateLineTotal(i);
  calcPOSTotals();
}

function onPOSFieldChange(i) {
  APP_STATE.posItems[i].qty = parseFloat(document.getElementById(`pos-qty-${i}`).value) || 0;
  APP_STATE.posItems[i].price = parseFloat(document.getElementById(`pos-price-${i}`).value) || 0;
  APP_STATE.posItems[i].discountPct = parseFloat(document.getElementById(`pos-disc-${i}`).value) || 0;
  updateLineTotal(i);
  calcPOSTotals();
}

function updateLineTotal(i) {
  const item = APP_STATE.posItems[i];
  const gross = (item.qty || 0) * (item.price || 0);
  const lineTotal = round2(gross - (gross * (item.discountPct || 0) / 100));
  const el = document.getElementById(`pos-linetotal-${i}`);
  if (el) el.textContent = '৳' + fmt(lineTotal);
}

// ────────────────────────────────────────────────────────────
// ⌨️ KEYBOARD FLOW
// ────────────────────────────────────────────────────────────
function onPOSMedicineKeydown(e, i) {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const med = matchMedicineFromInput(i);
  if (!med) { toast('ওষুধ খুঁজে পাওয়া যায়নি — নাম চেক করুন।', 'w'); return; }
  applyMedicineToItem(i, med);
  addPOSItem();
  const newIdx = APP_STATE.posItems.length - 1;
  setTimeout(() => focusMedicineInput(newIdx), 30);
}

function onPOSFieldKeydown(e, i) {
  if (e.key === 'Enter') {
    e.preventDefault();
    focusMedicineInput(i + 1 < APP_STATE.posItems.length ? i + 1 : i);
    if (i + 1 >= APP_STATE.posItems.length) {
      addPOSItem();
      setTimeout(() => focusMedicineInput(APP_STATE.posItems.length - 1), 30);
    }
  }
}

function focusMedicineInput(i) {
  document.getElementById(`pos-med-input-${i}`)?.focus();
}

document.addEventListener('keydown', (e) => {
  if (APP_STATE.currentTab === 'pos' && e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    submitPOSSale();
  }
});

// ────────────────────────────────────────────────────────────
// TOTALS
// ────────────────────────────────────────────────────────────
function calcPOSTotals() {
  let medTotal = 0, discTotal = 0;
  APP_STATE.posItems.forEach(item => {
    const gross = (item.qty || 0) * (item.price || 0);
    medTotal += gross;
    discTotal += gross * (item.discountPct || 0) / 100;
  });
  const grandTotal = Math.max(0, round2(medTotal - discTotal));
  document.getElementById('pos-total').value = grandTotal.toFixed(2);
  onPOSCashChange();
  setText('bs-med', '৳' + fmt(medTotal));
  setText('bs-disc', '৳' + fmt(discTotal));
  setText('bs-total', '৳' + fmt(grandTotal));
}

function onPOSCashChange() {
  const total = parseFloat(document.getElementById('pos-total').value) || 0;
  const cash = parseFloat(document.getElementById('pos-cash').value) || 0;
  const due = Math.max(0, round2(total - cash));
  document.getElementById('pos-due').value = due.toFixed(2);
  setText('bs-cash', '৳' + fmt(cash));
  setText('bs-due', '৳' + fmt(due));
}

// ────────────────────────────────────────────────────────────
// ✅ SUBMIT — এখন async, apiSubmitSale() সফল হলেই APP_STATE আপডেট হয়
// ────────────────────────────────────────────────────────────
async function submitPOSSale() {
  hideEl('pos-error');
  const custId = sdGetValue('sd-pos-customer');
  const validItems = APP_STATE.posItems.filter(i => i.medId && i.qty > 0);
  const total = parseFloat(document.getElementById('pos-total').value) || 0;
  const cashPaid = parseFloat(document.getElementById('pos-cash').value) || 0;
  const due = parseFloat(document.getElementById('pos-due').value) || 0;
  const date = document.getElementById('pos-date').value || todayStr();

  if (!custId) return showPOSError('গ্রাহক নির্বাচন করুন।');
  if (!validItems.length) return showPOSError('কমপক্ষে একটি ওষুধ যোগ করুন।');
  if (due > 0 && custId === 'WALK_IN') return showPOSError('বাকি রাখতে হলে নিবন্ধিত গ্রাহক নির্বাচন করুন।');

  for (const item of validItems) {
    const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
    if (!inv || item.qty > inv.totalStock) {
      return showPOSError(`"${item.name}" স্টক অপর্যাপ্ত। বর্তমান স্টক: ${inv ? inv.totalStock : 0}`);
    }
  }

  const customer = APP_STATE.customers.find(c => c.id === custId);
  const custName = custId === 'WALK_IN' ? 'নগদ গ্রাহক' : (customer?.name || custId);
  const invoiceNo = 'INV-' + Date.now();

  const sale = {
    invoiceNo, date, customerId: custId, customerName: custName,
    items: validItems.map(i => ({ ...i })),
    totalBill: total, cashPaid, due, type: due > 0 ? 'বাকি' : 'নগদ',
  };

  const btn = document.getElementById('pos-submit-btn');
  const idleHTML = '<i class="fa-solid fa-circle-check"></i> বিক্রয় নিশ্চিত করুন <span class="text-[11px] font-normal opacity-70 hidden sm:inline">(Ctrl+Enter)</span>';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> প্রক্রিয়াকরণ হচ্ছে...';

  try {
    const res = await apiSubmitSale(sale);
    if (!res.success) {
      showPOSError(res.message);
      btn.disabled = false;
      btn.innerHTML = idleHTML;
      return;
    }

    validItems.forEach(item => deductStockFEFO(item.medId, item.qty));
    if (customer) {
      if (due > 0) customer.due = round2(customer.due + due);
      if (cashPaid > 0) customer.totalPaid = round2(customer.totalPaid + cashPaid);
    }
    APP_STATE.sales.push(sale);

    toast(res.message, 's');
    resetPOS();
    renderTodayPOSSales();
    // ✅ ফিক্স: সফল হওয়ার পরও বাটন স্বাভাবিক অবস্থায় ফেরানো হচ্ছে (আগে এই লাইন মিসিং ছিল)
    btn.disabled = false;
    btn.innerHTML = idleHTML;
  } catch (err) {
    showFatalError('বিক্রয় সংরক্ষণে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.innerHTML = idleHTML;
  }
}

function showPOSError(msg) {
  const el = document.getElementById('pos-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function resetPOS() {
  APP_STATE.posItems = [];
  sdClear('sd-pos-customer');
  sdSelect('sd-pos-customer', 'WALK_IN', 'নগদ গ্রাহক (Walk-In)');
  document.getElementById('pos-cash').value = '';
  addPOSItem();
  calcPOSTotals();
  setTimeout(() => focusMedicineInput(0), 50);
}

// ────────────────────────────────────────────────────────────
// STOCK DEDUCTION — FEFO (লোকাল APP_STATE আয়না, Firestore-এর মতোই লজিক)
// ────────────────────────────────────────────────────────────
function deductStockFEFO(medId, qty) {
  const inv = APP_STATE.inventory.find(m => m.medId === medId);
  if (!inv) return;
  inv.batches.sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1);
  let remaining = qty;
  for (const b of inv.batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.stock, remaining);
    b.stock -= take;
    remaining -= take;
  }
  inv.batches = inv.batches.filter(b => b.stock > 0);
  inv.totalStock = inv.batches.reduce((a, b) => a + b.stock, 0);
  inv.costValue = round2(inv.batches.reduce((a, b) => a + b.cost * b.stock, 0));
  inv.mrpValue = round2(inv.batches.reduce((a, b) => a + b.mrp * b.stock, 0));
  inv.nearestExpiry = inv.batches[0]?.expiry || '';
  const med = APP_STATE.medicines.find(m => m.id === medId);
  const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
  inv.status = inv.totalStock === 0 ? 'out' : inv.totalStock <= reorderLevel ? 'low' : 'ok';
}

// ────────────────────────────────────────────────────────────
// TODAY'S SALES LIST
// ────────────────────────────────────────────────────────────
function renderTodayPOSSales() {
  const container = document.getElementById('pos-today-sales');
  if (!container) return;
  const today = todayStr();
  const todaySales = APP_STATE.sales.filter(s => s.date === today).slice().reverse();

  container.innerHTML = todaySales.length ? todaySales.map(s => `
    <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
      <div class="flex justify-between items-start">
        <div class="min-w-0">
          <div class="text-xs font-mono text-slate-400">${esc(s.invoiceNo)}</div>
          <div class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(s.customerName)}</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="font-mono font-bold text-sm text-slate-800 dark:text-white">৳${fmt(s.totalBill)}</div>
          ${s.due > 0 ? `<span class="text-[11px] text-red-500 font-semibold">বাকি ৳${fmt(s.due)}</span>` : `<span class="text-[11px] text-emerald-500 font-semibold">পরিশোধিত</span>`}
        </div>
      </div>
    </div>`).join('')
    : `<div class="px-4 py-8 text-center text-slate-400 text-sm"><i class="fa-solid fa-receipt text-2xl opacity-30 mb-2 block"></i>আজ কোনো বিক্রয় নেই</div>`;
}

function hideEl(id) { document.getElementById(id)?.classList.add('hidden'); }