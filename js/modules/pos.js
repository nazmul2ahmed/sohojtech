'use strict';

// ✅ ফিক্স: শুধু Date.now() না — একই মিলিসেকেন্ডে দুই ডিভাইস/ট্যাব থেকে sale
// এলে ID কলিশনের ঝুঁকি ছিল (Firestore rule saleId==invoiceNo চেক করে, duplicate
// হলে silently ওভাররাইট/reject হতে পারত)
function genInvoiceNo() {
  return 'INV-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}
// ════════════════════════════════════════════════════════════
// POS / SALES MODULE
// ════════════════════════════════════════════════════════════
// ✅ Cash/Due Split বাগ ফিক্স: cashPaid ও due এখন Sale-লেভেলে।
// ✅ Keyboard flow: Enter = আইটেম যোগ, Ctrl+Enter = চেকআউট।
// ✅ Firestore রিওয়্যার: submitPOSSale() এখন apiSubmitSale() কল করে,
//    সফল হলেই APP_STATE-এ optimistic আপডেট হয় (আগে উল্টো ছিল)।
// ✅ Tab-switch persistence: গ্রাহক, তারিখ, নগদ ও আইটেম এখন APP_STATE-এ
//    ধরে রাখা হয়, tab পাল্টালে হারায় না।
// ✅ Medicine disambiguation: এখন multiple match হলে resolveMedicineMatch()
//    দিয়ে ambiguous কেস ধরা হয় এবং showMedDisambiguation() দিয়ে ইউজারকে
//    নির্দিষ্ট মেডিসিন বেছে নিতে দেওয়া হয়।
// ════════════════════════════════════════════════════════════

function renderPOSModule() {
  const container = document.getElementById('pos-content');
  if (!container) return;

  const offlineBanner = !navigator.onLine
    ? `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 mb-3">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> অফলাইন মোড: স্টক সংখ্যা সর্বশেষ সিঙ্কের সময়কার, নিশ্চিত না। বিক্রয় সংরক্ষিত হবে, নেট ফিরলে সিঙ্ক হবে।
      </div>` : '';

  container.innerHTML = `
    ${offlineBanner}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div class="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <i class="fa-solid fa-file-invoice text-brand"></i> নতুন বিক্রয় বিল
          </h5>
          <div class="flex items-center gap-3 flex-wrap">
            <button onclick="savePOSCartAsDraft()" class="text-xs text-brand hover:underline flex items-center gap-1">
              <i class="fa-solid fa-bookmark"></i> কার্ট সংরক্ষণ করুন
            </button>
            <button onclick="openPOSDraftsModal()" class="text-xs text-slate-500 hover:underline flex items-center gap-1">
              <i class="fa-solid fa-layer-group"></i> <span id="pos-drafts-count">ড্রাফট (0)</span>
            </button>
            <button onclick="resetPOS()" class="text-xs text-red-600 hover:underline flex items-center gap-1">
              <i class="fa-solid fa-rotate-left"></i> রিসেট
            </button>
          </div>
        </div>

        <div id="pos-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-3"></div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">গ্রাহক <span class="text-red-500">*</span></label>
            <div id="sd-pos-customer"></div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">তারিখ</label>
            <input type="date" id="pos-date" onchange="APP_STATE.posDate=this.value" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          </div>
        </div>

        <div id="pos-items-list" class="space-y-2 mb-3"></div>

        <button onclick="addPOSItem()" class="btn btn-brand-outline btn-sm mb-4">
          <i class="fa-solid fa-plus"></i> ওষুধ যোগ করুন
        </button>

        <div class="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-600 rounded-lg p-3 mb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-slate-600 dark:text-slate-300"><i class="fa-solid fa-tags text-brand mr-1"></i> সামগ্রিক (গ্রস) ছাড়</label>
            <span id="pos-grossdisc-note" class="text-[10px] text-slate-400"></span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2">শুধু যেসব আইটেমে ইনলাইন ছাড় নেই, সেগুলোতেই প্রযোজ্য — অনুপাতে বণ্টিত হবে।</p>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block text-[10px] text-slate-400 mb-1">ছাড় %</label>
              <input type="number" id="pos-grossdisc-pct" value="0" min="0" max="100" step="0.01" oninput="onPOSGrossDiscPctChange()"
                class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            </div>
            <div class="flex-1">
              <label class="block text-[10px] text-slate-400 mb-1">ছাড় (৳)</label>
              <input type="number" id="pos-grossdisc-amt" value="0" min="0" step="0.01" oninput="onPOSGrossDiscAmtChange()"
                class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            </div>
          </div>
        </div>

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

        <button onclick="submitPOSSale()" id="pos-submit-btn" class="btn btn-primary btn-block">
          <i class="fa-solid fa-circle-check"></i> বিক্রয় নিশ্চিত করুন
          <span class="text-[11px] font-normal opacity-70 hidden sm:inline">(Ctrl+Enter)</span>
        </button>
      </div>

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
          <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
            <h6 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-clock-rotate-left text-brand mr-1"></i> বিক্রয় তালিকা</h6>
            <input type="date" id="pos-list-date" value="${APP_STATE.posListDate || todayStr()}" onchange="onPOSListDateChange(this.value)"
              class="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div id="pos-today-sales" class="max-h-72 overflow-y-auto"></div>
        </div>
      </div>
    </div>
  `;

  initPOSCustomerDropdown();
  document.getElementById('pos-date').value = APP_STATE.posDate || todayStr();
  if (!APP_STATE.posItems || !APP_STATE.posItems.length) { APP_STATE.posItems = []; addPOSItem(); }
  else { renderPOSItems(); }
  if (APP_STATE.posCashPaid !== null && APP_STATE.posCashPaid !== undefined) {
    document.getElementById('pos-cash').value = APP_STATE.posCashPaid;
  }
  calcPOSTotals();
  renderTodayPOSSales();
  renderPOSDraftBadge(); // ✅ নতুন — কার্ট-ড্রাফট সংখ্যা

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
  createSD('sd-pos-customer', opts, (v) => { APP_STATE.posCustomerId = v; }, '— গ্রাহক খুঁজুন —');
  let selectedId = APP_STATE.posCustomerId || 'WALK_IN';
  let matchedOpt = opts.find(o => o.value === selectedId);
  if (!matchedOpt) { selectedId = 'WALK_IN'; matchedOpt = opts[0]; }
  APP_STATE.posCustomerId = selectedId;
  sdSelect('sd-pos-customer', matchedOpt.value, matchedOpt.label);
}

// ────────────────────────────────────────────────────────────
// ITEM ROWS
// ────────────────────────────────────────────────────────────
function addPOSItem() {
  APP_STATE.posItems.push({ medId: '', name: '', qty: 1, price: 0, costPrice: 0, discountPct: 0, discountAmt: 0 });
  renderPOSItems();
}

function removePOSItem(i) {
  if (APP_STATE.posItems.length <= 1) { toast('কমপক্ষে একটি সারি থাকতে হবে।', 'w'); return; }
  closeMedDisambiguation();
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
    const gross = round2((item.qty || 0) * (item.price || 0));
    const discountRow = `
      <div class="col-span-12 flex flex-wrap items-end gap-2 mt-1 pt-2 border-t border-dashed border-slate-200 dark:border-slate-600">
        <div class="w-20">
          <label class="block text-[10px] text-slate-400 mb-1">ছাড় %</label>
          <input type="number" id="pos-discpct-${i}" value="${item.discountPct || 0}" min="0" max="100" step="0.01"
            oninput="onPOSDiscountPctChange(${i})" onblur="onPOSDiscountBlur(${i})"
            class="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div class="w-24">
          <label class="block text-[10px] text-slate-400 mb-1">ছাড় (৳)</label>
          <input type="number" id="pos-discamt-${i}" value="${item.discountAmt || 0}" min="0" step="0.01"
            oninput="onPOSDiscountAmtChange(${i})" onblur="onPOSDiscountBlur(${i})"
            class="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        ${item.discountAmt > 0 ? `<div class="text-[11px] text-slate-400 ml-auto self-center">গ্রস ৳${fmt(gross)}</div>` : ''}
      </div>`;
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
            onkeydown="onPOSFieldKeydown(event, ${i})" oninput="onPOSFieldChange(${i})" onblur="onPOSFieldBlur(${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-4 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">মূল্য (৳)</label>
          <input type="number" id="pos-price-${i}" value="${item.price}" min="0" step="0.01"
            onkeydown="onPOSFieldKeydown(event, ${i})" oninput="onPOSFieldChange(${i})" onblur="onPOSFieldBlur(${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-4 md:col-span-3 flex flex-col justify-end">
          <label class="block text-[11px] text-slate-400 mb-1">লাইন টোটাল</label>
          <div id="pos-linetotal-${i}" class="px-2.5 py-1.5 text-sm font-mono font-bold text-brand">৳০.০০</div>
        </div>
        ${discountRow}
      </div>
    </div>`;
  }).join('');

  APP_STATE.posItems.forEach((_, i) => updateLineTotal(i));
}

function buildMedDisplayText(m) {
  return `${m.brand} ${m.doseForm || ''} ${m.strength || ''} [স্টক:${m.totalStock}]`.trim();
}

function onPOSDiscountPctChange(i) {
  const item = APP_STATE.posItems[i];
  if (!item) return;
  const pct = clamp(parseFloat(document.getElementById(`pos-discpct-${i}`).value) || 0, 0, 100);
  const gross = round2((item.qty || 0) * (item.price || 0));
  item.discountPct = pct;
  item.discountAmt = round2(gross * pct / 100);
  const amtEl = document.getElementById(`pos-discamt-${i}`);
  if (amtEl) amtEl.value = item.discountAmt;
  calcPOSTotals();
}

function onPOSDiscountAmtChange(i) {
  const item = APP_STATE.posItems[i];
  if (!item) return;
  const gross = round2((item.qty || 0) * (item.price || 0));
  const amt = clamp(parseFloat(document.getElementById(`pos-discamt-${i}`).value) || 0, 0, gross);
  item.discountAmt = amt;
  item.discountPct = gross > 0 ? round2((amt / gross) * 100) : 0;
  const pctEl = document.getElementById(`pos-discpct-${i}`);
  if (pctEl) pctEl.value = item.discountPct;
  calcPOSTotals();
}

function onPOSDiscountBlur(i) {
  const item = APP_STATE.posItems[i];
  if (!item) return;
  const pctEl = document.getElementById(`pos-discpct-${i}`);
  const amtEl = document.getElementById(`pos-discamt-${i}`);
  if (pctEl) pctEl.value = item.discountPct || 0;
  if (amtEl) amtEl.value = item.discountAmt || 0;
}

// ✅ নতুন — সামগ্রিক (গ্রস) ছাড় হ্যান্ডলার
function onPOSGrossDiscPctChange() {
  const pct = clamp(parseFloat(document.getElementById('pos-grossdisc-pct').value) || 0, 0, 100);
  APP_STATE.posGrossDiscPct = pct;
  calcPOSTotals();
}
function onPOSGrossDiscAmtChange() {
  const eligibleGross = round2(APP_STATE.posItems.filter(it => !(it.discountAmt > 0))
    .reduce((a, it) => a + (it.qty || 0) * (it.price || 0), 0));
  const amt = clamp(parseFloat(document.getElementById('pos-grossdisc-amt').value) || 0, 0, eligibleGross);
  APP_STATE.posGrossDiscPct = eligibleGross > 0 ? round2((amt / eligibleGross) * 100) : 0;
  calcPOSTotals();
}
// ────────────────────────────────────────────────────────────
// ✅ MEDICINE RESOLUTION (with disambiguation support)
// ────────────────────────────────────────────────────────────
function resolvePOSMedicineInput(i, opts = {}) {
  const inputEl = document.getElementById(`pos-med-input-${i}`);
  if (!inputEl) return;
  const val = inputEl.value;
  const stockedMeds = APP_STATE.inventory.filter(m => m.totalStock > 0);
  const result = resolveMedicineMatch(val, stockedMeds, buildMedDisplayText);
  if (result.type === 'exact') {
    closeMedDisambiguation();
    applyMedicineToItem(i, result.match);
    if (opts.onResolved) opts.onResolved(result.match);
    return;
  }
  if (result.type === 'ambiguous') {
    showMedDisambiguation(inputEl, result.matches, buildMedDisplayText, (chosen) => {
      inputEl.value = buildMedDisplayText(chosen);
      applyMedicineToItem(i, chosen);
      if (opts.onResolved) opts.onResolved(chosen);
    });
    return;
  }
  // none
  applyMedicineToItem(i, null);
  if (opts.notFoundToast && val.trim()) toast('ওষুধ খুঁজে পাওয়া যায়নি — নাম চেক করুন।', 'w');
}

function onPOSMedicineChange(i) {
  resolvePOSMedicineInput(i);
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
  const qty = Math.max(0, parseFloat(document.getElementById(`pos-qty-${i}`).value) || 0);
  const price = Math.max(0, parseFloat(document.getElementById(`pos-price-${i}`).value) || 0);
  const item = APP_STATE.posItems[i];
  item.qty = qty;
  item.price = price;

  const gross = round2(qty * price);
  item.discountAmt = round2(gross * (item.discountPct || 0) / 100);
  const discAmtEl = document.getElementById(`pos-discamt-${i}`);
  if (discAmtEl) discAmtEl.value = item.discountAmt;

  calcPOSTotals();
}

function onPOSFieldBlur(i) {
  const item = APP_STATE.posItems[i];
  if (!item) return;
  const qtyEl = document.getElementById(`pos-qty-${i}`);
  const priceEl = document.getElementById(`pos-price-${i}`);
  if (qtyEl) qtyEl.value = item.qty;
  if (priceEl) priceEl.value = item.price;
}

function updateLineTotal(i) {
  const item = APP_STATE.posItems[i];
  const gross = round2((item.qty || 0) * (item.price || 0));
  const effective = item.discountAmt > 0 ? item.discountAmt : (item._effectiveDiscountAmt || 0);
  const net = round2(gross - effective);
  const el = document.getElementById(`pos-linetotal-${i}`);
  if (!el) return;
  el.innerHTML = effective > 0
    ? `<span class="line-through text-slate-400 text-[10px] block">৳${fmt(gross)}</span>৳${fmt(net)}`
    : '৳' + fmt(net);
}

// ────────────────────────────────────────────────────────────
// ⌨️ KEYBOARD FLOW
// ────────────────────────────────────────────────────────────
function onPOSMedicineKeydown(e, i) {
  const inputEl = document.getElementById(`pos-med-input-${i}`);
  if (isMedDisambiguationOpenFor(inputEl) && medDisambiguationHandleKey(e)) return;
  if (e.key !== 'Enter') return;
  e.preventDefault();
  resolvePOSMedicineInput(i, {
    notFoundToast: true,
    onResolved: () => {
      addPOSItem();
      const newIdx = APP_STATE.posItems.length - 1;
      setTimeout(() => focusMedicineInput(newIdx), 30);
    },
  });
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
  APP_STATE.posGrossDiscPct = APP_STATE.posGrossDiscPct || 0;

  let medTotal = 0;
  APP_STATE.posItems.forEach(item => { medTotal += (item.qty || 0) * (item.price || 0); });
  medTotal = round2(medTotal);

  const eligibleGross = round2(APP_STATE.posItems.filter(it => !(it.discountAmt > 0))
    .reduce((a, it) => a + (it.qty || 0) * (it.price || 0), 0));
  APP_STATE.posGrossDiscAmt = round2(eligibleGross * APP_STATE.posGrossDiscPct / 100);

  const grossMap = distributeGrossDiscount(
    APP_STATE.posItems, APP_STATE.posGrossDiscAmt,
    it => (it.qty || 0) * (it.price || 0), it => it.discountAmt || 0
  );

  let discTotal = 0;
  APP_STATE.posItems.forEach(item => {
    const inline = item.discountAmt || 0;
    const effective = inline > 0 ? inline : (grossMap.get(item) || 0);
    item._effectiveDiscountAmt = effective;
    discTotal += effective;
  });
  discTotal = round2(discTotal);

  const grandTotal = Math.max(0, round2(medTotal - discTotal));
  document.getElementById('pos-total').value = grandTotal.toFixed(2);
  onPOSCashChange();
  setText('bs-med', '৳' + fmt(medTotal));
  setText('bs-disc', '৳' + fmt(discTotal));
  setText('bs-total', '৳' + fmt(grandTotal));

  const gdAmtEl = document.getElementById('pos-grossdisc-amt');
  const gdPctEl = document.getElementById('pos-grossdisc-pct');
  if (gdAmtEl && document.activeElement !== gdAmtEl) gdAmtEl.value = APP_STATE.posGrossDiscAmt;
  if (gdPctEl && document.activeElement !== gdPctEl) gdPctEl.value = APP_STATE.posGrossDiscPct;
  const gdNoteEl = document.getElementById('pos-grossdisc-note');
  if (gdNoteEl) gdNoteEl.textContent = eligibleGross > 0 ? `প্রযোজ্য আইটেম-গ্রস: ৳${fmt(eligibleGross)}` : 'কোনো যোগ্য আইটেম নেই';

  APP_STATE.posItems.forEach((_, i) => updateLineTotal(i));
}

function onPOSCashChange() {
  const total = parseFloat(document.getElementById('pos-total').value) || 0;
  const rawCash = parseFloat(document.getElementById('pos-cash').value) || 0;
  const cash = Math.max(0, rawCash);
  const due = Math.max(0, round2(total - cash));
  APP_STATE.posCashPaid = cash;
  document.getElementById('pos-due').value = due.toFixed(2);
  setText('bs-cash', '৳' + fmt(cash));
  setText('bs-due', '৳' + fmt(due));
}

// ────────────────────────────────────────────────────────────
// ✅ SUBMIT — এখন async, apiSubmitSale() সফল হলেই APP_STATE আপডেট হয়
// ────────────────────────────────────────────────────────────
async function submitPOSSale() {
  if (guardReadOnly()) return;
  hideEl('pos-error');
  const custId = sdGetValue('sd-pos-customer');
  const validItems = APP_STATE.posItems.filter(i => i.medId && i.qty > 0);

  if (!custId) return showPOSError('গ্রাহক নির্বাচন করুন।');
  if (!validItems.length) return showPOSError('কমপক্ষে একটি ওষুধ যোগ করুন।');

  for (const item of validItems) {
    const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
    if (!inv || item.qty > inv.totalStock) {
      return showPOSError(`"${item.name}" স্টক অপর্যাপ্ত। বর্তমান স্টক: ${inv ? inv.totalStock : 0}`);
    }
  }

  calcPOSTotals(); // ✅ item._effectiveDiscountAmt ফ্রেশ নিশ্চিত

  const total = parseFloat(document.getElementById('pos-total').value) || 0;
  const cashPaid = parseFloat(document.getElementById('pos-cash').value) || 0;
  const due = parseFloat(document.getElementById('pos-due').value) || 0;
  const date = document.getElementById('pos-date').value || todayStr();

  if (due > 0 && custId === 'WALK_IN') return showPOSError('বাকি রাখতে হলে নিবন্ধিত গ্রাহক নির্বাচন করুন।');

  const customer = APP_STATE.customers.find(c => c.id === custId);
  const custName = custId === 'WALK_IN' ? 'নগদ গ্রাহক' : (customer?.name || custId);
  const invoiceNo = genInvoiceNo();

  // ✅ ফিক্স: _effectiveDiscountAmt (স্ক্র্যাচ ফিল্ড) স্ট্রিপ করে বাদ, এবং
  // discountAmt এখন ব্লেন্ডেড (ইনলাইন+গ্রস) effective ভ্যালু দিয়ে overwrite —
  // আগে discountAmt শুধু inline অংশ রয়ে যেত, discountPct-এর সাথে অসামঞ্জস্যপূর্ণ
  const finalItems = validItems.map(i => {
    const gross = round2((i.qty || 0) * (i.price || 0));
    const effective = Math.min(i._effectiveDiscountAmt || 0, gross);
    const { _effectiveDiscountAmt, ...rest } = i;
    return { ...rest, discountAmt: effective, discountPct: gross > 0 ? round2((effective / gross) * 100) : 0 };
  });

  const sale = {
    invoiceNo, date, customerId: custId, customerName: custName,
    items: finalItems,
    totalBill: total, cashPaid, due, type: due > 0 ? 'বাকি' : 'নগদ',
    grossDiscountPct: APP_STATE.posGrossDiscPct || 0,
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

    if (res.queued) {
      toast(res.message, 'w');
      resetPOS();
      refreshSyncBadge();
      openReceiptModal('sale', sale);
    } else {
      finalItems.forEach(item => deductStockFEFO(item.medId, item.qty));
      if (customer) applyCustomerDueChange(custId, due, cashPaid);
      APP_STATE.sales.push(sale);
      toast(res.message, 's');
      resetPOS();
      renderTodayPOSSales();
      openReceiptModal('sale', sale);
    }
    btn.disabled = false;
    btn.innerHTML = idleHTML;
  } catch (err) {
    showFatalError('বিক্রয় সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
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
  closeMedDisambiguation();
  APP_STATE.posDate = null; APP_STATE.posCashPaid = null; APP_STATE.posCustomerId = null;
  APP_STATE.posItems = [];
  APP_STATE.posGrossDiscPct = 0; APP_STATE.posGrossDiscAmt = 0;
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
  inv.batches.sort((a, b) => compareBatchExpiry(a, b, 'asc')); // ✅ ধাপ ৩১ ফিক্স
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
function onPOSListDateChange(val) {
  APP_STATE.posListDate = val || todayStr();
  renderTodayPOSSales();
}

function renderTodayPOSSales() {
  const container = document.getElementById('pos-today-sales');
  if (!container) return;
  const filterDate = APP_STATE.posListDate || todayStr();
  const listSales = APP_STATE.sales.filter(s => s.date === filterDate).slice().reverse();

  const capHint = capHintHTML('sales', 'pos-load-older-btn', 'renderTodayPOSSales', 'সাম্প্রতিক ৮,০০০টার বেশি বিক্রয় থাকলে পুরনো তারিখের এন্ট্রি এখনো নাও দেখাতে পারে।');

  container.innerHTML = capHint + (listSales.length ? listSales.map(s => `
    <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
      <div class="flex justify-between items-start">
        <div class="min-w-0">
          <div class="text-xs font-mono text-slate-400">${esc(s.invoiceNo)}</div>
          <div class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(s.customerName)}</div>
        </div>
        <div class="text-right flex-shrink-0">
          <div class="font-mono font-bold text-sm text-slate-800 dark:text-white">৳${fmt(s.totalBill)}</div>
          ${s.due > 0 ? `<span class="text-[11px] text-red-500 font-semibold">বাকি ৳${fmt(s.due)}</span>` : `<span class="text-[11px] text-emerald-500 font-semibold">পরিশোধিত</span>`}
          <div class="flex items-center gap-2 justify-end mt-1">
            <button onclick="reprintSaleReceipt('${s.invoiceNo}')" class="text-slate-400 hover:text-brand text-xs"><i class="fa-solid fa-print"></i></button>
            <button onclick="deleteSaleConfirm('${s.invoiceNo}')" class="text-red-400 hover:text-red-600 text-xs"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    </div>`).join('')
    : `<div class="px-4 py-8 text-center text-slate-400 text-sm"><i class="fa-solid fa-receipt text-2xl opacity-30 mb-2 block"></i>এই তারিখে কোনো বিক্রয় নেই</div>`);
}

function hideEl(id) { document.getElementById(id)?.classList.add('hidden'); }

async function deleteSaleConfirm(invoiceNo) {
  if (guardReadOnly()) return;
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  if (!sale || !confirm(`"${invoiceNo}" মুছবেন? স্টক ও বাকি ফেরত হবে।`)) return;
  try {
    const res = await apiDeleteSale(sale);
    if (!res.success) return toast(res.message, 'w');
    // ✅ সংশোধন: item.consumedBatches পাস করা হচ্ছে — সঠিক ব্যাচে স্টক ফেরত
    sale.items.forEach(item => restockItem(item.medId, item.qty, item.costPrice, item.consumedBatches));
    if (sale.customerId !== 'WALK_IN') {
      applyCustomerDueChange(sale.customerId, -sale.due, -sale.cashPaid);
    }
    APP_STATE.sales = APP_STATE.sales.filter(s => s.invoiceNo !== invoiceNo);
    toast(res.message, 's');
    renderTodayPOSSales();
  } catch (err) { showFatalError('বিক্রয় মুছতে সমস্যা:\n' + humanizeError(err), err); }
}

// ════════════════════════════════════════════════════════════
// ✅ POS CART/DRAFT — বড় একটা বিক্রয় নিয়ে কাজ করতে করতে ছোট কিন্তু
// জরুরি বিক্রয় সম্পন্ন করে আবার ফিরে আসার জন্য। localStorage-ভিত্তিক
// (দেখুন js/draft-store.js) — শুধু এই ডিভাইসে থাকে।
// ════════════════════════════════════════════════════════════
function capturePOSDraftState() {
  return {
    posItems: JSON.parse(JSON.stringify(APP_STATE.posItems || [])),
    posCustomerId: APP_STATE.posCustomerId || null,
    posDate: document.getElementById('pos-date')?.value || APP_STATE.posDate,
    posCashPaid: parseFloat(document.getElementById('pos-cash')?.value) || 0,
    posGrossDiscPct: APP_STATE.posGrossDiscPct || 0,
  };
}

function savePOSCartAsDraft() {
  const hasItems = (APP_STATE.posItems || []).some(i => i.medId);
  if (!hasItems) { toast('কার্টে কোনো ওষুধ নেই — সংরক্ষণ করার কিছু নেই।', 'w'); return; }

  const custId = APP_STATE.posCustomerId || 'WALK_IN';
  const custName = custId === 'WALK_IN' ? 'নগদ গ্রাহক' : (APP_STATE.customers.find(c => c.id === custId)?.name || custId);
  const itemCount = APP_STATE.posItems.filter(i => i.medId).length;

  addDraft('pos', `${custName} — ${itemCount} আইটেম`, capturePOSDraftState());
  toast('কার্ট সংরক্ষিত হয়েছে — এখন নতুন বিক্রয় শুরু করতে পারেন।', 's');
  resetPOS();
  renderPOSDraftBadge();
}

function renderPOSDraftBadge() {
  const el = document.getElementById('pos-drafts-count');
  if (el) el.textContent = `ড্রাফট (${getDraftCount('pos')})`;
}

function openPOSDraftsModal() {
  document.getElementById('pos-drafts-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'pos-drafts-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-layer-group text-brand mr-1"></i> সংরক্ষিত কার্ট</h4>
      <p class="text-xs text-slate-400 mb-4">শুধু এই ডিভাইসে সংরক্ষিত থাকে — অন্য ডিভাইস/ব্রাউজারে দেখা যাবে না।</p>
      <div id="pos-drafts-list" class="space-y-2 mb-4"></div>
      <button onclick="document.getElementById('pos-drafts-modal').remove()" class="btn btn-secondary btn-block">বন্ধ করুন</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('pos-drafts-modal', () => document.getElementById('pos-drafts-modal')?.remove());
  renderPOSDraftsList(getDrafts('pos'));
}

function renderPOSDraftsList(drafts) {
  const box = document.getElementById('pos-drafts-list');
  if (!box) return;
  if (!drafts.length) {
    box.innerHTML = `<div class="text-center text-slate-400 text-sm py-6">কোনো সংরক্ষিত কার্ট নেই।</div>`;
    return;
  }
  box.innerHTML = drafts.map(d => `
    <div class="flex items-center justify-between gap-2 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-800 dark:text-white truncate">${esc(d.label)}</div>
        <div class="text-[11px] text-slate-400">${esc(formatRelativeTime(d.savedAt))}</div>
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <button onclick="loadPOSDraft('${d.id}')" class="text-brand text-xs font-semibold hover:underline">লোড করুন</button>
        <button onclick="deletePOSDraftConfirm('${d.id}')" class="text-red-400 hover:text-red-600"><i class="fa-solid fa-trash text-xs"></i></button>
      </div>
    </div>`).join('');
}

function loadPOSDraft(draftId) {
  const draft = getDrafts('pos').find(d => d.id === draftId);
  if (!draft) return;

  const hasCurrentItems = (APP_STATE.posItems || []).some(i => i.medId);
  if (hasCurrentItems && !confirm('বর্তমান কার্টে অসংরক্ষিত আইটেম আছে — ড্রাফট লোড করলে এগুলো হারিয়ে যাবে। চালিয়ে যাবেন? (চাইলে আগে "কার্ট সংরক্ষণ করুন" চেপে নিজে সেভ করে নিন)')) return;

  removeDraft('pos', draftId); // ✅ লোড করলে সেই ড্রাফট consume হয়ে যায় (আবার resave করলে নতুন এন্ট্রি হবে)
  APP_STATE.posItems = draft.state.posItems || [];
  APP_STATE.posCustomerId = draft.state.posCustomerId || null;
  APP_STATE.posDate = draft.state.posDate || null;
  APP_STATE.posCashPaid = draft.state.posCashPaid || null;
  APP_STATE.posGrossDiscPct = draft.state.posGrossDiscPct || 0;

  document.getElementById('pos-drafts-modal')?.remove();
  renderPOSModule();
  toast('ড্রাফট লোড হয়েছে।', 's');
}

function deletePOSDraftConfirm(draftId) {
  if (!confirm('এই সংরক্ষিত কার্ট মুছে ফেলতে চান?')) return;
  removeDraft('pos', draftId);
  renderPOSDraftsList(getDrafts('pos'));
  renderPOSDraftBadge();
}
