'use strict';

function renderReturnsModule() {
  const c = document.getElementById('returns-content');
  if (!c) return;
  APP_STATE.retMode = APP_STATE.retMode || 'customer';
  c.innerHTML = `
    <div class="flex gap-2 mb-4">
      <button onclick="setRetMode('customer')" id="ret-tab-customer" class="flex-1 py-2 rounded-lg text-sm font-semibold border"></button>
      <button onclick="setRetMode('supplier')" id="ret-tab-supplier" class="flex-1 py-2 rounded-lg text-sm font-semibold border"></button>
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

function setRetMode(m) { APP_STATE.retMode = m; updateRetTabsUI(); renderRetForm(); }

function updateRetTabsUI() {
  const isCust = APP_STATE.retMode === 'customer';
  const cb = document.getElementById('ret-tab-customer'), sb = document.getElementById('ret-tab-supplier');
  if (!cb) return;
  cb.textContent = 'কাস্টমার রিটার্ন';
  sb.textContent = 'সাপ্লায়ার রিটার্ন / এক্সপায়ারি';
  cb.className = `flex-1 py-2 rounded-lg text-sm font-semibold border transition ${isCust ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`;
  sb.className = `flex-1 py-2 rounded-lg text-sm font-semibold border transition ${!isCust ? 'bg-amber-500 text-white border-amber-500' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`;
}

function returnedQty(refId, medId, type) {
  return APP_STATE.returns.filter(r => r.returnType === type && r.refId === refId)
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
  } else {
    box.innerHTML = `
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Purchase নির্বাচন করুন <span class="text-red-500">*</span></label>
        <div id="sd-ret-purchase" class="mb-2"></div>
        ${capHintHTML('purchases', 'ret-s-load-older-btn', 'renderRetForm', 'সাম্প্রতিক ৮,০০০টার বেশি পুরনো Purchase এখনো তালিকায় নেই — কাঙ্ক্ষিত ক্রয় না পেলে লোড করুন।')}
        <div id="ret-sup-items"></div>
      </div>`;
    const opts = APP_STATE.purchases.map(p => ({ value: p.purchaseId, label: p.purchaseId + ' — ' + p.supplierName, sub: p.date + ' • ৳' + fmt(p.totalCost) }));
    createSD('sd-ret-purchase', opts, onRetPurchaseSelect, '— Purchase খুঁজুন —');
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
    <button id="ret-c-submit-btn" onclick="submitCustomerReturn('${invoiceNo}')" class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg">রিটার্ন নিশ্চিত করুন</button>`;
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
      // ✅ সংশোধন: already-returned অফসেট বাদ দিয়ে সঠিক consumedBatches অংশ (আগের বার্তায় ভুলে বাদ পড়েছিল)
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

  try {
    const custDueReduction = method === 'বাকি সমন্বয়' ? amount : 0;
    const res = await apiSubmitCustomerReturn(returnDoc, sale.customerId, custDueReduction);
    if (!res.success) {
      showRetError(res.message);
      btn.disabled = false;
      btn.textContent = 'রিটার্ন নিশ্চিত করুন';
      return;
    }

    // ✅ সংশোধন: item.consumedBatches পাস করা হচ্ছে — সঠিক ব্যাচে স্টক ফেরত
    items.forEach(item => restockItem(item.medId, item.qty, item.costPrice, item.consumedBatches));
    if (method === 'বাকি সমন্বয়') applyCustomerDueChange(sale.customerId, -amount, 0);
    APP_STATE.returns.push(returnDoc);

    toast(res.message, 's');
    renderRetForm(); renderTodayReturns();
  } catch (err) {
    showFatalError('রিটার্ন সংরক্ষণে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.textContent = 'রিটার্ন নিশ্চিত করুন';
  }
}

// ════════════════════════════════════════════════════════════
// SUPPLIER RETURN / EXPIRY WRITE-OFF FORM
// ✅ ফিক্স: ফেরতযোগ্য সীমা এখন দুটোর মধ্যে ছোটটা —
//   (ক) এই Purchase-এ মূল ক্রয় থেকে যা বাকি আছে, এবং
//   (খ) বর্তমান প্রকৃত Inventory স্টক (অন্য উৎস থেকে স্টক বদলে থাকতে পারে)
// ════════════════════════════════════════════════════════════
function onRetPurchaseSelect(purId) {
  const box = document.getElementById('ret-sup-items');
  if (!purId) { box.innerHTML = ''; return; }
  const pur = APP_STATE.purchases.find(p => p.purchaseId === purId);
  const rows = pur.items.map((item, i) => {
    const alreadyOnThisPurchase = returnedQty(purId, item.medId, 'supplier');
    const purchaseCap = item.qty - alreadyOnThisPurchase;
    const currentStock = APP_STATE.inventory.find(m => m.medId === item.medId)?.totalStock || 0;
    const maxQty = Math.max(0, Math.min(purchaseCap, currentStock));
    const stockNote = currentStock < purchaseCap
      ? `<span class="text-amber-600">বর্তমান স্টক ৎ${currentStock}টা (কম) দিয়ে সীমাবদ্ধ</span>`
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
    <button id="ret-s-submit-btn" onclick="submitSupplierReturn('${purId}')" class="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg">রিটার্ন/রাইট-অফ নিশ্চিত করুন</button>`;
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
    const currentStock = APP_STATE.inventory.find(m => m.medId === item.medId)?.totalStock || 0;
    const allowedMax = Math.max(0, Math.min(purchaseCap, currentStock));
    if (qty > allowedMax) {
      if (currentStock < purchaseCap) {
        return showRetError(`"${item.brand}" — বর্তমান স্টক মাত্র ${currentStock}টা, এত ফেরত দেওয়া সম্ভব না।`);
      }
      return showRetError(`"${item.brand}" ফেরতযোগ্য সীমা অতিক্রম করেছে।`);
    }
    amount += qty * item.purchasePrice;
    items.push({ medId: item.medId, name: item.brand, qty, purchasePrice: item.purchasePrice });
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

  try {
    const supPayableReduction = (reason === 'ফেরত' && method === 'পাওনা সমন্বয়') ? amount : 0;
    const res = await apiSubmitSupplierReturn(returnDoc, pur.supplierId, supPayableReduction);
    if (!res.success) {
      showRetError(res.message);
      btn.disabled = false;
      btn.textContent = 'রিটার্ন/রাইট-অফ নিশ্চিত করুন';
      return;
    }

    items.forEach(item => destockItem(item.medId, item.qty));
    if (supPayableReduction > 0) applySupplierPayableChange(pur.supplierId, -amount, 0);
    APP_STATE.returns.push(returnDoc);

    toast(res.message, 's');
    renderRetForm(); renderTodayReturns();
  } catch (err) {
    showFatalError('রিটার্ন সংরক্ষণে সমস্যা:\n' + err.message);
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
      ret.items.forEach(item => restockItem(item.medId, item.qty, item.purchasePrice));
      if (ret.reason === 'ফেরত' && ret.refundMethod === 'পাওনা সমন্বয়') applySupplierPayableChange(ret.partyId, ret.amount, 0);
    }
    APP_STATE.returns = APP_STATE.returns.filter(r => r.returnId !== returnId);
    toast(res.message, 's');
    renderTodayReturns();
  } catch (err) { showFatalError('রিটার্ন মুছতে সমস্যা:\n' + err.message); }
}
