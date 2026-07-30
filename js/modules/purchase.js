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
// ✅ AI ইনভয়েস-স্ক্যান (Step 4 + money-critical reconciliation): AI কখনো
//    টাকার arithmetic করে না — শুধু raw unit_tp/unit_vat/qty/line_total_printed
//    ট্রান্সক্রাইব করে, সব যোগ/গুণ/ভাগ এখানে JS-এ deterministic ভাবে হয়।
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
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <i class="fa-solid fa-cart-flatbed text-brand"></i> নতুন ক্রয় এন্ট্রি
          </h5>
          <div class="flex items-center gap-3">
            <button onclick="openPurInvoiceScanModal()" class="text-xs text-brand hover:underline flex items-center gap-1">
              <i class="fa-solid fa-camera"></i> AI দিয়ে স্ক্যান করুন
            </button>
            <button onclick="resetPurchase()" class="text-xs text-red-600 hover:underline flex items-center gap-1">
              <i class="fa-solid fa-rotate-left"></i> রিসেট
            </button>
          </div>
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
            <button type="button" id="pur-pay-cash" onclick="setPurPayType('নগদ')" class="btn flex-1"></button>
            <button type="button" id="pur-pay-due" onclick="setPurPayType('বাকি')" class="btn flex-1"></button>
          </div>
        </div>

        <div id="pur-ai-reconcile-box"></div>
        <div id="pur-items-list" class="space-y-2 mb-3"></div>

        <button onclick="addPurchaseItem()" class="btn btn-brand-outline btn-sm mb-4">
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

        <button onclick="submitPurchase()" id="pur-submit-btn" class="btn btn-primary btn-block">
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
  cashBtn.className = `btn flex-1 ${isCash ? 'btn-primary' : 'btn-secondary'}`;
  dueBtn.className = `btn flex-1 ${!isCash ? 'btn-warning' : 'btn-secondary'}`;
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
    const displayVal = item.medId ? buildPurMedDisplayText(item) : (item.aiRawBrand || '');
    const aiBadge = item.aiScanned
      ? (item.aiMatched
          ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 ml-1">✨ AI যাচাই করেছে</span>`
          : `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 ml-1" title="AI পড়েছে: ${esc(item.aiRawBrand || '')}">⚠️ AI: মেলেনি, নির্বাচন করুন</span>`)
      : '';
    // ✅ দাম-যাচাই ব্যাজ — verified (ছাপা লাইন-টোটালের সাথে মিলেছে) /
    // mismatch (আছে কিন্তু মেলেনি, সাবধান) / unverifiable (কোনো লাইন-টোটাল ছাপা নেই)
    const priceBadge = item.aiScanned ? (() => {
      if (item.aiPriceStatus === 'verified') return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 ml-1" title="ইনভয়েসের লাইন-টোটালের সাথে মিলেছে">💰 দাম যাচাই হয়েছে</span>`;
      if (item.aiPriceStatus === 'mismatch') return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 ml-1" title="ইনভয়েসে ছাপা: ৳${fmt(item.aiLineTotalPrinted || 0)}, হিসাবকৃত: ৳${fmt(round2(item.qty * item.purchasePrice))}">⚠️ দামে অমিল — চেক করুন</span>`;
      return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-1">দাম স্বয়ং-যাচাই করুন</span>`;
    })() : '';
    // ✅ unit_type বনাম doseForm mismatch
    const doseFormBadge = item.aiScanned && item.aiDoseFormMismatch
      ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 ml-1" title="AI packaging দেখে '${esc(item.aiUnitType)}' মনে করেছে, কিন্তু ওষুধ মাস্টারে ডোজ-ফর্ম '${esc(item.doseForm)}' — মিলছে না, ভুল ওষুধ ম্যাচ হয়ে থাকতে পারে">🔀 ডোজ-ফর্ম অমিল</span>`
      : '';
    // ✅ pack-size ইনলাইন-এডিট — শুধু AI-স্ক্যান করা রো-তে দেখাবে
    const packSizeRow = item.aiScanned ? `
      <div class="col-span-12 flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
        <i class="fa-solid fa-wand-magic-sparkles text-brand"></i>
        AI অনুমান: ইনভয়েসে ${item.aiInvoicedQty} প্যাক, প্রতি প্যাকে
        <input type="number" id="pur-ai-packsize-${i}" value="${item.aiBaseUnitsPerPack}" min="1"
          onchange="onPurAiPackSizeChange(${i})"
          class="w-16 px-1.5 py-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        পিস — ভুল মনে হলে বদলে দিন (টাকার হিসাব প্রভাবিত হবে না, শুধু স্টক-গণনা ঠিক হবে)
      </div>` : '';
    return `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-3 relative bg-slate-50 dark:bg-slate-900/30">
      <button onclick="removePurchaseItem(${i})" class="absolute top-2 right-2 text-slate-400 hover:text-red-500">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="grid grid-cols-12 gap-2">
        <div class="col-span-12 md:col-span-4">
          <label class="block text-[11px] text-slate-400 mb-1 flex items-center flex-wrap">ওষুধ <span class="text-red-500">*</span>${aiBadge}${priceBadge}${doseFormBadge}</label>
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
        ${packSizeRow}
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
  renderAiReconciliationBanner(round2(total));
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
    showFatalError('ক্রয় সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
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
  APP_STATE.purAiInvoiceTotal = null; // ✅ রিসেটে AI-reconciliation স্টেটও পরিষ্কার
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
  } catch (err) { showFatalError('ক্রয় মুছতে সমস্যা:\n' + humanizeError(err), err); }
}

// ════════════════════════════════════════════════════════════
// ✅ Step 4 — AI ইনভয়েস স্ক্যান — ছবি থেকে ক্রয়-এন্ট্রি pre-fill
// (human-confirmation gate: শুধু APP_STATE.purItems[] pre-fill হয়,
// submitPurchase() না চাপা পর্যন্ত কিছুই Firestore-এ যায় না)
// ════════════════════════════════════════════════════════════
const PUR_SCAN_MAX_DIM = 2400;
const PUR_SCAN_JPEG_QUALITY = 0.85;
const PUR_SCAN_MAX_BYTES = 1800 * 1024; // ✅ টেস্ট: ১৮০০ KB — ছোট সংখ্যা/টেক্সট স্পষ্ট রাখতে রেজোলিউশন/কোয়ালিটি বাড়ানো হয়েছে

function compressInvoiceImageFile(file) {
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
        const scale = Math.min(1, PUR_SCAN_MAX_DIM / Math.max(w, h));
        w = Math.max(1, Math.round(w * scale));
        h = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', PUR_SCAN_JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error('ছবি পড়া যায়নি — ফাইলটা corrupted হতে পারে।'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('ফাইল রিড করতে ব্যর্থ।'));
    reader.readAsDataURL(file);
  });
}

let _purScanImageBase64 = null;

function openPurInvoiceScanModal() {
  if (guardReadOnly()) return;
  if (document.getElementById('pur-scan-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'pur-scan-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-camera text-brand mr-1"></i> ইনভয়েস স্ক্যান করুন (AI)</h4>
      <p class="text-xs text-slate-400 mb-4">ক্রয়-ইনভয়েসের ছবি তুলুন বা আপলোড করুন — AI প্রতিটা লাইন-আইটেম পড়ে ফর্মে বসিয়ে দেবে। <b>কিছুই সরাসরি সংরক্ষণ হবে না</b> — আপনাকে যাচাই করে "ক্রয় নিশ্চিত করুন" চাপতেই হবে।</p>
      <div id="pur-scan-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>

      <div id="pur-scan-preview-box" class="mb-3"></div>

      <input type="file" id="pur-scan-file" accept="image/*" capture="environment" class="hidden" onchange="onPurScanFileSelect(event)"/>
      <label for="pur-scan-file" class="btn btn-brand-outline btn-block cursor-pointer mb-3">
        <i class="fa-solid fa-image mr-1"></i> ছবি বাছাই করুন
      </label>

      <div class="flex gap-2">
        <button id="pur-scan-submit-btn" onclick="runPurInvoiceScan()" class="btn btn-primary flex-1" disabled>
          <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> স্ক্যান করুন
        </button>
        <button onclick="closePurScanModal()" class="btn btn-secondary">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('pur-scan-modal', closePurScanModal);
}

function closePurScanModal() {
  document.getElementById('pur-scan-modal')?.remove();
  _purScanImageBase64 = null;
}

async function onPurScanFileSelect(event) {
  const errEl = document.getElementById('pur-scan-error');
  errEl.classList.add('hidden');
  const file = event.target.files[0];
  if (!file) return;

  const previewBox = document.getElementById('pur-scan-preview-box');
  previewBox.innerHTML = `<div class="text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> ছবি প্রসেস হচ্ছে...</div>`;

  try {
    const dataUrl = await compressInvoiceImageFile(file);
    if (dataUrl.length > PUR_SCAN_MAX_BYTES) {
      throw new Error('কম্প্রেস করার পরও ছবির সাইজ বড় — আরও স্পষ্ট/কাছ থেকে তোলা ছোট একটা ছবি ব্যবহার করুন।');
    }
    _purScanImageBase64 = dataUrl;
    previewBox.innerHTML = `<img src="${dataUrl}" class="w-full max-h-48 object-contain border border-slate-200 dark:border-slate-600 rounded-lg bg-white"/>`;
    document.getElementById('pur-scan-submit-btn').disabled = false;
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    previewBox.innerHTML = '';
    _purScanImageBase64 = null;
    document.getElementById('pur-scan-submit-btn').disabled = true;
  } finally {
    event.target.value = '';
  }
}

async function runPurInvoiceScan() {
  if (!_purScanImageBase64) return;
  const errEl = document.getElementById('pur-scan-error');
  errEl.classList.add('hidden');
  const btn = document.getElementById('pur-scan-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> AI পড়ছে...';

  try {
    // data URL-এর prefix (data:image/jpeg;base64,) বাদ — AiProxy.gs raw base64 আশা করে
    const base64Only = _purScanImageBase64.split(',')[1];
    const res = await callAiTask('purchaseInvoiceReader', { imageBase64: base64Only });
    const items = (res.data && res.data.items) || [];
    if (!items.length) {
      throw new Error('কোনো লাইন-আইটেম শনাক্ত করা যায়নি — ছবিটা স্পষ্ট কিনা যাচাই করে আবার চেষ্টা করুন, অথবা ম্যানুয়ালি এন্ট্রি করুন।');
    }
    applyAiScannedItemsToPurchaseForm(items, res.data && res.data.invoice_total);
    toast(`AI ${items.length}টা লাইন-আইটেম পড়েছে — প্রতিটা যাচাই করে "ক্রয় নিশ্চিত করুন" চাপুন।`, 's');
    closePurScanModal();
  } catch (err) {
    errEl.textContent = humanizeError(err);
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles mr-1"></i> স্ক্যান করুন';
  }
}

// ✅ AI-প্রাপ্ত brand নাম দিয়ে বিদ্যমান medicine-এ ম্যাচ — AI ডোজ-ফর্ম/শক্তি দেয়
// না বলে resolveMedicineMatch() reuse না করে আলাদা সরল brand-only matcher।
// exact-single বা partial-single হলেই auto-select; নাহলে (০ বা ১+ ম্যাচ) খালি
// রেখে ইউজারকে ম্যানুয়ালি বাছতে দেওয়া হয় — silent-wrong-selection এড়াতে।
function fuzzyMatchAiBrandToMedicine(aiBrand) {
  const q = String(aiBrand || '').trim().toLowerCase();
  if (!q) return null;
  const exact = APP_STATE.medicines.filter(m => m.brand.trim().toLowerCase() === q);
  if (exact.length === 1) return exact[0];
  const partial = APP_STATE.medicines.filter(m =>
    m.brand.toLowerCase().includes(q) || q.includes(m.brand.toLowerCase())
  );
  if (partial.length === 1) return partial[0];
  return null;
}

// MM/YYYY প্রত্যাশিত, কিন্তু M/YYYY বা MM-YYYY এর মতো সামান্য বিচ্যুতিও হ্যান্ডল করে
function normalizeAiExpiry(val) {
  if (!val) return '';
  const m = String(val).match(/(\d{1,2})[\/\-](\d{4})/);
  if (!m) return '';
  return String(m[1]).padStart(2, '0') + '/' + m[2];
}

// ✅ unit_type (AI-detected packaging category) বনাম medicine master-এর doseForm —
// mismatch হলে silent-trust না করে flag করা হয় (patient-safety/data-integrity philosophy-এর
// সম্প্রসারণ, ঠিক resolveMedicineMatch()-এর disambiguation-এর মতোই)। "pot" ইচ্ছাকৃতভাবে
// বাদ — এটা আলগা ট্যাবলেট/পাউডার দুটোই হতে পারে, doseForm-এর সাথে নির্দিষ্টভাবে মেলে না।
const UNIT_TYPE_DOSEFORM_MAP = {
  piece: ['ট্যাবলেট', 'ক্যাপসুল', 'সাপোজিটরি'],
  bottle: ['সিরাপ', 'ড্রপস', 'ইনজেকশন', 'ইনহেলার'],
  tube: ['ক্রিম/মলম'],
};

function checkDoseFormMismatch(unitType, doseForm) {
  const allowed = UNIT_TYPE_DOSEFORM_MAP[unitType];
  if (!allowed) return false; // "pot" বা অজানা unit_type — validation skip
  return !allowed.includes(doseForm);
}

// ✅ money-critical অংশ — VAT-যোগ ও per-unit division সম্পূর্ণ JS-এ, AI কখনো
// এই arithmetic করে না। lineTotalComputed = invoiced_qty × total_net_pack_price,
// যেটা base_units_per_pack থেকে independent (গাণিতিকভাবে বাতিল হয়ে যায়) —
// তাই pack-size অনুমান ভুল হলেও টাকার রিকনসিলিয়েশন প্রভাবিত হয় না।
// per_unit_cost এখন সরাসরি lineTotalComputed ÷ qty (মোট-পিস) থেকে — dimensionally
// সরাসরি "লাইনের মোট টাকা ÷ মোট পিস", totalNetPackPrice÷baseUnitsPerPack-এর
// সাথে গাণিতিকভাবে অভিন্ন কিন্তু pack-size-independence টা কোডেও স্পষ্ট দেখায়।
const AI_LINE_TOLERANCE = 0.05; // ৳ — শুধু রাউন্ডিং-জনিত সামান্য পার্থক্য মেনে নেওয়ার জন্য

function computeAiLineData(ai) {
  const invoicedQty = Math.max(0, parseFloat(ai.invoiced_qty) || 0);
  const baseUnitsPerPack = Math.max(1, parseFloat(ai.base_units_per_pack) || 1);
  const unitTp = ai.unit_tp !== null && ai.unit_tp !== undefined ? parseFloat(ai.unit_tp) || 0 : 0;
  const unitVat = ai.unit_vat !== null && ai.unit_vat !== undefined ? parseFloat(ai.unit_vat) || 0 : 0;
  const totalNetPackPrice = round2(unitTp + unitVat); // ✅ VAT merged — final unit-cost-এ মিশিয়ে ফেলা, আলাদা ফিল্ড না

  const qty = Math.round(invoicedQty * baseUnitsPerPack); // total_base_qty
  const lineTotalComputed = round2(invoicedQty * totalNetPackPrice); // পুরো লাইনের মোট টাকা — pack-size থেকে independent
  const purchasePrice = qty > 0 ? round2(lineTotalComputed / qty) : 0; // লাইন-টোটাল ÷ মোট-পিস

  const printed = ai.line_total_printed !== null && ai.line_total_printed !== undefined
    ? parseFloat(ai.line_total_printed) : null;

  let priceStatus; // 'verified' | 'mismatch' | 'unverifiable'
  if (printed === null || isNaN(printed)) priceStatus = 'unverifiable';
  else priceStatus = Math.abs(lineTotalComputed - printed) <= AI_LINE_TOLERANCE ? 'verified' : 'mismatch';

  return {
    qty, purchasePrice, invoicedQty, baseUnitsPerPack, totalNetPackPrice,
    lineTotalComputed, lineTotalPrinted: printed, priceStatus,
  };
}

function applyAiScannedItemsToPurchaseForm(aiItems, invoiceTotal) {
  closeMedDisambiguation();
  const newRows = aiItems.map(ai => {
    const matched = fuzzyMatchAiBrandToMedicine(ai.brand);
    const lineData = computeAiLineData(ai);
    const mrp = Math.max(0, parseFloat(ai.mrp) || 0);
    const expiryDate = normalizeAiExpiry(ai.expiry_date);
    const unitType = ai.unit_type || '';
    const doseFormMismatch = matched ? checkDoseFormMismatch(unitType, matched.doseForm) : false;

    const common = {
      qty: lineData.qty, purchasePrice: lineData.purchasePrice, mrp, expiryDate,
      aiScanned: true,
      aiInvoicedQty: lineData.invoicedQty, aiBaseUnitsPerPack: lineData.baseUnitsPerPack,
      aiTotalNetPackPrice: lineData.totalNetPackPrice,
      aiPriceStatus: lineData.priceStatus, aiLineTotalPrinted: lineData.lineTotalPrinted,
      aiUnitType: unitType, aiDoseFormMismatch: doseFormMismatch, aiBatchNo: ai.batch_no || '',
    };

    if (matched) {
      const inv = APP_STATE.inventory.find(x => x.medId === matched.id);
      return {
        ...common,
        medId: matched.id, brand: matched.brand, doseForm: matched.doseForm, strength: matched.strength,
        sellPrice: inv?.sellPrice || 0,
        aiMatched: true, aiRawBrand: ai.brand || '',
      };
    }
    return {
      ...common,
      medId: '', brand: '', doseForm: '', strength: '', sellPrice: 0,
      aiMatched: false, aiRawBrand: ai.brand || '(নাম পড়া যায়নি)',
    };
  });

  const isDraftEmpty = APP_STATE.purItems.length === 1 && !APP_STATE.purItems[0].medId && !APP_STATE.purItems[0].aiScanned;
  APP_STATE.purItems = isDraftEmpty ? newRows : APP_STATE.purItems.concat(newRows);
  APP_STATE.purAiInvoiceTotal = invoiceTotal !== null && invoiceTotal !== undefined ? parseFloat(invoiceTotal) : null;
  renderPurItems();
  calcPurTotal();
}

// ✅ ইউজার pack-size ঠিক করলে qty ও purchasePrice দুটোই আবার হিসাব হয় (totalNetPackPrice
// অপরিবর্তিত থাকে) — কিন্তু qty×purchasePrice (লাইন-টোটাল) গাণিতিকভাবে একই থাকে,
// তাই এই এডিট কখনো ইনভয়েস-রিকনসিলিয়েশন ভাঙে না, শুধু ইনভেন্টরি-গ্র্যানুলারিটি ঠিক করে।
function onPurAiPackSizeChange(i) {
  const item = APP_STATE.purItems[i];
  if (!item || !item.aiScanned) return;
  const newPackSize = Math.max(1, parseFloat(document.getElementById(`pur-ai-packsize-${i}`).value) || 1);
  item.aiBaseUnitsPerPack = newPackSize;
  item.qty = Math.round(item.aiInvoicedQty * newPackSize);
  item.purchasePrice = item.qty > 0 ? round2((item.aiInvoicedQty * item.aiTotalNetPackPrice) / item.qty) : 0;
  document.getElementById(`pur-qty-${i}`).value = item.qty;
  document.getElementById(`pur-price-${i}`).value = item.purchasePrice;
  updatePurLineTotal(i);
  calcPurTotal();
}

// ✅ ইনভয়েসের ছাপা grand total বনাম ফর্মে-থাকা আইটেমগুলোর যোগফল — item-সংখ্যা
// অনুযায়ী স্কেলিং-tolerance (প্রতি লাইনে সামান্য রাউন্ডিং জমতে পারে)
function renderAiReconciliationBanner(formTotal) {
  const box = document.getElementById('pur-ai-reconcile-box');
  if (!box) return;
  const expected = APP_STATE.purAiInvoiceTotal;
  if (expected === null || expected === undefined || isNaN(expected)) { box.innerHTML = ''; return; }

  const aiItemCount = APP_STATE.purItems.filter(i => i.aiScanned).length || 1;
  const tolerance = Math.max(AI_LINE_TOLERANCE, AI_LINE_TOLERANCE * aiItemCount);
  const diff = round2(formTotal - expected);
  const matched = Math.abs(diff) <= tolerance;

  box.innerHTML = matched
    ? `<div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg px-3 py-2 mb-3">
        <i class="fa-solid fa-circle-check mr-1"></i> AI-স্ক্যান করা মোট ইনভয়েসের ছাপা টোটাল (৳${fmt(expected)})-এর সাথে মিলছে।
      </div>`
    : `<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> অমিল! ফর্মের মোট ৳${fmt(formTotal)}, কিন্তু ইনভয়েসে ছাপা মোট ৳${fmt(expected)} — পার্থক্য ৳${fmt(Math.abs(diff))}। সাবমিট করার আগে "⚠️" ব্যাজ-যুক্ত লাইনগুলো যাচাই করুন।
      </div>`;
}
