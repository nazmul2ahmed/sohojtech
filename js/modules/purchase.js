'use strict';

// ✅ ফিক্স: pos.js-এর genInvoiceNo()-এর মতো একই কারণে — কলিশন-প্রতিরোধী
function genPurchaseId() {
  return 'PUR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}
// ════════════════════════════════════════════════════════════
// PURCHASE MODULE
// ════════════════════════════════════════════════════════════
// ✅ ফিক্স: sellPrice সরাসরি Inventory-তে রিফ্লেক্ট হয়।
// ✅ Firestore রিওয়্যার: submitPurchase() এখন apiSubmitPurchase() কল করে,
//    সফল হলেই APP_STATE-এ optimistic আপডেট হয়।
// ✅ Tab-switch persistence: সরবরাহকারী, তারিখ, পেমেন্ট টাইপ ও আইটেম এখন
//    APP_STATE-এ ধরে রাখা হয়, tab পাল্টালে হারায় না।
// ════════════════════════════════════════════════════════════

function renderPurchaseModule() {
  const container = document.getElementById('purchase-content');
  if (!container) return;

  const offlineBanner = !navigator.onLine
    ? `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 mb-3">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> অফলাইন মোড: ক্রয় সংরক্ষিত হবে, নেট ফিরলে সিঙ্ক হবে।
      </div>` : '';

  container.innerHTML = `
    ${offlineBanner}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- ══ ক্রয় ফর্ম ══ -->
      <div class="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <i class="fa-solid fa-cart-flatbed text-brand"></i> নতুন ক্রয় এন্ট্রি
          </h5>
          <button onclick="resetPurchase()" class="text-xs text-red-600 hover:underline flex items-center gap-1">
            <i class="fa-solid fa-rotate-left"></i> রিসেট
          </button>
        </div>

        <div id="pur-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-3"></div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div class="md:col-span-2">
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">সরবরাহকারী <span class="text-red-500">*</span></label>
            <div id="sd-pur-supplier"></div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">তারিখ</label>
            <input type="date" id="pur-date" onchange="APP_STATE.purDate=this.value" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          </div>
        </div>

        <div class="mb-3">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">পেমেন্ট ধরন</label>
          <div class="flex gap-2">
            <button type="button" id="pur-pay-cash" onclick="setPurPayType('নগদ')"
              class="flex-1 py-2 rounded-lg text-sm font-semibold border transition"></button>
            <button type="button" id="pur-pay-due" onclick="setPurPayType('বাকি')"
              class="flex-1 py-2 rounded-lg text-sm font-semibold border transition"></button>
          </div>
        </div>

        <div id="pur-items-list" class="space-y-2 mb-3"></div>

        <button onclick="addPurchaseItem()" class="text-brand text-sm font-semibold flex items-center gap-1.5 mb-4 hover:underline">
          <i class="fa-solid fa-plus"></i> ওষুধ যোগ করুন
        </button>

        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">মোট ক্রয়মূল্য (৳)</label>
            <input type="text" id="pur-total" readonly class="w-full px-3 py-2 text-sm font-mono font-bold bg-brand/10 text-brand border border-brand/30 rounded-lg"/>
          </div>
          <div id="pur-note-box" class="flex items-end">
            <p class="text-[11px] text-slate-400">সরবরাহকারী বাকি: স্বয়ংক্রিয় আপডেট হবে</p>
          </div>
        </div>

        <button onclick="submitPurchase()" id="pur-submit-btn"
          class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition">
          <i class="fa-solid fa-boxes-packing"></i> ক্রয় নিশ্চিত করুন
          <span class="text-[11px] font-normal opacity-70 hidden sm:inline">(Ctrl+Enter)</span>
        </button>
      </div>

      <!-- ══ সাইড প্যানেল ══ -->
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-fit">
        <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
          <h6 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-clock-rotate-left text-brand mr-1"></i> ক্রয় তালিকা</h6>
          <input type="date" id="pur-list-date" value="${APP_STATE.purListDate || todayStr()}" onchange="onPurListDateChange(this.value)"
            class="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div id="pur-today-list" class="max-h-96 overflow-y-auto"></div>
      </div>
    </div>
  `;

  initPurSupplierDropdown();
  document.getElementById('pur-date').value = APP_STATE.purDate || todayStr();
  if (!APP_STATE.purItems || !APP_STATE.purItems.length) { APP_STATE.purItems = []; addPurchaseItem(); }
  else { renderPurItems(); }
  if (!APP_STATE.purPayType) APP_STATE.purPayType = 'নগদ';
  updatePurPayTypeUI();
  calcPurTotal();
  renderTodayPurchases();

  setTimeout(() => focusPurMedicineInput(0), 50);
}

// ────────────────────────────────────────────────────────────
// SUPPLIER DROPDOWN
// ────────────────────────────────────────────────────────────
function initPurSupplierDropdown() {
  const opts = APP_STATE.suppliers.map(s => ({
    value: s.id, label: s.name, sub: s.phone || '',
    badge: s.totalPayable > 0 ? `বাকি ৳${fmt(s.totalPayable)}` : null,
    badgeClass: 'bg-amber-50 text-amber-600',
  }));
  createSD('sd-pur-supplier', opts, (v) => { APP_STATE.purSupplierId = v; }, '— সরবরাহকারী খুঁজুন —');
  if (APP_STATE.purSupplierId) {
    const matched = opts.find(o => o.value === APP_STATE.purSupplierId);
    if (matched) sdSelect('sd-pur-supplier', matched.value, matched.label);
    else APP_STATE.purSupplierId = null;
  }
}

// ────────────────────────────────────────────────────────────
// PAYMENT TYPE TOGGLE
// ────────────────────────────────────────────────────────────
function setPurPayType(type) {
  APP_STATE.purPayType = type;
  updatePurPayTypeUI();
}

function updatePurPayTypeUI() {
  const isCash = APP_STATE.purPayType === 'নগদ';
  const cashBtn = document.getElementById('pur-pay-cash');
  const dueBtn = document.getElementById('pur-pay-due');
  if (!cashBtn) return;
  cashBtn.textContent = 'নগদ';
  dueBtn.textContent = 'বাকি (সরবরাহকারী পাওনা)';
  cashBtn.className = `flex-1 py-2 rounded-lg text-sm font-semibold border transition ${isCash ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`;
  dueBtn.className = `flex-1 py-2 rounded-lg text-sm font-semibold border transition ${!isCash ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`;
  const noteBox = document.getElementById('pur-note-box');
  noteBox.innerHTML = isCash
    ? `<p class="text-[11px] text-slate-400">নগদে ক্রয় — আজকের Cash Flow-এ ব্যয় হিসেবে যোগ হবে</p>`
    : `<p class="text-[11px] text-amber-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>সরবরাহকারীর পাওনা বাড়বে; নগদ ব্যয় হবে না</p>`;
}

// ────────────────────────────────────────────────────────────
// ITEM ROWS
// ────────────────────────────────────────────────────────────
function addPurchaseItem() {
  APP_STATE.purItems.push({ medId: '', brand: '', qty: 1, purchasePrice: 0, mrp: 0, sellPrice: 0, expiryDate: '' });
  renderPurItems();
}

function removePurchaseItem(i) {
  if (APP_STATE.purItems.length <= 1) { toast('কমপক্ষে একটি সারি থাকতে হবে।', 'w'); return; }
  closeMedDisambiguation();
  APP_STATE.purItems.splice(i, 1);
  renderPurItems();
  calcPurTotal();
}

function renderPurItems() {
  const container = document.getElementById('pur-items-list');
  if (!container) return;

  container.innerHTML = APP_STATE.purItems.map((item, i) => {
    const displayVal = item.medId ? buildPurMedDisplayText(item) : '';
    return `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-3 relative bg-slate-50 dark:bg-slate-900/30">
      <button onclick="removePurchaseItem(${i})" class="absolute top-2 right-2 text-slate-400 hover:text-red-500">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="grid grid-cols-12 gap-2">
        <div class="col-span-12 md:col-span-4">
          <label class="block text-[11px] text-slate-400 mb-1">ওষুধ <span class="text-red-500">*</span></label>
          <input type="text" id="pur-med-input-${i}" list="pur-med-list-${i}" value="${esc(displayVal)}"
            placeholder="— ওষুধ সার্চ করুন —" autocomplete="off"
            onchange="onPurMedicineChange(${i})" onkeydown="onPurMedicineKeydown(event, ${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          <datalist id="pur-med-list-${i}">
            ${APP_STATE.medicines.map(m => `<option value="${esc(m.brand + ' ' + (m.doseForm||'') + ' ' + (m.strength||''))}"></option>`).join('')}
          </datalist>
        </div>
        <div class="col-span-3 md:col-span-1">
          <label class="block text-[11px] text-slate-400 mb-1">Qty</label>
          <input type="number" id="pur-qty-${i}" value="${item.qty}" min="1" onkeydown="onPurFieldKeydown(event,${i})" oninput="onPurFieldChange(${i})" onblur="onPurFieldBlur(${i})"
            class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-3 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">ক্রয় মূল্য</label>
          <input type="number" id="pur-price-${i}" value="${item.purchasePrice}" min="0" step="0.01" onkeydown="onPurFieldKeydown(event,${i})" oninput="onPurFieldChange(${i})" onblur="onPurFieldBlur(${i})"
            class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-3 md:col-span-1">
          <label class="block text-[11px] text-slate-400 mb-1">MRP</label>
          <input type="number" id="pur-mrp-${i}" value="${item.mrp}" min="0" step="0.01" onkeydown="onPurFieldKeydown(event,${i})" oninput="onPurFieldChange(${i})" onblur="onPurFieldBlur(${i})"
            class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-3 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">বিক্রয় মূল্য</label>
          <input type="number" id="pur-sell-${i}" value="${item.sellPrice}" min="0" step="0.01" onkeydown="onPurFieldKeydown(event,${i})" oninput="onPurFieldChange(${i})" onblur="onPurFieldBlur(${i})"
            class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-6 md:col-span-1">
          <label class="block text-[11px] text-slate-400 mb-1">মেয়াদ</label>
          <input type="text" id="pur-exp-${i}" value="${esc(item.expiryDate)}" placeholder="MM/YYYY" onkeydown="onPurFieldKeydown(event,${i})" oninput="onPurFieldChange(${i})"
            class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-6 md:col-span-1 flex flex-col justify-end">
          <label class="block text-[11px] text-slate-400 mb-1">লাইন টোটাল</label>
          <div id="pur-linetotal-${i}" class="px-2 py-1.5 text-sm font-mono font-bold text-brand truncate">৳০.০০</div>
        </div>
      </div>
    </div>`;
  }).join('');

  APP_STATE.purItems.forEach((_, i) => updatePurLineTotal(i));
}

function buildPurMedDisplayText(item) {
  return `${item.brand} ${item.doseForm || ''} ${item.strength || ''}`.trim();
}

function resolvePurMedicineInput(i, opts = {}) {
  const inputEl = document.getElementById(`pur-med-input-${i}`);
  if (!inputEl) return;
  const val = inputEl.value;
  const textFn = (m) => `${m.brand} ${m.doseForm || ''} ${m.strength || ''}`.trim();
  const result = resolveMedicineMatch(val, APP_STATE.medicines, textFn);
  if (result.type === 'exact') {
    closeMedDisambiguation();
    applyMedicineToPurItem(i, result.match);
    if (opts.onResolved) opts.onResolved(result.match);
    return;
  }
  if (result.type === 'ambiguous') {
    showMedDisambiguation(inputEl, result.matches, textFn, (chosen) => {
      inputEl.value = textFn(chosen);
      applyMedicineToPurItem(i, chosen);
      if (opts.onResolved) opts.onResolved(chosen);
    });
    return;
  }
  applyMedicineToPurItem(i, null);
  if (opts.notFoundToast && val.trim()) toast('ওষুধ খুঁজে পাওয়া যায়নি।', 'w');
}

function onPurMedicineChange(i) {
  resolvePurMedicineInput(i);
}

function applyMedicineToPurItem(i, med) {
  if (med) {
    const inv = APP_STATE.inventory.find(x => x.medId === med.id);
    const lastBatch = inv?.batches?.[0];
    APP_STATE.purItems[i] = {
      medId: med.id, brand: med.brand, doseForm: med.doseForm, strength: med.strength,
      qty: APP_STATE.purItems[i].qty || 1,
      purchasePrice: lastBatch?.cost || 0, mrp: lastBatch?.mrp || 0, sellPrice: inv?.sellPrice || 0,
      expiryDate: '',
    };
    document.getElementById(`pur-price-${i}`).value = APP_STATE.purItems[i].purchasePrice;
    document.getElementById(`pur-mrp-${i}`).value = APP_STATE.purItems[i].mrp;
    document.getElementById(`pur-sell-${i}`).value = APP_STATE.purItems[i].sellPrice;
  } else {
    APP_STATE.purItems[i] = { medId: '', brand: '', qty: 1, purchasePrice: 0, mrp: 0, sellPrice: 0, expiryDate: '' };
  }
  updatePurLineTotal(i);
  calcPurTotal();
}

function onPurFieldChange(i) {
  // ✅ ধাপ ০.২: qty/purchasePrice/mrp/sellPrice সবই >= 0 বাধ্যতামূলক
  const qty = Math.max(0, parseFloat(document.getElementById(`pur-qty-${i}`).value) || 0);
  const purchasePrice = Math.max(0, parseFloat(document.getElementById(`pur-price-${i}`).value) || 0);
  const mrp = Math.max(0, parseFloat(document.getElementById(`pur-mrp-${i}`).value) || 0);
  const sellPrice = Math.max(0, parseFloat(document.getElementById(`pur-sell-${i}`).value) || 0);

  APP_STATE.purItems[i].qty = qty;
  APP_STATE.purItems[i].purchasePrice = purchasePrice;
  APP_STATE.purItems[i].mrp = mrp;
  APP_STATE.purItems[i].sellPrice = sellPrice;
  APP_STATE.purItems[i].expiryDate = document.getElementById(`pur-exp-${i}`).value || '';
  updatePurLineTotal(i);
  calcPurTotal();
}

// ✅ ধাপ ০.২: blur-sync (pos.js-এর একই প্যাটার্ন)
function onPurFieldBlur(i) {
  const item = APP_STATE.purItems[i];
  if (!item) return;
  const qtyEl = document.getElementById(`pur-qty-${i}`);
  const priceEl = document.getElementById(`pur-price-${i}`);
  const mrpEl = document.getElementById(`pur-mrp-${i}`);
  const sellEl = document.getElementById(`pur-sell-${i}`);
  if (qtyEl) qtyEl.value = item.qty;
  if (priceEl) priceEl.value = item.purchasePrice;
  if (mrpEl) mrpEl.value = item.mrp;
  if (sellEl) sellEl.value = item.sellPrice;
}

function updatePurLineTotal(i) {
  const item = APP_STATE.purItems[i];
  const lineTotal = round2((item.qty || 0) * (item.purchasePrice || 0));
  const el = document.getElementById(`pur-linetotal-${i}`);
  if (el) el.textContent = '৳' + fmt(lineTotal);
}

// ────────────────────────────────────────────────────────────
// ⌨️ KEYBOARD FLOW
// ────────────────────────────────────────────────────────────
function onPurMedicineKeydown(e, i) {
  const inputEl = document.getElementById(`pur-med-input-${i}`);
  if (isMedDisambiguationOpenFor(inputEl) && medDisambiguationHandleKey(e)) return;
  if (e.key !== 'Enter') return;
  e.preventDefault();
  resolvePurMedicineInput(i, {
    notFoundToast: true,
    onResolved: () => {
      document.getElementById(`pur-qty-${i}`)?.focus();
      document.getElementById(`pur-qty-${i}`)?.select();
    },
  });
}

function onPurFieldKeydown(e, i) {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (i + 1 >= APP_STATE.purItems.length) {
      addPurchaseItem();
      setTimeout(() => focusPurMedicineInput(APP_STATE.purItems.length - 1), 30);
    } else {
      focusPurMedicineInput(i + 1);
    }
  }
}

function focusPurMedicineInput(i) {
  document.getElementById(`pur-med-input-${i}`)?.focus();
}

document.addEventListener('keydown', (e) => {
  if (APP_STATE.currentTab === 'purchase' && e.ctrlKey && e.key === 'Enter') {
    e.preventDefault();
    submitPurchase();
  }
});

// ────────────────────────────────────────────────────────────
// TOTAL
// ────────────────────────────────────────────────────────────
function calcPurTotal() {
  const total = APP_STATE.purItems.reduce((a, item) => a + (item.qty || 0) * (item.purchasePrice || 0), 0);
  document.getElementById('pur-total').value = round2(total).toFixed(2);
}

// ────────────────────────────────────────────────────────────
// ✅ SUBMIT — এখন async, apiSubmitPurchase() সফল হলেই APP_STATE আপডেট হয়
// ────────────────────────────────────────────────────────────
async function submitPurchase() {
  if (guardReadOnly()) return;
  hideEl('pur-error');
  const supId = sdGetValue('sd-pur-supplier');
  const date = document.getElementById('pur-date').value || todayStr();
  const payType = APP_STATE.purPayType || 'নগদ';
  const validItems = APP_STATE.purItems.filter(i => i.medId && i.qty > 0 && i.purchasePrice >= 0);

  if (!supId) return showPurError('সরবরাহকারী নির্বাচন করুন।');
  if (!validItems.length) return showPurError('কমপক্ষে একটি ওষুধ যোগ করুন।');

  const supplier = APP_STATE.suppliers.find(s => s.id === supId);
  const totalCost = round2(validItems.reduce((a, i) => a + i.qty * i.purchasePrice, 0));
  const purchaseId = genPurchaseId();

  const itemsWithReorder = validItems.map(i => {
    const med = APP_STATE.medicines.find(m => m.id === i.medId);
    return { ...i, reorderLevel: med?.reorderLevel || APP_STATE.lowStockLevel || 10 };
  });

  const purchase = {
    purchaseId, date, supplierId: supId, supplierName: supplier?.name || supId,
    items: itemsWithReorder,
    totalCost, paymentType: payType,
    medicineName: validItems.map(i => i.brand).join(', '),
  };

  const btn = document.getElementById('pur-submit-btn');
  const idleHTML = '<i class="fa-solid fa-boxes-packing"></i> ক্রয় নিশ্চিত করুন <span class="text-[11px] font-normal opacity-70 hidden sm:inline">(Ctrl+Enter)</span>';
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> প্রক্রিয়াকরণ হচ্ছে...';

  try {
    const res = await apiSubmitPurchase(purchase);
    if (!res.success) {
      showPurError(res.message);
      btn.disabled = false;
      btn.innerHTML = idleHTML;
      return;
    }

    if (res.queued) {
      toast(res.message, 'w');
      resetPurchase();
      refreshSyncBadge();
      openReceiptModal('purchase', purchase); // ✅ ধাপ ৩০
    } else {
      validItems.forEach(item => addPurchaseBatch(item, date));
      APP_STATE.purchases.push(purchase);
      if (supplier) {
        if (payType === 'বাকি') applySupplierPayableChange(supId, totalCost, 0);
        else applySupplierPayableChange(supId, 0, totalCost);
      }
      toast(res.message, 's');
      resetPurchase();
      renderTodayPurchases();
      openReceiptModal('purchase', purchase); // ✅ ধাপ ৩০
    }
    btn.disabled = false;
    btn.innerHTML = idleHTML;
  } catch (err) {
    showFatalError('ক্রয় সংরক্ষণে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.innerHTML = idleHTML;
  }
}

// ✅ ফিক্স: sellPrice সরাসরি Inventory-তে আপডেট হচ্ছে
function addPurchaseBatch(item, date) {
  const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
  if (!inv) return;
  const batchId = 'BAT-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  inv.batches.push({
    batchId, expiry: item.expiryDate || '', stock: item.qty,
    cost: item.purchasePrice, mrp: item.mrp, sell: item.sellPrice || inv.sellPrice,
  });
  inv.batches.sort((a, b) => compareBatchExpiry(a, b, 'asc')); // ✅ ধাপ ৩১ ফিক্স
  inv.totalStock = inv.batches.reduce((a, b) => a + b.stock, 0);
  inv.costValue = round2(inv.batches.reduce((a, b) => a + b.cost * b.stock, 0));
  inv.mrpValue = round2(inv.batches.reduce((a, b) => a + b.mrp * b.stock, 0));
  inv.nearestExpiry = inv.batches[0]?.expiry || '';
  if (item.sellPrice > 0) inv.sellPrice = item.sellPrice;

  const med = APP_STATE.medicines.find(m => m.id === item.medId);
  const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
  inv.status = inv.totalStock === 0 ? 'out' : inv.totalStock <= reorderLevel ? 'low' : 'ok';
}

function showPurError(msg) {
  const el = document.getElementById('pur-error');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function resetPurchase() {
  closeMedDisambiguation();
  APP_STATE.purDate = null; APP_STATE.purSupplierId = null; APP_STATE.purPayType = 'নগদ';
  APP_STATE.purItems = [];
  sdClear('sd-pur-supplier');
  addPurchaseItem();
  updatePurPayTypeUI();
  calcPurTotal();
  setTimeout(() => focusPurMedicineInput(0), 50);
}

// ────────────────────────────────────────────────────────────
// TODAY'S PURCHASE LIST
// ────────────────────────────────────────────────────────────
function onPurListDateChange(val) {
  APP_STATE.purListDate = val || todayStr();
  renderTodayPurchases();
}

function renderTodayPurchases() {
  const container = document.getElementById('pur-today-list');
  if (!container) return;
  const filterDate = APP_STATE.purListDate || todayStr();
  const listPur = APP_STATE.purchases.filter(p => p.date === filterDate).slice().reverse();

  const capHint = capHintHTML('purchases', 'pur-load-older-btn', 'renderTodayPurchases', 'সাম্প্রতিক ৮,০০০টার বেশি ক্রয় থাকলে পুরনো তারিখের এন্ট্রি এখনো নাও দেখাতে পারে।');

  container.innerHTML = capHint + (listPur.length ? listPur.map(p => `
    <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
      <div class="flex justify-between items-start">
        <div class="min-w-0">
          <div class="text-xs font-mono text-slate-400">${esc(p.purchaseId)}</div>
          <div class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(p.supplierName)}</div>
          <div class="text-[11px] text-slate-400 truncate">${esc(p.medicineName)}</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="font-mono font-bold text-sm text-slate-800 dark:text-white">৳${fmt(p.totalCost)}</div>
          <span class="text-[11px] font-semibold ${p.paymentType === 'বাকি' ? 'text-amber-500' : 'text-emerald-500'}">${esc(p.paymentType)}</span>
          <div class="flex items-center gap-2 justify-end mt-1">
            <button onclick="reprintPurchaseReceipt('${p.purchaseId}')" class="text-slate-400 hover:text-brand text-xs"><i class="fa-solid fa-print"></i></button>
            <button onclick="deletePurchaseConfirm('${p.purchaseId}')" class="text-red-400 hover:text-red-600 text-xs"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>`).join('')
    : `<div class="px-4 py-8 text-center text-slate-400 text-sm"><i class="fa-solid fa-truck-field text-2xl opacity-30 mb-2 block"></i>এই তারিখে কোনো ক্রয় নেই</div>`);
}

// ────────────────────────────────────────────────────────────
// DELETE PURCHASE
// ────────────────────────────────────────────────────────────
async function deletePurchaseConfirm(purchaseId) {
  if (guardReadOnly()) return;
  const pur = APP_STATE.purchases.find(p => p.purchaseId === purchaseId);
  if (!pur || !confirm(`"${purchaseId}" মুছবেন? স্টক/পাওনা ফেরত হবে।`)) return;
  try {
    const res = await apiDeletePurchase(pur);
    if (!res.success) return toast(res.message, 'w');
    pur.items.forEach(item => {
      const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
      if (inv) { inv.batches = inv.batches.filter(b => b.batchId !== item.batchId); recalcInventoryRow(inv); }
    });
    if (pur.paymentType === 'বাকি') applySupplierPayableChange(pur.supplierId, -pur.totalCost, 0);
    else applySupplierPayableChange(pur.supplierId, 0, -pur.totalCost);
    APP_STATE.purchases = APP_STATE.purchases.filter(p => p.purchaseId !== purchaseId);
    toast(res.message, 's');
    renderTodayPurchases();
  } catch (err) { showFatalError('ক্রয় মুছতে সমস্যা:\n' + err.message); }
}
