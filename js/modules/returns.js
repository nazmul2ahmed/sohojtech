'use strict';

function renderReturnsModule() {
  const c = document.getElementById('returns-content');
  if (!c) return;
  APP_STATE.retMode = APP_STATE.retMode || 'customer';
  c.innerHTML = `
    <div class="flex gap-2 mb-4 flex-wrap">
      <button onclick="setRetMode('customer')" id="ret-tab-customer" class="btn flex-1"></button>
      <button onclick="setRetMode('supplier')" id="ret-tab-supplier" class="btn flex-1"></button>
      <button onclick="setRetMode('noInvoice')" id="ret-tab-noinvoice" class="btn flex-1"></button>
    </div>
    <div id="ret-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-3 py-2 mb-3"></div>
    <div id="ret-form"></div>
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mt-4">
      <div class="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-2">
        <h6 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-clock-rotate-left text-brand mr-1"></i> রিটার্ন তালিকা</h6>
        <input type="date" id="ret-list-date" value="${APP_STATE.retListDate || todayStr()}" onchange="onRetListDateChange(this.value)"
          class="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      </div>
      <div id="ret-today-list" class="max-h-72 overflow-y-auto"></div>
    </div>`;
  updateRetTabsUI();
  renderRetForm();
  renderTodayReturns();
}

function setRetMode(m) {
  APP_STATE.retMode = m;
  updateRetTabsUI();
  renderRetForm();
}

function updateRetTabsUI() {
  const cb = document.getElementById('ret-tab-customer'), sb = document.getElementById('ret-tab-supplier'), nb = document.getElementById('ret-tab-noinvoice');
  if (!cb) return;
  cb.textContent = 'কাস্টমার রিটার্ন';
  sb.textContent = 'সাপ্লায়ার রিটার্ন / এক্সপায়ারি';
  nb.textContent = 'ইনভয়েস ছাড়া রিটার্ন';
  cb.className = `btn flex-1 ${APP_STATE.retMode === 'customer' ? 'btn-primary' : 'btn-secondary'}`;
  sb.className = `btn flex-1 ${APP_STATE.retMode === 'supplier' ? 'btn-warning' : 'btn-secondary'}`;
  nb.className = `btn flex-1 ${APP_STATE.retMode === 'noInvoice' ? 'btn-primary' : 'btn-secondary'}`;
}

function returnedQty(refId, medId, type) {
  const synced = APP_STATE.returns.filter(r => r.returnType === type && r.refId === refId);
  // ✅ ফিক্স (ধাপ ০.১.৩): queue হওয়া কিন্তু এখনো sync-না-হওয়া রিটার্নও এই
  // cap-হিসাবে ধরা হচ্ছে — নাহলে অফলাইনে দুইবার আংশিক রিটার্ন করলে দ্বিতীয়বার
  // ভুল (বেশি) maxQty দেখিয়ে over-return অনুমোদন করে ফেলতে পারত।
  const pending = (APP_STATE.pendingReturns || []).filter(r => r.returnType === type && r.refId === refId);
  return [...synced, ...pending]
    .flatMap(r => r.items).filter(i => i.medId === medId).reduce((a, b) => a + b.qty, 0);
}

// ✅ নতুন (offset-নির্ভুল): মূল সেলের consumedBatches থেকে ঠিক returnQty পরিমাণ
// batch-portion বের করে আনে — কিন্তু প্রথমে alreadyReturnedQty পরিমাণ FEFO
// অর্ডারে "স্কিপ" করে, যাতে একই ইনভয়েসে একাধিক আংশিক রিটার্ন হলেও প্রতিবার
// সঠিক (আগে-ফেরত-না-হওয়া) ব্যাচ-অংশটাই বাছাই হয়, কোনো ওভারল্যাপ ছাড়া।
function extractConsumedBatchPortion(consumedBatches, alreadyReturnedQty, returnQty) {
  if (!consumedBatches || !consumedBatches.length) return null;
  let skip = alreadyReturnedQty;
  let remaining = returnQty;
  const portion = [];

  for (const cb of consumedBatches) {
    let availableQty = cb.qty;
    if (skip > 0) {
      if (skip >= availableQty) { skip -= availableQty; continue; }
      availableQty -= skip;
      skip = 0;
    }
    if (remaining <= 0) break;
    const take = Math.min(availableQty, remaining);
    if (take > 0) {
      portion.push({ batchId: cb.batchId, qty: take, cost: cb.cost });
      remaining -= take;
    }
  }
  return portion.length ? portion : null;
}
// ════════════════════════════════════════════════════════════
// CUSTOMER RETURN FORM
// ════════════════════════════════════════════════════════════
function renderRetForm() {
  const box = document.getElementById('ret-form');
  if (APP_STATE.retMode === 'customer') {
    box.innerHTML = `
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Invoice নির্বাচন করুন <span class="text-red-500">*</span></label>
        <div id="sd-ret-invoice" class="mb-2"></div>
        ${capHintHTML('sales', 'ret-c-load-older-btn', 'renderRetForm', 'সাম্প্রতিক ৮,০০০টার বেশি পুরনো Invoice এখনো তালিকায় নেই — কাঙ্ক্ষিত ইনভয়েস না পেলে লোড করুন।')}
        <div id="ret-cust-items"></div>
      </div>`;
    const opts = APP_STATE.sales.map(s => ({ value: s.invoiceNo, label: s.invoiceNo + ' — ' + s.customerName, sub: s.date + ' • ৳' + fmt(s.totalBill) }));
    createSD('sd-ret-invoice', opts, onRetInvoiceSelect, '— Invoice খুঁজুন —');
  } else if (APP_STATE.retMode === 'supplier') {
    box.innerHTML = `
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Purchase নির্বাচন করুন <span class="text-red-500">*</span></label>
        <div id="sd-ret-purchase" class="mb-2"></div>
        ${capHintHTML('purchases', 'ret-s-load-older-btn', 'renderRetForm', 'সাম্প্রতিক ৮,০০০টার বেশি পুরনো Purchase এখনো তালিকায় নেই — কাঙ্ক্ষিত ক্রয় না পেলে লোড করুন।')}
        <div id="ret-sup-items"></div>
      </div>`;
    const opts = APP_STATE.purchases.map(p => ({ value: p.purchaseId, label: p.purchaseId + ' — ' + p.supplierName, sub: p.date + ' • ৳' + fmt(p.totalCost) }));
    createSD('sd-ret-purchase', opts, onRetPurchaseSelect, '— Purchase খুঁজুন —');
  } else {
    renderNoInvoiceReturnForm();
  }
}

function onRetInvoiceSelect(invoiceNo) {
  const box = document.getElementById('ret-cust-items');
  if (!invoiceNo) { box.innerHTML = ''; return; }
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  const customer = APP_STATE.customers.find(c => c.id === sale.customerId);
  const rows = sale.items.map((item, i) => {
    const already = returnedQty(invoiceNo, item.medId, 'customer');
    const maxQty = item.qty - already;
    return `<div class="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
      <div class="flex-1 min-w-0"><div class="text-sm font-semibold">${esc(item.name)}</div><div class="text-[11px] text-slate-400">বিক্রিত: ${item.qty} | ফেরতযোগ্য: ${maxQty}</div></div>
      <input type="number" id="ret-c-qty-${i}" min="0" max="${maxQty}" value="0" oninput="calcRetCustTotal()"
        class="w-20 px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
    </div>`;
  }).join('');
  const dueNote = customer && customer.due > 0
    ? `<label class="flex items-center gap-2 text-sm py-1"><input type="radio" name="ret-c-method" value="বাকি সমন্বয়" checked> বাকির সাথে সমন্বয় (বর্তমান বাকি ৳${fmt(customer.due)})</label>
       <label class="flex items-center gap-2 text-sm py-1"><input type="radio" name="ret-c-method" value="নগদ ফেরত"> নগদ ফেরত</label>`
    : `<input type="hidden" id="ret-c-method-fixed" value="নগদ ফেরত"><p class="text-sm text-slate-500">কোনো বাকি নেই — নগদ ফেরত হবে।</p>`;

  box.innerHTML = `
    <div class="mt-2 mb-3">${rows}</div>
    <div class="mb-3">${dueNote}</div>
    <div class="flex justify-between items-center mb-3 bg-brand/10 rounded-lg px-3 py-2">
      <span class="text-sm font-semibold">মোট ফেরত পরিমাণ</span><span id="ret-c-total" class="font-mono font-bold text-brand">৳০.০০</span>
    </div>
    <button id="ret-c-submit-btn" onclick="submitCustomerReturn('${invoiceNo}')" class="btn btn-primary btn-block">রিটার্ন নিশ্চিত করুন</button>`;
}

function calcRetCustTotal() {
  const sale = APP_STATE.sales.find(s => s.invoiceNo === sdGetValue('sd-ret-invoice'));
  if (!sale) return;
  let total = 0;
  sale.items.forEach((item, i) => {
    const qty = parseFloat(document.getElementById(`ret-c-qty-${i}`)?.value) || 0;
    const gross = qty * item.price;
    total += gross - gross * (item.discountPct || 0) / 100;
  });
  setText('ret-c-total', '৳' + fmt(round2(total)));
}

async function submitCustomerReturn(invoiceNo) {
  if (guardReadOnly()) return;
  hideEl('ret-error');
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  const customer = APP_STATE.customers.find(c => c.id === sale.customerId);
  const method = customer && customer.due > 0
    ? document.querySelector('input[name="ret-c-method"]:checked')?.value
    : 'নগদ ফেরত';

  const items = [];
  let amount = 0, cost = 0;
  for (let i = 0; i < sale.items.length; i++) {
    const item = sale.items[i];
    const qty = parseFloat(document.getElementById(`ret-c-qty-${i}`)?.value) || 0;
    if (qty <= 0) continue;
    const already = returnedQty(invoiceNo, item.medId, 'customer');
    if (qty > item.qty - already) return showRetError(`"${item.name}" ফেরতযোগ্য সীমা অতিক্রম করেছে।`);
    const gross = qty * item.price;
    const lineAmt = round2(gross - gross * (item.discountPct || 0) / 100);
    amount += lineAmt; cost += qty * (item.costPrice || 0);
    items.push({
      medId: item.medId, name: item.name, qty, price: item.price,
      discountPct: item.discountPct, costPrice: item.costPrice,
      consumedBatches: extractConsumedBatchPortion(item.consumedBatches, already, qty),
    });
  }
  if (!items.length) return showRetError('কমপক্ষে একটি ওষুধের পরিমাণ দিন।');
  amount = round2(amount);

  if (method === 'বাকি সমন্বয়' && amount > customer.due + 0.01) {
    return showRetError('ফেরতের পরিমাণ বাকির চেয়ে বেশি — নগদ ফেরত নির্বাচন করুন।');
  }

  const returnDoc = {
    returnId: 'RET-' + Date.now(), date: todayStr(), returnType: 'customer',
    refId: invoiceNo, refName: sale.customerName, partyId: sale.customerId,
    items, amount, cost: round2(cost), refundMethod: method,
  };

  const btn = document.getElementById('ret-c-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> প্রক্রিয়াকরণ হচ্ছে...';

  const custDueReduction = method === 'বাকি সমন্বয়' ? amount : 0;

  try {
    const res = await apiSubmitCustomerReturn(returnDoc, sale.customerId, custDueReduction);
    if (!res.success) {
      showRetError(res.message);
      btn.disabled = false;
      btn.textContent = 'রিটার্ন নিশ্চিত করুন';
      return;
    }

    if (res.queued) {
      toast(res.message, 'w');
      refreshSyncBadge();
      openReceiptModal('return', returnDoc); // ✅ অফলাইনেও কাউন্টারে ফিজিক্যাল রিসিট লাগে
    } else {
      items.forEach(item => restockItem(item.medId, item.qty, item.costPrice, item.consumedBatches));
      if (method === 'বাকি সমন্বয়') applyCustomerDueChange(sale.customerId, -amount, 0);
      APP_STATE.returns.push(returnDoc);
      toast(res.message, 's');
      openReceiptModal('return', returnDoc);
    }

    renderRetForm(); renderTodayReturns();
  } catch (err) {
    showFatalError('রিটার্ন সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'রিটার্ন নিশ্চিত করুন';
  }
}

// ════════════════════════════════════════════════════════════
// SUPPLIER RETURN / EXPIRY WRITE-OFF FORM
// ✅ ফিক্স: ফেরতযোগ্য সীমা এখন দুটোর মধ্যে ছোটটা —
//   (ক) এই Purchase-এ মূল ক্রয় থেকে যা বাকি আছে, এবং
//   (খ) নির্দিষ্ট ব্যাচের (batch-specific) বর্তমান স্টক — medicine-wide totalStock না
// ════════════════════════════════════════════════════════════
function onRetPurchaseSelect(purId) {
  const box = document.getElementById('ret-sup-items');
  if (!purId) { box.innerHTML = ''; return; }
  const pur = APP_STATE.purchases.find(p => p.purchaseId === purId);
  const rows = pur.items.map((item, i) => {
    const alreadyOnThisPurchase = returnedQty(purId, item.medId, 'supplier');
    const purchaseCap = item.qty - alreadyOnThisPurchase;
    const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
    const hasBatchTracking = !!item.batchId;
    const batchStock = hasBatchTracking
      ? (inv?.batches.find(b => b.batchId === item.batchId)?.stock || 0)
      : (inv?.totalStock || 0);
    const maxQty = Math.max(0, Math.min(purchaseCap, batchStock));
    const stockNote = !hasBatchTracking
      ? `<span class="text-amber-600">পুরনো এন্ট্রি — batch-tracking নেই, আনুমানিক সীমা</span>`
      : batchStock < purchaseCap
        ? `<span class="text-amber-600">এই নির্দিষ্ট ব্যাচে বর্তমান স্টক ${batchStock}টা (কম) দিয়ে সীমাবদ্ধ</span>`
        : `ফেরতযোগ্য: ${maxQty}`;
    return `<div class="flex items-center gap-3 py-2 border-b border-slate-100 dark:border-slate-700/50">
      <div class="flex-1 min-w-0"><div class="text-sm font-semibold">${esc(item.brand)}</div><div class="text-[11px] text-slate-400">ক্রয়: ${item.qty} | ${stockNote}</div></div>
      <input type="number" id="ret-s-qty-${i}" min="0" max="${maxQty}" value="0" oninput="calcRetSupTotal()"
        class="w-20 px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
    </div>`;
  }).join('');
  const supplier = APP_STATE.suppliers.find(s => s.id === pur.supplierId);

  box.innerHTML = `
    <div class="mt-2 mb-3">${rows}</div>
    <div class="mb-3">
      <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">কারণ</label>
      <label class="flex items-center gap-2 text-sm py-1"><input type="radio" name="ret-s-reason" value="ফেরত" checked onchange="toggleRetSupReasonUI()"> সরবরাহকারীতে ফেরত (ভুল/ড্যামেজড আইটেম)</label>
      <label class="flex items-center gap-2 text-sm py-1"><input type="radio" name="ret-s-reason" value="ধ্বংস" onchange="toggleRetSupReasonUI()"> মেয়াদোত্তীর্ণ — সরাসরি ধ্বংস (Write-off / Loss)</label>
    </div>
    <div id="ret-s-method-box" class="mb-3">
      <label class="flex items-center gap-2 text-sm py-1"><input type="radio" name="ret-s-method" value="পাওনা সমন্বয়" checked> সরবরাহকারীর পাওনা কমবে (বর্তমান পাওনা ৳${fmt(supplier?.totalPayable || 0)})</label>
      <label class="flex items-center gap-2 text-sm py-1"><input type="radio" name="ret-s-method" value="নগদ ফেরত"> নগদ ফেরত পাওয়া গেছে</label>
    </div>
    <div class="flex justify-between items-center mb-3 bg-amber-500/10 rounded-lg px-3 py-2">
      <span class="text-sm font-semibold">মোট পরিমাণ</span><span id="ret-s-total" class="font-mono font-bold text-amber-600">৳০.০০</span>
    </div>
    <button id="ret-s-submit-btn" onclick="submitSupplierReturn('${purId}')" class="btn btn-warning btn-block">রিটার্ন/রাইট-অফ নিশ্চিত করুন</button>`;
}

function toggleRetSupReasonUI() {
  const isWriteOff = document.querySelector('input[name="ret-s-reason"]:checked').value === 'ধ্বংস';
  document.getElementById('ret-s-method-box').classList.toggle('hidden', isWriteOff);
}

function calcRetSupTotal() {
  const pur = APP_STATE.purchases.find(p => p.purchaseId === sdGetValue('sd-ret-purchase'));
  if (!pur) return;
  let total = 0;
  pur.items.forEach((item, i) => {
    const qty = parseFloat(document.getElementById(`ret-s-qty-${i}`)?.value) || 0;
    total += qty * item.purchasePrice;
  });
  setText('ret-s-total', '৳' + fmt(round2(total)));
}

async function submitSupplierReturn(purId) {
  if (guardReadOnly()) return;
  hideEl('ret-error');
  const pur = APP_STATE.purchases.find(p => p.purchaseId === purId);
  const supplier = APP_STATE.suppliers.find(s => s.id === pur.supplierId);
  const reason = document.querySelector('input[name="ret-s-reason"]:checked').value;
  const method = reason === 'ফেরত' ? document.querySelector('input[name="ret-s-method"]:checked').value : null;

  const items = []; let amount = 0;
  for (let i = 0; i < pur.items.length; i++) {
    const item = pur.items[i];
    const qty = parseFloat(document.getElementById(`ret-s-qty-${i}`)?.value) || 0;
    if (qty <= 0) continue;
    const alreadyOnThisPurchase = returnedQty(purId, item.medId, 'supplier');
    const purchaseCap = item.qty - alreadyOnThisPurchase;
    const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
    const hasBatchTracking = !!item.batchId;
    const currentStock = hasBatchTracking
      ? (inv?.batches.find(b => b.batchId === item.batchId)?.stock || 0)
      : (inv?.totalStock || 0);
    const allowedMax = Math.max(0, Math.min(purchaseCap, currentStock));
    if (qty > allowedMax) {
      if (currentStock < purchaseCap) {
        const label = hasBatchTracking ? 'এই নির্দিষ্ট ব্যাচে বর্তমান স্টক' : 'বর্তমান স্টক';
        return showRetError(`"${item.brand}" — ${label} মাত্র ${currentStock}টা, এত ফেরত দেওয়া সম্ভব না।`);
      }
      return showRetError(`"${item.brand}" ফেরতযোগ্য সীমা অতিক্রম করেছে।`);
    }
    amount += qty * item.purchasePrice;
    items.push({ medId: item.medId, name: item.brand, qty, purchasePrice: item.purchasePrice, batchId: item.batchId || null });
  }
  if (!items.length) return showRetError('কমপক্ষে একটি ওষুধের পরিমাণ দিন।');
  amount = round2(amount);

  const returnDoc = {
    returnId: 'RET-' + Date.now(), date: todayStr(), returnType: 'supplier',
    refId: purId, refName: pur.supplierName, partyId: pur.supplierId,
    items, amount, cost: amount, reason, refundMethod: method,
  };

  const btn = document.getElementById('ret-s-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> প্রক্রিয়াকরণ হচ্ছে...';

  const supPayableReduction = (reason === 'ফেরত' && method === 'পাওনা সমন্বয়') ? amount : 0;

  try {
    const res = await apiSubmitSupplierReturn(returnDoc, pur.supplierId, supPayableReduction);
    if (!res.success) {
      showRetError(res.message);
      btn.disabled = false;
      btn.textContent = 'রিটার্ন/রাইট-অফ নিশ্চিত করুন';
      return;
    }

    if (res.queued) {
      toast(res.message, 'w');
      refreshSyncBadge();
      openReceiptModal('return', returnDoc);
    } else {
      items.forEach(item => {
        if (item.batchId) {
          const dres = destockByBatchId(item.medId, item.batchId, item.qty);
          if (!dres.success) console.warn('Local mirror destock সমস্যা:', dres.message);
        } else {
          destockItem(item.medId, item.qty);
        }
      });
      if (supPayableReduction > 0) applySupplierPayableChange(pur.supplierId, -amount, 0);
      APP_STATE.returns.push(returnDoc);
      toast(res.message, 's');
      openReceiptModal('return', returnDoc);
    }

    renderRetForm(); renderTodayReturns();
  } catch (err) {
    showFatalError('রিটার্ন সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'রিটার্ন/রাইট-অফ নিশ্চিত করুন';
  }
}

function showRetError(msg) { const el = document.getElementById('ret-error'); el.textContent = msg; el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 5000); }

function onRetListDateChange(val) {
  APP_STATE.retListDate = val || todayStr();
  renderTodayReturns();
}

function renderTodayReturns() {
  const box = document.getElementById('ret-today-list');
  const filterDate = APP_STATE.retListDate || todayStr();
  const list = APP_STATE.returns.filter(r => r.date === filterDate).slice().reverse();
  box.innerHTML = list.length ? list.map(r => `
    <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center">
      <div class="min-w-0">
        <div class="text-sm font-semibold truncate">${esc(r.refName)} <span class="text-[11px] text-slate-400">(${r.returnType === 'customer' ? 'কাস্টমার' : (r.reason === 'ধ্বংস' ? 'রাইট-অফ' : 'সাপ্লায়ার')})</span></div>
        <div class="text-[11px] text-slate-400">${esc(r.refId)}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="font-mono font-bold text-sm ${r.returnType === 'customer' ? 'text-red-500' : r.reason === 'ধ্বংস' ? 'text-red-600' : 'text-amber-600'}">৳${fmt(r.amount)}</span>
        <button onclick="reprintReturnReceipt('${r.returnId}')" class="text-slate-400 hover:text-brand text-xs"><i class="fa-solid fa-print"></i></button>
        <button onclick="deleteReturnConfirm('${r.returnId}')" class="text-red-400 hover:text-red-600 text-xs"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('') : `<div class="px-4 py-8 text-center text-slate-400 text-sm">এই তারিখে কোনো রিটার্ন নেই</div>`;
}

// ────────────────────────────────────────────────────────────
// DELETE RETURN
// ────────────────────────────────────────────────────────────
async function deleteReturnConfirm(returnId) {
  if (guardReadOnly()) return;
  const ret = APP_STATE.returns.find(r => r.returnId === returnId);
  if (!ret || !confirm('এই রিটার্ন মুছবেন? প্রভাব উল্টানো হবে।')) return;
  try {
    const res = await apiDeleteReturn(ret);
    if (!res.success) return toast(res.message, 'w');
    if (ret.returnType === 'customer') {
      // ✅ সংশোধন: generic destockItem()-এর বদলে consumedBatches-সচেতন precise destock
      ret.items.forEach(item => destockFromConsumed(item.medId, item.qty, item.consumedBatches));
      if (ret.refundMethod === 'বাকি সমন্বয়') applyCustomerDueChange(ret.partyId, ret.amount, 0);
    } else {
      // ✅ সংশোধন: batchId থাকলে precise batch-level restock (consumedBatches শেপে বানিয়ে পাঠানো হচ্ছে)
      ret.items.forEach(item => {
        const consumedBatches = item.batchId ? [{ batchId: item.batchId, qty: item.qty, cost: item.purchasePrice }] : null;
        restockItem(item.medId, item.qty, item.purchasePrice, consumedBatches);
      });
      if (ret.reason === 'ফেরত' && ret.refundMethod === 'পাওনা সমন্বয়') applySupplierPayableChange(ret.partyId, ret.amount, 0);
    }
    APP_STATE.returns = APP_STATE.returns.filter(r => r.returnId !== returnId);
    toast(res.message, 's');
    renderTodayReturns();
  } catch (err) { showFatalError('রিটার্ন মুছতে সমস্যা:\n' + humanizeError(err), err); }
}

// ════════════════════════════════════════════════════════════
// ✅ নতুন — ইনভয়েস ছাড়া রিটার্ন। গ্রাহক পুরনো ইনভয়েস হারিয়ে ফেললে,
// নির্দিষ্ট invoice-এ লিংক না করে বিক্রয়মূল্য (MRP না) থেকে জেনেরিক
// ছাড় (ডিফল্ট ১০%) কেটে নগদ ফেরত দেওয়া হয়। কোনো invoice-cap validation
// প্রযোজ্য না, সবসময় নগদ ফেরত (customer-account ছোঁয়া হয় না)।
// ════════════════════════════════════════════════════════════
const NO_INVOICE_RETURN_DEFAULT_DISCOUNT_PCT = 10;

function renderNoInvoiceReturnForm() {
  const box = document.getElementById('ret-form');
  APP_STATE.noInvItems = APP_STATE.noInvItems || [];
  APP_STATE.noInvDiscountPct = (APP_STATE.noInvDiscountPct != null) ? APP_STATE.noInvDiscountPct : NO_INVOICE_RETURN_DEFAULT_DISCOUNT_PCT;
  if (!APP_STATE.noInvItems.length) APP_STATE.noInvItems.push({ medId: '', name: '', qty: 1, sellPrice: 0 });

  box.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 mb-4">
        <i class="fa-solid fa-circle-info mr-1"></i> ইনভয়েস প্রমাণ ছাড়া রিটার্ন — বিক্রয়মূল্য (MRP না) থেকে জেনেরিক ছাড় কেটে নগদ ফেরত। ইনভয়েস দেখাতে পারলে "কাস্টমার রিটার্ন" ট্যাব থেকে সঠিক ক্রয়-মূল্যে করুন।
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">গ্রাহকের নাম (ঐচ্ছিক)</label>
          <input type="text" id="noinv-cust-name" placeholder="নাম না জানলে খালি রাখুন"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">জেনেরিক ছাড় % (বিক্রয়মূল্য থেকে)</label>
          <input type="number" id="noinv-disc-pct" value="${APP_STATE.noInvDiscountPct}" min="0" max="100" step="0.01"
            oninput="onNoInvDiscPctChange(this.value)"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
      </div>
      <div id="noinv-items-list" class="space-y-2 mb-3"></div>
      <button onclick="addNoInvoiceReturnItem()" class="btn btn-brand-outline btn-sm mb-4">
        <i class="fa-solid fa-plus"></i> ওষুধ যোগ করুন
      </button>
      <div class="flex justify-between items-center mb-3 bg-brand/10 rounded-lg px-3 py-2">
        <span class="text-sm font-semibold">মোট ফেরত পরিমাণ (নগদ)</span><span id="noinv-total" class="font-mono font-bold text-brand">৳০.০০</span>
      </div>
      <button id="noinv-submit-btn" onclick="submitNoInvoiceReturn()" class="btn btn-primary btn-block">রিটার্ন নিশ্চিত করুন (নগদ ফেরত)</button>
    </div>`;

  renderNoInvoiceReturnItems();
}

function addNoInvoiceReturnItem() {
  APP_STATE.noInvItems.push({ medId: '', name: '', qty: 1, sellPrice: 0 });
  renderNoInvoiceReturnItems();
}

function removeNoInvoiceReturnItem(i) {
  if (APP_STATE.noInvItems.length <= 1) { toast('কমপক্ষে একটি সারি থাকতে হবে।', 'w'); return; }
  closeMedDisambiguation();
  APP_STATE.noInvItems.splice(i, 1);
  renderNoInvoiceReturnItems();
}

function buildNoInvMedDisplayText(m) {
  return `${m.brand} ${m.doseForm || ''} ${m.strength || ''}`.trim();
}

function renderNoInvoiceReturnItems() {
  const container = document.getElementById('noinv-items-list');
  if (!container) return;
  const discPct = APP_STATE.noInvDiscountPct || 0;

  container.innerHTML = APP_STATE.noInvItems.map((item, i) => {
    const unitRefund = round2((item.sellPrice || 0) * (1 - discPct / 100));
    const lineTotal = round2(unitRefund * (item.qty || 0));
    // ✅ ফিক্স: item.brand না (noInvItems-এন্ট্রিতে এই ফিল্ড নেই — এখানে
    // item.name ব্যবহৃত হয়), তাই buildNoInvMedDisplayText() সরাসরি item-এ
    // কল করলে "undefined" আসত। এখানে item.name দিয়ে সরাসরি বানানো হচ্ছে।
    const displayVal = item.medId ? `${item.name} ${item.doseForm || ''} ${item.strength || ''}`.trim() : '';
    return `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-3 relative bg-slate-50 dark:bg-slate-900/30">
      <button onclick="removeNoInvoiceReturnItem(${i})" class="absolute top-2 right-2 text-slate-400 hover:text-red-500">
        <i class="fa-solid fa-xmark"></i>
      </button>
      <div class="grid grid-cols-12 gap-2">
        <div class="col-span-12 md:col-span-6">
          <label class="block text-[11px] text-slate-400 mb-1">ওষুধ <span class="text-red-500">*</span></label>
          <input type="text" id="noinv-med-input-${i}" list="noinv-med-list-${i}" value="${esc(displayVal)}"
            placeholder="— ওষুধ সার্চ করুন —" autocomplete="off"
            onchange="onNoInvMedicineChange(${i})" onkeydown="onNoInvMedicineKeydown(event, ${i})"
            class="w-full px-2.5 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          <datalist id="noinv-med-list-${i}">
            ${APP_STATE.medicines.map(m => `<option value="${esc(m.brand + ' ' + (m.doseForm||'') + ' ' + (m.strength||''))}"></option>`).join('')}
          </datalist>
        </div>
        <div class="col-span-4 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">Qty</label>
          <input type="number" id="noinv-qty-${i}" value="${item.qty}" min="1"
            oninput="onNoInvFieldChange(${i})" class="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-4 md:col-span-2">
          <label class="block text-[11px] text-slate-400 mb-1">বিক্রয়মূল্য</label>
          <div class="px-2 py-1.5 text-sm font-mono text-slate-500">৳${fmt(item.sellPrice || 0)}</div>
        </div>
        <div class="col-span-4 md:col-span-2 flex flex-col justify-end">
          <label class="block text-[11px] text-slate-400 mb-1">ফেরত (৳)</label>
          <div id="noinv-linetotal-${i}" class="px-2 py-1.5 text-sm font-mono font-bold text-brand">৳${fmt(lineTotal)}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  calcNoInvoiceReturnTotal();
}

function onNoInvMedicineChange(i) {
  const inputEl = document.getElementById(`noinv-med-input-${i}`);
  if (!inputEl) return;
  const val = inputEl.value;
  const result = resolveMedicineMatch(val, APP_STATE.medicines, buildNoInvMedDisplayText);
  if (result.type === 'exact') { closeMedDisambiguation(); applyMedicineToNoInvItem(i, result.match); return; }
  if (result.type === 'ambiguous') {
    showMedDisambiguation(inputEl, result.matches, buildNoInvMedDisplayText, (chosen) => {
      inputEl.value = buildNoInvMedDisplayText(chosen);
      applyMedicineToNoInvItem(i, chosen);
    });
    return;
  }
  applyMedicineToNoInvItem(i, null);
  if (val.trim()) toast('ওষুধ খুঁজে পাওয়া যায়নি।', 'w');
}

function onNoInvMedicineKeydown(e, i) {
  const inputEl = document.getElementById(`noinv-med-input-${i}`);
  if (isMedDisambiguationOpenFor(inputEl) && medDisambiguationHandleKey(e)) return;
  if (e.key !== 'Enter') return;
  e.preventDefault();
  onNoInvMedicineChange(i);
}

function applyMedicineToNoInvItem(i, med) {
  const item = APP_STATE.noInvItems[i];
  if (med) {
    const inv = APP_STATE.inventory.find(x => x.medId === med.id);
    item.medId = med.id; item.name = med.brand; item.doseForm = med.doseForm; item.strength = med.strength;
    item.sellPrice = inv?.sellPrice || 0;
  } else {
    item.medId = ''; item.name = ''; item.sellPrice = 0;
  }
  renderNoInvoiceReturnItems();
}

function onNoInvFieldChange(i) {
  const item = APP_STATE.noInvItems[i];
  if (!item) return;
  item.qty = Math.max(0, parseFloat(document.getElementById(`noinv-qty-${i}`).value) || 0);
  calcNoInvoiceReturnTotal();
}

function onNoInvDiscPctChange(val) {
  APP_STATE.noInvDiscountPct = clamp(parseFloat(val) || 0, 0, 100);
  renderNoInvoiceReturnItems();
}

function calcNoInvoiceReturnTotal() {
  const discPct = APP_STATE.noInvDiscountPct || 0;
  let total = 0;
  APP_STATE.noInvItems.forEach((item, i) => {
    const unitRefund = round2((item.sellPrice || 0) * (1 - discPct / 100));
    const lineTotal = round2(unitRefund * (item.qty || 0));
    total += lineTotal;
    const el = document.getElementById(`noinv-linetotal-${i}`);
    if (el) el.textContent = '৳' + fmt(lineTotal);
  });
  setText('noinv-total', '৳' + fmt(round2(total)));
}

async function submitNoInvoiceReturn() {
  if (guardReadOnly()) return;
  hideEl('ret-error');
  const discPct = APP_STATE.noInvDiscountPct || 0;
  const custName = document.getElementById('noinv-cust-name')?.value.trim() || 'অজানা গ্রাহক (নো-ইনভয়েস)';

  const items = [];
  let amount = 0, cost = 0;
  for (const item of APP_STATE.noInvItems) {
    if (!item.medId || !item.qty || item.qty <= 0) continue;
    const unitRefund = round2((item.sellPrice || 0) * (1 - discPct / 100));
    const lineTotal = round2(unitRefund * item.qty);
    const inv = APP_STATE.inventory.find(m => m.medId === item.medId);
    const costPrice = inv?.batches?.[0]?.cost || 0; // আনুমানিক — আসল ব্যাচ অজানা
    amount += lineTotal;
    cost += costPrice * item.qty;
    // ✅ ফিক্স: price এখন গ্রস (sellPrice), discountPct আলাদা — receipt.js-এর
    // buildReturnReceiptConfig()-এর কনভেনশনের সাথে মিলিয়ে (gross × (1-disc%)),
    // আগে price-তেই net বসিয়ে discountPct আবার apply হয়ে ডাবল-ছাড় হচ্ছিল
    items.push({ medId: item.medId, name: item.name, qty: item.qty, price: item.sellPrice || 0, discountPct: discPct, costPrice, consumedBatches: null });
  }
  if (!items.length) return showRetError('কমপক্ষে একটি ওষুধের পরিমাণ দিন।');
  amount = round2(amount);
  cost = round2(cost);

  const returnDoc = {
    returnId: 'RET-' + Date.now(), date: todayStr(), returnType: 'customer',
    refId: 'NO-INVOICE', refName: custName, partyId: null,
    items, amount, cost, refundMethod: 'নগদ ফেরত',
    noInvoice: true, genericDiscountPct: discPct,
  };

  const btn = document.getElementById('noinv-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> প্রক্রিয়াকরণ হচ্ছে...';

  try {
    const res = await apiSubmitCustomerReturn(returnDoc, null, 0);
    if (!res.success) {
      showRetError(res.message);
      btn.disabled = false;
      btn.textContent = 'রিটার্ন নিশ্চিত করুন (নগদ ফেরত)';
      return;
    }

    if (res.queued) {
      toast(res.message, 'w');
      refreshSyncBadge();
      openReceiptModal('return', returnDoc);
    } else {
      items.forEach(item => restockItem(item.medId, item.qty, item.costPrice, item.consumedBatches));
      APP_STATE.returns.push(returnDoc);
      toast(res.message, 's');
      openReceiptModal('return', returnDoc);
    }

    APP_STATE.noInvItems = [{ medId: '', name: '', qty: 1, sellPrice: 0 }];
    document.getElementById('noinv-cust-name').value = '';
    renderRetForm();
    renderTodayReturns();
  } catch (err) {
    showFatalError('রিটার্ন সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.textContent = 'রিটার্ন নিশ্চিত করুন (নগদ ফেরত)';
  }
}
