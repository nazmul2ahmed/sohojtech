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
// ✅ গ্রস-ছাড় (সামগ্রিক): প্রতি-লাইন ইনলাইন ছাড় নেই এমন আইটেমগুলোর মধ্যে
//    গ্রস-মূল্য অনুপাতে বণ্টিত হয় (distributeGrossDiscount)। calcPurTotal()
//    ও submitPurchase() — দুই জায়গাতেই একই বণ্টন-লজিক ব্যবহার হয়, যাতে UI-তে
//    দেখানো টোটাল আর Firestore-এ সেভ হওয়া totalCost সবসময় মিলে যায়।
// ════════════════════════════════════════════════════════════

function renderPurchaseModule() {
  const container = document.getElementById('purchase-content');
  APP_STATE.purGrossDiscPct = APP_STATE.purGrossDiscPct || 0;
  APP_STATE.purGrossDiscAmt = APP_STATE.purGrossDiscAmt || 0;
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

        <div class="bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-600 rounded-lg p-3 mb-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-xs font-semibold text-slate-600 dark:text-slate-300"><i class="fa-solid fa-tags text-brand mr-1"></i> সামগ্রিক (গ্রস) ছাড়</label>
            <span id="pur-grossdisc-note" class="text-[10px] text-slate-400"></span>
          </div>
          <p class="text-[11px] text-slate-400 mb-2">শুধু যেসব আইটেমে ইনলাইন (প্রতি-লাইন) ছাড় নেই, সেগুলোতেই এই ছাড় প্রযোজ্য — অনুপাতে বণ্টিত।</p>
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="block text-[10px] text-slate-400 mb-1">ছাড় %</label>
              <input type="number" id="pur-grossdisc-pct" value="0" min="0" max="100" step="0.01" oninput="onPurGrossDiscPctChange()"
                class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            </div>
            <div class="flex-1">
              <label class="block text-[10px] text-slate-400 mb-1">ছাড় (৳)</label>
              <input type="number" id="pur-grossdisc-amt" value="0" min="0" step="0.01" oninput="onPurGrossDiscAmtChange()"
                class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
            </div>
          </div>
        </div>

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


function onPurGrossDiscPctChange() {
  const pct = clamp(parseFloat(document.getElementById('pur-grossdisc-pct').value) || 0, 0, 100);
  APP_STATE.purGrossDiscPct = pct;
  calcPurTotal();
}
function onPurGrossDiscAmtChange() {
  const eligibleGross = round2(APP_STATE.purItems.filter(it => !(it.discountAmt > 0))
    .reduce((a, it) => a + (it.qty || 0) * (it.purchasePrice || 0), 0));
  const amt = clamp(parseFloat(document.getElementById('pur-grossdisc-amt').value) || 0, 0, eligibleGross);
  APP_STATE.purGrossDiscPct = eligibleGross > 0 ? round2((amt / eligibleGross) * 100) : 0;
  calcPurTotal();
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
  APP_STATE.purItems.push({
    medId: '', brand: '', qty: 1, purchasePrice: 0, mrp: 0, sellPrice: 0, expiryDate: '',
    discountPct: 0, discountAmt: 0, // ✅ নতুন — প্রতি-লাইন ছাড়
  });
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
    const priceBadge = item.aiScanned ? (() => {
      if (item.aiPriceStatus === 'verified') return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 ml-1" title="ইনভয়েসের লাইন-টোটালের সাথে মিলেছে">💰 দাম যাচাই হয়েছে</span>`;
      if (item.aiPriceStatus === 'mismatch') return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 ml-1" title="ইনভয়েসে ছাপা: ৳${fmt(item.aiLineTotalPrinted || 0)}, হিসাবকৃত: ৳${fmt(round2(item.qty * item.purchasePrice))}">⚠️ দামে অমিল — চেক করুন</span>`;
      return `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 ml-1">দাম স্বয়ং-যাচাই করুন</span>`;
    })() : '';
    const doseFormBadge = item.aiScanned && item.aiDoseFormMismatch
      ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 ml-1" title="AI packaging দেখে '${esc(item.aiUnitType)}' মনে করেছে, কিন্তু ওষুধ মাস্টারে ডোজ-ফর্ম '${esc(item.doseForm)}' — মিলছে না">🔀 ডোজ-ফর্ম অমিল</span>`
      : '';
    const packSizeRow = item.aiScanned ? `
      <div class="col-span-12 flex items-center gap-2 mt-1 text-[11px] text-slate-400 flex-wrap">
        <i class="fa-solid fa-wand-magic-sparkles text-brand"></i>
        AI অনুমান: ইনভয়েসে ${item.aiInvoicedQty} প্যাক, প্রতি প্যাকে
        <input type="number" id="pur-ai-packsize-${i}" value="${item.aiBaseUnitsPerPack}" min="1"
          onchange="onPurAiPackSizeChange(${i})"
          class="w-16 px-1.5 py-0.5 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        পিস — ভুল মনে হলে বদলে দিন (টাকার হিসাব প্রভাবিত হবে না)
      </div>` : '';

    // ✅ নতুন — মাস্টারে নেই এমন আইটেমের জন্য দ্রুত-যোগ লিংক
    const quickAddLink = !item.medId
      ? `<button type="button" onclick="openQuickAddMedicineFromPurchase(${i})" class="text-[10px] text-brand hover:underline mt-1 block">
          <i class="fa-solid fa-plus mr-1"></i>ওষুধ মাস্টারে নেই? দ্রুত নতুন যোগ করুন
        </button>` : '';

    // ✅ নতুন — প্রতি-লাইন ছাড় (% ↔ ৳ বাইডাইরেকশনাল)
    const gross = round2((item.qty || 0) * (item.purchasePrice || 0));
    const net = round2(gross - (item.discountAmt || 0));
    const discountRow = `
      <div class="col-span-12 flex flex-wrap items-end gap-2 mt-1 pt-2 border-t border-dashed border-slate-200 dark:border-slate-600">
        <div class="w-20">
          <label class="block text-[10px] text-slate-400 mb-1">ছাড় %</label>
          <input type="number" id="pur-discpct-${i}" value="${item.discountPct || 0}" min="0" max="100" step="0.01"
            oninput="onPurDiscountPctChange(${i})" onblur="onPurDiscountBlur(${i})"
            class="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div class="w-24">
          <label class="block text-[10px] text-slate-400 mb-1">ছাড় (৳)</label>
          <input type="number" id="pur-discamt-${i}" value="${item.discountAmt || 0}" min="0" step="0.01"
            oninput="onPurDiscountAmtChange(${i})" onblur="onPurDiscountBlur(${i})"
            class="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        ${item.discountAmt > 0 ? `<div class="text-[11px] text-slate-400 ml-auto self-center">গ্রস ৳${fmt(gross)} → নেট ৳${fmt(net)}</div>` : ''}
      </div>`;

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
          ${quickAddLink}
        </div>
        <div class="col-span-3 md:col-span-1">
          <label class="block text-[11px] text-slate-400 mb-1">Qty</label>
          <input type="number" id="pur-qty-${i}" value="${item.qty}" min="1" onkeydown="onPurFieldKeydown(event,${i})" oninput="onPurFieldChange(${i})" onblur="onPurFieldBlur(${i})"
            class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-3 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">ক্রয় মূল্য (গ্রস)</label>
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
        ${discountRow}
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
      discountPct: 0, discountAmt: 0, // ✅ নতুন — নতুন সিলেকশনে আগের ছাড় বহন করবে না
    };
    document.getElementById(`pur-price-${i}`).value = APP_STATE.purItems[i].purchasePrice;
    document.getElementById(`pur-mrp-${i}`).value = APP_STATE.purItems[i].mrp;
    document.getElementById(`pur-sell-${i}`).value = APP_STATE.purItems[i].sellPrice;
    const discPctEl = document.getElementById(`pur-discpct-${i}`);
    const discAmtEl = document.getElementById(`pur-discamt-${i}`);
    if (discPctEl) discPctEl.value = 0;
    if (discAmtEl) discAmtEl.value = 0;
  } else {
    APP_STATE.purItems[i] = { medId: '', brand: '', qty: 1, purchasePrice: 0, mrp: 0, sellPrice: 0, expiryDate: '', discountPct: 0, discountAmt: 0 };
  }
  updatePurLineTotal(i);
  calcPurTotal();
}

function onPurFieldChange(i) {
  const qty = Math.max(0, parseFloat(document.getElementById(`pur-qty-${i}`).value) || 0);
  const purchasePrice = Math.max(0, parseFloat(document.getElementById(`pur-price-${i}`).value) || 0);
  const mrp = Math.max(0, parseFloat(document.getElementById(`pur-mrp-${i}`).value) || 0);
  const sellPrice = Math.max(0, parseFloat(document.getElementById(`pur-sell-${i}`).value) || 0);

  const item = APP_STATE.purItems[i];
  item.qty = qty;
  item.purchasePrice = purchasePrice;
  item.mrp = mrp;
  item.sellPrice = sellPrice;
  item.expiryDate = document.getElementById(`pur-exp-${i}`).value || '';

  // ✅ নতুন — qty/price বদলালে discountPct অক্ষত রেখে discountAmt পুনর্গণনা
  const gross = round2(qty * purchasePrice);
  item.discountAmt = round2(gross * (item.discountPct || 0) / 100);
  const discAmtEl = document.getElementById(`pur-discamt-${i}`);
  if (discAmtEl) discAmtEl.value = item.discountAmt;

  updatePurLineTotal(i);
  calcPurTotal();
}

// ✅ নতুন — ছাড় % বদলালে amount পুনর্গণনা
function onPurDiscountPctChange(i) {
  const item = APP_STATE.purItems[i];
  if (!item) return;
  const pct = clamp(parseFloat(document.getElementById(`pur-discpct-${i}`).value) || 0, 0, 100);
  const gross = round2((item.qty || 0) * (item.purchasePrice || 0));
  item.discountPct = pct;
  item.discountAmt = round2(gross * pct / 100);
  const amtEl = document.getElementById(`pur-discamt-${i}`);
  if (amtEl) amtEl.value = item.discountAmt;
  updatePurLineTotal(i);
  calcPurTotal();
}

// ✅ নতুন — ছাড় ৳ বদলালে percentage ব্যাক-ক্যালকুলেট
function onPurDiscountAmtChange(i) {
  const item = APP_STATE.purItems[i];
  if (!item) return;
  const gross = round2((item.qty || 0) * (item.purchasePrice || 0));
  const amt = clamp(parseFloat(document.getElementById(`pur-discamt-${i}`).value) || 0, 0, gross);
  item.discountAmt = amt;
  item.discountPct = gross > 0 ? round2((amt / gross) * 100) : 0;
  const pctEl = document.getElementById(`pur-discpct-${i}`);
  if (pctEl) pctEl.value = item.discountPct;
  updatePurLineTotal(i);
  calcPurTotal();
}

function onPurDiscountBlur(i) {
  const item = APP_STATE.purItems[i];
  if (!item) return;
  const pctEl = document.getElementById(`pur-discpct-${i}`);
  const amtEl = document.getElementById(`pur-discamt-${i}`);
  if (pctEl) pctEl.value = item.discountPct || 0;
  if (amtEl) amtEl.value = item.discountAmt || 0;
}

// ────────────────────────────────────────────────────────────
// ✅ TOTAL — একমাত্র সংজ্ঞা (আগে দুইবার ডুপ্লিকেট ছিল, দ্বিতীয়টা
// প্রথমটাকে override করে ছাড়/গ্রস-ছাড় দুটোই বাদ দিয়ে ফেলত — ফিক্সড)
// ইনলাইন ছাড় নেই এমন আইটেমগুলোর মধ্যে গ্রস-ছাড় বণ্টিত হয়ে
// প্রতিটির item._effectiveDiscountAmt-এ বসে, যেটা updatePurLineTotal()
// এবং submitPurchase() দুই জায়গাতেই ব্যবহৃত হয়।
// ────────────────────────────────────────────────────────────
function calcPurTotal() {
  const eligibleGross = round2(APP_STATE.purItems.filter(it => !(it.discountAmt > 0))
    .reduce((a, it) => a + (it.qty || 0) * (it.purchasePrice || 0), 0));
  APP_STATE.purGrossDiscPct = APP_STATE.purGrossDiscPct || 0;
  APP_STATE.purGrossDiscAmt = round2(eligibleGross * APP_STATE.purGrossDiscPct / 100);

  const grossMap = distributeGrossDiscount(
    APP_STATE.purItems, APP_STATE.purGrossDiscAmt,
    it => (it.qty || 0) * (it.purchasePrice || 0), it => it.discountAmt || 0
  );

  let total = 0;
  APP_STATE.purItems.forEach(item => {
    const gross = (item.qty || 0) * (item.purchasePrice || 0);
    const inline = item.discountAmt || 0;
    const effective = inline > 0 ? inline : (grossMap.get(item) || 0);
    item._effectiveDiscountAmt = effective;
    total += (gross - effective);
  });

  document.getElementById('pur-total').value = round2(total).toFixed(2);

  const gdAmtEl = document.getElementById('pur-grossdisc-amt');
  const gdPctEl = document.getElementById('pur-grossdisc-pct');
  if (gdAmtEl && document.activeElement !== gdAmtEl) gdAmtEl.value = APP_STATE.purGrossDiscAmt;
  if (gdPctEl && document.activeElement !== gdPctEl) gdPctEl.value = APP_STATE.purGrossDiscPct;
  const gdNoteEl = document.getElementById('pur-grossdisc-note');
  if (gdNoteEl) gdNoteEl.textContent = eligibleGross > 0 ? `প্রযোজ্য আইটেম-গ্রস: ৳${fmt(eligibleGross)}` : 'কোনো যোগ্য আইটেম নেই';

  APP_STATE.purItems.forEach((_, i) => updatePurLineTotal(i));
  renderAiReconciliationBanner(round2(total));
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

// ✅ পরিবর্তন — এখন ইনলাইন বা গ্রস-বণ্টিত (effective) ছাড় যেটা প্রযোজ্য সেটা দেখায়
function updatePurLineTotal(i) {
  const item = APP_STATE.purItems[i];
  const gross = round2((item.qty || 0) * (item.purchasePrice || 0));
  const effective = item.discountAmt > 0 ? item.discountAmt : (item._effectiveDiscountAmt || 0);
  const net = round2(gross - effective);
  const el = document.getElementById(`pur-linetotal-${i}`);
  if (!el) return;
  el.innerHTML = effective > 0
    ? `<span class="line-through text-slate-400 text-[10px] block">৳${fmt(gross)}</span>৳${fmt(net)}`
    : '৳' + fmt(net);
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

  calcPurTotal(); // ✅ item._effectiveDiscountAmt (ইনলাইন + গ্রস-বণ্টিত) ফ্রেশ নিশ্চিত

  const supplier = APP_STATE.suppliers.find(s => s.id === supId);
  const purchaseId = genPurchaseId();

  // ✅ গ্রস থেকে টোটাল (ইনলাইন + গ্রস-বণ্টিত ছাড় বাদ দিয়ে) হিসাব, এবং প্রতিটা
  // আইটেমে purchasePrice-কে নেট-ইউনিট-কস্টে কনভার্ট (downstream batch cost/COGS-এর
  // জন্য), গ্রস/ছাড় আলাদা ফিল্ডে রেকর্ড রাখা হচ্ছে অডিট-ট্রেইলের জন্য
  let totalCost = 0;
  const itemsWithReorder = validItems.map(i => {
    const med = APP_STATE.medicines.find(m => m.id === i.medId);
    const gross = round2(i.qty * i.purchasePrice);
    const effectiveDiscount = Math.min(i._effectiveDiscountAmt || 0, gross);
    const netLine = round2(gross - effectiveDiscount);
    const netUnitCost = i.qty > 0 ? round2(netLine / i.qty) : i.purchasePrice;
    totalCost += netLine;
    return {
      ...i,
      grossUnitPrice: i.purchasePrice,   // ✅ রেকর্ড/রিসিটের জন্য — আসল (ছাড়ের আগের) দাম
      discountAmt: effectiveDiscount,
      discountPct: gross > 0 ? round2((effectiveDiscount / gross) * 100) : 0,
      discountSource: effectiveDiscount <= 0 ? 'none' : ((i.discountAmt || 0) > 0 ? 'inline' : 'gross'), // ✅ নতুন — অডিট-ট্রেইলে ছাড়ের উৎস
      purchasePrice: netUnitCost,        // ✅ batch cost/COGS এখন থেকে নেট মূল্য ব্যবহার করবে
      reorderLevel: med?.reorderLevel || APP_STATE.lowStockLevel || 10,
    };
  });
  totalCost = round2(totalCost);

  const purchase = {
    purchaseId, date, supplierId: supId, supplierName: supplier?.name || supId,
    items: itemsWithReorder,
    totalCost, paymentType: payType,
    medicineName: validItems.map(i => i.brand).join(', '),
    grossDiscountPct: APP_STATE.purGrossDiscPct || 0, // ✅ নতুন — রিসিটে/অডিটে সামগ্রিক ছাড়%
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
      openReceiptModal('purchase', purchase);
    } else {
      // ✅ ফিক্স: validItems না, itemsWithReorder ব্যবহার — এতে local mirror-এর
      // batch cost Firestore-এ কমিট হওয়া নেট-কস্টের সাথে সামঞ্জস্যপূর্ণ থাকে
      itemsWithReorder.forEach(item => addPurchaseBatch(item, date));
      APP_STATE.purchases.push(purchase);
      if (supplier) {
        if (payType === 'বাকি') applySupplierPayableChange(supId, totalCost, 0);
        else applySupplierPayableChange(supId, 0, totalCost);
      }
      toast(res.message, 's');
      resetPurchase();
      renderTodayPurchases();
      openReceiptModal('purchase', purchase);
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
  APP_STATE.purGrossDiscPct = 0; APP_STATE.purGrossDiscAmt = 0; // ✅ নতুন — গ্রস-ছাড় স্টেটও পরিষ্কার
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
// ✅ নতুন — ব্র্যান্ডের শেষে প্রায়ই প্যাক-সাইজ marker থাকে: "(30s)", "(20s)",
// "10X10'S" — matching-এর আগে এসব বাদ দেওয়া হয়, নাহলে মাস্টারে থাকা
// পরিষ্কার ব্র্যান্ড-নামের সাথে মিলবে না।
function stripPackSizeSuffix(brand) {
  return String(brand || '')
    .replace(/\(?\s*\d+\s*[xX×]\s*\d+\s*'?s\)?/gi, '')
    .replace(/\(?\s*\d+\s*'?s\)?/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// ✅ নতুন — একই marker থেকে সংখ্যাটা বের করে base_units_per_pack fallback
// হিসেবে ব্যবহারের জন্য (AI নিজে base_units_per_pack ভুল/অনুপস্থিত দিলে)
function extractPackSizeFromText(text) {
  const str = String(text || '');
  const combo = str.match(/(\d+)\s*[xX×]\s*(\d+)\s*'?s/i);
  if (combo) return parseInt(combo[1], 10) * parseInt(combo[2], 10);
  const simple = str.match(/\(?\s*(\d+)\s*'?s\)?/i);
  if (simple) return parseInt(simple[1], 10) || null;
  return null;
}

function fuzzyMatchAiBrandToMedicine(aiBrand) {
  const q = stripPackSizeSuffix(aiBrand).toLowerCase();
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
    // ✅ নতুন — AI-এর base_units_per_pack অনুপস্থিত/ডিফল্ট(≤1) হলে
    // ব্র্যান্ড-টেক্সটের suffix থেকে fallback (money-calculation অপ্রভাবিত)
    const suffixPackSize = extractPackSizeFromText(ai.brand);
    if (suffixPackSize && (!ai.base_units_per_pack || ai.base_units_per_pack <= 1)) {
      ai.base_units_per_pack = suffixPackSize;
    }

    const matched = fuzzyMatchAiBrandToMedicine(ai.brand);
    const lineData = computeAiLineData(ai);
    const mrp = Math.max(0, parseFloat(ai.mrp) || 0);
    const expiryDate = normalizeAiExpiry(ai.expiry_date);
    const unitType = ai.unit_type || '';
    const doseFormMismatch = matched ? checkDoseFormMismatch(unitType, matched.doseForm) : false;

    const common = {
      qty: lineData.qty, purchasePrice: lineData.purchasePrice, mrp, expiryDate,
      discountPct: 0, discountAmt: 0, // ✅ নতুন — AI-স্ক্যান করা আইটেমেও ছাড়-ফিল্ড আছে, ডিফল্ট শূন্য
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

// ════════════════════════════════════════════════════════════
// ✅ নতুন — QUICK-ADD MEDICINE FROM PURCHASE ROW
// ইনভয়েসে পাওয়া গেছে কিন্তু ওষুধ মাস্টারে নেই এমন আইটেম দ্রুত যোগ করে
// সরাসরি এই purchase-row-এই বসিয়ে দেয় — AI-এর বসানো qty/price/mrp/
// expiry/discount কিছুই হারায় না (শুধু medId/brand/doseForm/strength
// টার্গেটেডভাবে সেট করা হয়, applyMedicineToPurItem()-এর মতো পুরো row
// রিসেট করা হয় না)।
// ════════════════════════════════════════════════════════════
let _purQaGmSearchTimer = null;
let _purQaGmSearchToken = 0;
let _purQaGmLastResults = [];

function openQuickAddMedicineFromPurchase(i) {
  if (guardReadOnly()) return;
  const item = APP_STATE.purItems[i];
  if (!item) return;

  const prefillBrand = item.aiRawBrand
    ? stripPackSizeSuffix(normalizeBrandText(item.aiRawBrand))
    : normalizeBrandText(document.getElementById(`pur-med-input-${i}`)?.value || '');
  const doseForms = ['ট্যাবলেট', 'ক্যাপসুল', 'সিরাপ', 'ইনজেকশন', 'ক্রিম/মলম', 'ড্রপস', 'ইনহেলার', 'সাপোজিটরি', 'অন্যান্য'];
  const unitTypeGuessMap = { piece: 'ট্যাবলেট', bottle: 'সিরাপ', tube: 'ক্রিম/মলম' };
  const guessedForm = unitTypeGuessMap[item.aiUnitType] || 'ট্যাবলেট';

  document.getElementById('pur-quickadd-modal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'pur-quickadd-modal';
  modal.className = 'fixed inset-0 z-[9996] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-plus text-brand mr-1"></i> নতুন ওষুধ (দ্রুত যোগ)</h4>
      <p class="text-xs text-slate-400 mb-4">এখানে যোগ করলে সরাসরি এই ক্রয়-লাইনেই বসে যাবে — qty/দাম/মেয়াদ/ছাড় যা এখানে বসানো আছে তা অক্ষত থাকবে।</p>
      <div id="pur-qa-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>

      <div class="mb-3">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1"><i class="fa-solid fa-cloud-arrow-down text-brand mr-1"></i>গ্লোবাল মাস্টার থেকে খুঁজুন (ঐচ্ছিক)</label>
        <input type="text" id="pur-qa-gm-search-input" placeholder="ব্র্যান্ড নাম টাইপ করুন..." oninput="onPurQaGlobalMedSearch(this.value)"
          class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        <div id="pur-qa-gm-search-results" class="max-h-32 overflow-y-auto mt-1"></div>
        <p class="text-[10px] text-slate-400 mt-1">নির্বাচন করলে জেনেরিক/ক্যাটাগরি/ম্যানুফ্যাকচারার নিচে অটো-ফিল হবে।</p>
      </div>

      <div class="space-y-3 mb-4 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Brand Name (English) *</label>
          <input type="text" id="pur-qa-brand" value="${esc(prefillBrand)}" placeholder="e.g. Maxpro"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ডোজ ফর্ম *</label>
            <select id="pur-qa-doseform" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
              ${doseForms.map(d => `<option value="${esc(d)}" ${d === guessedForm ? 'selected' : ''}>${esc(d)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">শক্তি/পরিমাণ *</label>
            <input type="text" id="pur-qa-strength" placeholder="20mg বা 100ml"
              class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">জেনেরিক নাম</label>
          <input type="text" id="pur-qa-generic" placeholder="ঐচ্ছিক — গ্লোবাল সার্চ থেকে অটো-ফিল হতে পারে"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ক্যাটাগরি</label>
            <input type="text" id="pur-qa-category" placeholder="ঐচ্ছিক"
              class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ম্যানুফ্যাকচারার</label>
            <input type="text" id="pur-qa-manufacturer" placeholder="ঐচ্ছিক"
              class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">রি-অর্ডার লেভেল</label>
          <input type="number" id="pur-qa-reorder" value="10" min="0"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="pur-qa-save-btn" onclick="submitQuickAddMedicine(${i})" class="btn btn-primary flex-1">যোগ করে বসান</button>
        <button onclick="document.getElementById('pur-quickadd-modal').remove()" class="btn btn-secondary">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('pur-quickadd-modal', () => document.getElementById('pur-quickadd-modal')?.remove());
  document.getElementById('pur-qa-brand').focus();
}

function onPurQaGlobalMedSearch(val) {
  clearTimeout(_purQaGmSearchTimer);
  const myToken = ++_purQaGmSearchToken;

  _purQaGmSearchTimer = setTimeout(async () => {
    const box = document.getElementById('pur-qa-gm-search-results');
    if (!box) return;
    if (val.trim().length < 2) { if (myToken === _purQaGmSearchToken) box.innerHTML = ''; return; }

    if (myToken !== _purQaGmSearchToken) return;
    box.innerHTML = '<div class="text-center text-xs text-slate-400 py-2"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    const res = await apiSearchGlobalMedicines(val);
    if (myToken !== _purQaGmSearchToken) return;

    if (!res.success || !res.results.length) {
      box.innerHTML = '<div class="text-center text-xs text-slate-400 py-2">পাওয়া যায়নি</div>';
      return;
    }

    _purQaGmLastResults = res.results;
    box.innerHTML = res.results.map((m, idx) => `
      <div class="flex justify-between items-center py-1.5 px-2 border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer" data-idx="${idx}">
        <div class="min-w-0"><div class="text-xs font-semibold truncate">${esc(m.brand)}</div><div class="text-[10px] text-slate-400 truncate">${esc(m.generic || '')} • ${esc(m.manufacturer || '')}</div></div>
        <i class="fa-solid fa-arrow-turn-down-left text-slate-300 text-xs flex-shrink-0"></i>
      </div>`).join('');

    box.querySelectorAll('[data-idx]').forEach(row => {
      row.addEventListener('click', () => {
        const m = _purQaGmLastResults[parseInt(row.dataset.idx, 10)];
        if (!m) return;
        const genEl = document.getElementById('pur-qa-generic');
        const catEl = document.getElementById('pur-qa-category');
        const mfrEl = document.getElementById('pur-qa-manufacturer');
        if (genEl && !genEl.value) genEl.value = m.generic || '';
        if (catEl && !catEl.value) catEl.value = m.category || '';
        if (mfrEl && !mfrEl.value) mfrEl.value = m.manufacturer || '';
        toast(`"${m.brand}" থেকে জেনেরিক/ক্যাটাগরি/ম্যানুফ্যাকচারার প্রি-ফিল হয়েছে।`, 's');
        box.innerHTML = '';
        document.getElementById('pur-qa-gm-search-input').value = '';
      });
    });
  }, 350);
}

async function submitQuickAddMedicine(i) {
  const errEl = document.getElementById('pur-qa-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  const brand = normalizeBrandText(document.getElementById('pur-qa-brand').value);
  const doseForm = document.getElementById('pur-qa-doseform').value;
  const strength = document.getElementById('pur-qa-strength').value.trim();
  const generic = document.getElementById('pur-qa-generic').value.trim();
  const category = document.getElementById('pur-qa-category').value.trim();
  const manufacturer = document.getElementById('pur-qa-manufacturer').value.trim();
  const reorderLevel = parseInt(document.getElementById('pur-qa-reorder').value) || 10;

  if (!brand) return showErr('Brand Name আবশ্যক।');
  if (!isEnglishBrand(brand)) return showErr('Brand Name অবশ্যই ইংরেজি অক্ষরে লিখতে হবে।');
  if (!strength) return showErr('শক্তি/পরিমাণ আবশ্যক।');

  const dup = findDuplicateMedicine(brand, doseForm, strength, null);
  if (dup) return showErr(`এই ওষুধ ইতিমধ্যে আছে (${dup.id}) — সার্চ-বক্সে টাইপ করে সরাসরি নির্বাচন করুন।`);

  const btn = document.getElementById('pur-qa-save-btn');
  btn.disabled = true;
  btn.textContent = 'যোগ হচ্ছে...';

  try {
    const id = genMedicineId(brand);
    const res = await apiAddMedicine({ id, brand, generic, doseForm, strength, manufacturer, category, unit: 'পাতা', reorderLevel });
    if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'যোগ করে বসান'; return; }

    if (res.queued) {
      toast(res.message, 'w');
      refreshSyncBadge();
      document.getElementById('pur-quickadd-modal')?.remove();
      toast('অফলাইনে যোগ হয়েছে — সিঙ্ক শেষ হলে সার্চ করে ম্যানুয়ালি এই লাইনে বসান।', 'w');
      return;
    }

    const newMed = { id, brand, generic, doseForm, strength, manufacturer, category, unit: 'পাতা', reorderLevel };
    const invRow = { medId: id, brand, doseForm, strength, totalStock: 0, costValue: 0, mrpValue: 0, sellPrice: 0, nearestExpiry: '', status: 'out', batches: [] };
    APP_STATE.medicines.push(newMed);
    APP_STATE.inventory.push(invRow);

    // ✅ টার্গেটেড আপডেট — qty/purchasePrice/mrp/expiry/discount অক্ষত থাকছে
    const item = APP_STATE.purItems[i];
    item.medId = id;
    item.brand = brand;
    item.doseForm = doseForm;
    item.strength = strength;
    if (item.aiScanned) { item.aiMatched = true; }

    renderPurItems();
    calcPurTotal(); // ✅ ফিক্স — আগে কল করা হতো না, তাই quick-add-এর পরে টোটাল/effective-discount stale থাকত
    toast(`"${brand}" ওষুধ মাস্টারে যোগ হয়েছে এবং এই লাইনে বসানো হয়েছে।`, 's');
    document.getElementById('pur-quickadd-modal')?.remove();
  } catch (err) {
    showErr(humanizeError(err));
    btn.disabled = false;
    btn.textContent = 'যোগ করে বসান';
  }
}
