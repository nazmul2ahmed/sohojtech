'use strict';

// ════════════════════════════════════════════════════════════
// OPENING BALANCE MODULE
// ব্যবসা শুরুর আগের স্টক/নগদ/বাকি এন্ট্রি — প্রতিটির সাইড-ইফেক্ট আছে
// এবং Delete করলে তা সঠিকভাবে reverse হয়।
// ════════════════════════════════════════════════════════════

const OB_CATEGORIES = ['স্টক', 'নগদ', 'গ্রাহক বাকি', 'সরবরাহকারী বাকি', 'অন্যান্য সম্পদ', 'দায়'];

function renderOpeningModule() {
  const c = document.getElementById('opening-content');
  if (!c) return;

  c.innerHTML = `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><i class="fa-solid fa-plus-circle text-brand"></i> নতুন Opening এন্ট্রি</h5>
        <div id="ob-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>

        <div class="mb-3">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ক্যাটাগরি <span class="text-red-500">*</span></label>
          <select id="ob-cat" onchange="onObCatChange()" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            ${OB_CATEGORIES.map(cat => `<option value="${cat}">${cat === 'স্টক' ? 'স্টক (ওষুধ)' : cat === 'নগদ' ? 'নগদ / ব্যাংক' : cat === 'দায়' ? 'দায় / লোন' : cat}</option>`).join('')}
          </select>
        </div>

        <div id="ob-stock-fields" class="mb-3"></div>
        <div id="ob-client-fields" class="hidden mb-3">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">গ্রাহক নির্বাচন <span class="text-red-500">*</span></label>
          <div id="sd-ob-client"></div>
        </div>
        <div id="ob-sup-fields" class="hidden mb-3">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">সরবরাহকারী নির্বাচন <span class="text-red-500">*</span></label>
          <div id="sd-ob-sup"></div>
        </div>

        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">পরিমাণ (৳) <span class="text-red-500">*</span></label>
            <input type="number" id="ob-amount" min="0" step="0.01" placeholder="০.০০" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">তারিখ</label>
            <input type="date" id="ob-date" value="${todayStr()}" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          </div>
        </div>
        <div class="mb-4">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">বিবরণ</label>
          <input type="text" id="ob-desc" placeholder="বিবরণ লিখুন" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <button onclick="submitOpeningEntry()" class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm"><i class="fa-solid fa-floppy-disk mr-1"></i> Opening এন্ট্রি সংরক্ষণ</button>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden h-fit">
        <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-list-ul text-brand mr-1"></i> Opening Balance তালিকা</h5>
          <span id="ob-count" class="text-xs bg-brand/10 text-brand px-2 py-0.5 rounded-full font-semibold"></span>
        </div>
        <div id="ob-summary" class="p-4"></div>
        <div id="ob-table-body" class="max-h-96 overflow-y-auto"></div>
      </div>
    </div>
  `;

  initObDropdowns();
  onObCatChange();
  renderObTable();
}

function initObDropdowns() {
  const custOpts = APP_STATE.customers.map(c => ({ value: c.id, label: c.name, sub: c.phone || '' }));
  const supOpts = APP_STATE.suppliers.map(s => ({ value: s.id, label: s.name, sub: s.phone || '' }));
  createSD('sd-ob-client', custOpts, () => {}, '— গ্রাহক খুঁজুন —');
  createSD('sd-ob-sup', supOpts, () => {}, '— সরবরাহকারী খুঁজুন —');
}

function onObCatChange() {
  const cat = document.getElementById('ob-cat').value;
  document.getElementById('ob-client-fields').classList.toggle('hidden', cat !== 'গ্রাহক বাকি');
  document.getElementById('ob-sup-fields').classList.toggle('hidden', cat !== 'সরবরাহকারী বাকি');
  const stockBox = document.getElementById('ob-stock-fields');

  if (cat === 'স্টক') {
    stockBox.innerHTML = `
      <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ওষুধ নির্বাচন <span class="text-red-500">*</span></label>
      <div id="sd-ob-med" class="mb-1"></div>
      <button type="button" onclick="goTab('medicine')" class="text-xs text-brand hover:underline mb-3 block">
        <i class="fa-solid fa-plus mr-1"></i>তালিকায় নেই? "ওষুধ মাস্টার" ট্যাবে নতুন ওষুধ যোগ করুন
      </button>
      <div class="grid grid-cols-2 gap-3 mb-1">
        <div><label class="block text-[11px] text-slate-400 mb-1">পরিমাণ (Qty)</label><input type="number" id="ob-qty" min="1" placeholder="০" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div><label class="block text-[11px] text-slate-400 mb-1">ক্রয় মূল্য</label><input type="number" id="ob-cost" min="0" step="0.01" placeholder="০.০০" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div><label class="block text-[11px] text-slate-400 mb-1">MRP</label><input type="number" id="ob-mrp" min="0" step="0.01" placeholder="০.০০" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div><label class="block text-[11px] text-slate-400 mb-1">বিক্রয় মূল্য</label><input type="number" id="ob-sell" min="0" step="0.01" placeholder="০.০০" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div class="col-span-2"><label class="block text-[11px] text-slate-400 mb-1">মেয়াদ (MM/YYYY)</label><input type="text" id="ob-expiry" placeholder="১২/২০২৬" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
      </div>
      <p class="text-[11px] text-slate-400 mb-2"><i class="fa-solid fa-circle-info mr-1"></i>নিচের "পরিমাণ (৳)" ফিল্ডে মোট স্টক মূল্য (Qty × ক্রয় মূল্য) দিন — এটাই সম্পদের হিসাবে যোগ হবে।</p>`;
    const medOpts = APP_STATE.medicines.map(m => ({ value: m.id, label: m.brand, sub: `${m.doseForm || ''} ${m.strength || ''}` }));
    createSD('sd-ob-med', medOpts, onObMedSelect, '— ওষুধ খুঁজুন —');
  } else {
    stockBox.innerHTML = '';
  }
}

function onObMedSelect(medId) {
  // ভবিষ্যতে চাইলে এখানে ডিফল্ট cost/mrp/sell অটো-ফিল করা যাবে (এখনো medicine-এ price ফিল্ড নেই)
}

async function submitOpeningEntry() {
  hideEl('ob-error');
  const cat = document.getElementById('ob-cat').value;
  const amount = round2(parseFloat(document.getElementById('ob-amount').value) || 0);
  const date = document.getElementById('ob-date').value || todayStr();
  const desc = document.getElementById('ob-desc').value.trim();
  if (amount <= 0) return showObError('পরিমাণ দিন।');

  const entry = { entryId: 'OB-' + Date.now(), date, category: cat, description: desc, amount };
  let med;

  // ক্যাটাগরি অনুযায়ী ডাটা এক্সট্রাকশন ও ভ্যালিডেশন
  if (cat === 'স্টক') {
    const medId = sdGetValue('sd-ob-med');
    if (!medId) return showObError('ওষুধ নির্বাচন করুন।');
    const qty = parseInt(document.getElementById('ob-qty').value) || 0;
    if (qty <= 0) return showObError('সঠিক পরিমাণ (Qty) দিন।');
    med = APP_STATE.medicines.find(m => m.id === medId);
    Object.assign(entry, {
      medicineId: medId, brand: med?.brand || '', qty,
      costPrice: parseFloat(document.getElementById('ob-cost').value) || 0,
      mrp: parseFloat(document.getElementById('ob-mrp').value) || 0,
      sellPrice: parseFloat(document.getElementById('ob-sell').value) || 0,
      expiryDate: document.getElementById('ob-expiry').value.trim(),
      batchId: 'BAT-OB-' + Date.now(),
    });

  } else if (cat === 'গ্রাহক বাকি') {
    const clientId = sdGetValue('sd-ob-client');
    if (!clientId) return showObError('গ্রাহক নির্বাচন করুন।');
    entry.clientId = clientId;

  } else if (cat === 'সরবরাহকারী বাকি') {
    const supplierId = sdGetValue('sd-ob-sup');
    if (!supplierId) return showObError('সরবরাহকারী নির্বাচন করুন।');
    entry.supplierId = supplierId;
  }

  try {
    // ১. এপিআই কল
    const res = await apiSubmitOpeningEntry(entry);
    if (!res.success) return showObError(res.message);

    // ২. লোকাল স্টেট এবং UI আপডেট (কোনো ডাবল ক্যালকুলেশন ছাড়াই)
    if (cat === 'স্টক') {
      let inv = APP_STATE.inventory.find(m => m.medId === entry.medicineId);
      if (!inv) { 
        inv = { 
          medId: entry.medicineId, 
          brand: med?.brand || '', 
          doseForm: med?.doseForm || '', 
          strength: med?.strength || '', 
          totalStock: 0, 
          costValue: 0, 
          mrpValue: 0, 
          sellPrice: entry.sellPrice, 
          nearestExpiry: '', 
          status: 'ok', 
          batches: [] 
        }; 
        APP_STATE.inventory.push(inv); 
      }
      inv.batches.push({ 
        batchId: entry.batchId, 
        expiry: entry.expiryDate, 
        stock: entry.qty, 
        cost: entry.costPrice, 
        mrp: entry.mrp, 
        sell: entry.sellPrice 
      });
      if (entry.sellPrice > 0) inv.sellPrice = entry.sellPrice;
      recalcInventoryRow(inv);

    } else if (cat === 'গ্রাহক বাকি') {
      // ডাবল জমা এড়াতে শুধুমাত্র ১টি নিয়ম ব্যবহার করব। 
      // যদি 'applyCustomerDueChange' সিস্টেমে থাকে, তবে এটিই একা সব আপডেট করবে।
      if (typeof applyCustomerDueChange === 'function') {
        applyCustomerDueChange(entry.clientId, amount, 0); 
      } else {
        // যদি ওই ফাংশনটি না থাকে, তবেই কেবল ম্যানুয়ালি আপডেট হবে
        const customer = APP_STATE.customers.find(c => c.id === entry.clientId);
        if (customer) customer.due = round2((customer.due || 0) + amount);
      }

    } else if (cat === 'সরবরাহকারী বাকি') {
      if (typeof applySupplierPayableChange === 'function') {
        applySupplierPayableChange(entry.supplierId, amount, 0);
      } else {
        const supplier = APP_STATE.suppliers.find(s => s.id === entry.supplierId);
        if (supplier) supplier.totalPayable = round2((supplier.totalPayable || 0) + amount);
      }
    }

    // ৩. ওপেং এন্ট্রি লিস্ট আপডেট ও ফর্ম ক্লিয়ার
    APP_STATE.openingEntries.push(entry);
    toast('Opening এন্ট্রি সংরক্ষিত হয়েছে!', 's');
    clearObForm();
    renderObTable();

  } catch (err) { 
    showFatalError('Opening এন্ট্রি সংরক্ষণে সমস্যা:\n' + err.message); 
  }
}

function clearObForm() {
  document.getElementById('ob-amount').value = '';
  document.getElementById('ob-desc').value = '';
  onObCatChange();
  sdClear('sd-ob-client');
  sdClear('sd-ob-sup');
}

function showObError(msg) {
  const el = document.getElementById('ob-error');
  el.textContent = msg; el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function renderObTable() {
  const entries = APP_STATE.openingEntries;
  setText('ob-count', entries.length + ' টি');

  const totals = {};
  entries.forEach(e => { totals[e.category] = round2((totals[e.category] || 0) + e.amount); });
  const sumBox = document.getElementById('ob-summary');
  sumBox.innerHTML = Object.keys(totals).length ? `
    <div class="grid grid-cols-2 gap-2">
      ${Object.entries(totals).map(([k, v]) => `
        <div class="bg-brand/5 rounded-lg px-3 py-2">
          <div class="text-[10px] text-slate-400">${esc(k)}</div>
          <div class="font-mono font-bold text-brand text-sm">৳${fmt(v)}</div>
        </div>`).join('')}
    </div>` : '';

  const body = document.getElementById('ob-table-body');
  if (!entries.length) {
    body.innerHTML = `<div class="px-5 py-8 text-center text-slate-400 text-sm"><i class="fa-solid fa-clock-rotate-left text-2xl opacity-30 mb-2 block"></i>কোনো এন্ট্রি নেই</div>`;
    return;
  }
  body.innerHTML = entries.slice().reverse().map(e => `
    <div class="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center gap-2">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">${esc(e.category)}</span>
          <span class="text-xs text-slate-400">${esc(e.date)}</span>
        </div>
        <div class="text-xs text-slate-500 mt-1 truncate">${esc(e.description || '—')}</div>
      </div>
      <div class="text-right flex-shrink-0 flex items-center gap-2">
        <span class="font-mono font-bold text-sm text-slate-700 dark:text-slate-200">৳${fmt(e.amount)}</span>
        <button onclick="deleteOpeningEntry('${e.entryId}')" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>
      </div>
    </div>`).join('');
}

// ✅ Delete করলে সাইড-ইফেক্ট reverse হয়
async function deleteOpeningEntry(entryId) {
  if (!confirm('এন্ট্রি মুছবেন? সংশ্লিষ্ট স্টক/বাকি প্রভাব ফিরিয়ে নেওয়া হবে।')) return;
  const entry = APP_STATE.openingEntries.find(e => e.entryId === entryId);
  if (!entry) return;

  try {
    // ১. ডাটাবেজ থেকে ডিলিট
    const res = await apiDeleteOpeningEntry(entry);
    if (!res.success) return toast(res.message, 'w');

    // ২. লোকাল রিভার্সাল (সঠিক আইডি ধরে)
    if (entry.category === 'স্টক' && entry.batchId) {
      const inv = APP_STATE.inventory.find(m => m.medId === entry.medicineId);
      if (inv) { 
        inv.batches = inv.batches.filter(b => b.batchId !== entry.batchId); 
        recalcInventoryRow(inv); 
      }

    } else if (entry.category === 'গ্রাহক বাকি' && entry.clientId) {
      // ডাবল রিভার্স বা ভুল অ্যাকাউন্টে ডিলিট হওয়া আটকাতে:
      if (typeof applyCustomerDueChange === 'function') {
        // নতুন মান ০ এবং পুরাতন মান entry.amount দিলে ফাংশনটি স্বয়ংক্রিয়ভাবে মাইনাস করে নেবে
        applyCustomerDueChange(entry.clientId, 0, entry.amount); 
      } else {
        const customer = APP_STATE.customers.find(c => c.id === entry.clientId);
        if (customer) customer.due = round2((customer.due || 0) - entry.amount);
      }

    } else if (entry.category === 'সরবরাহকারী বাকি' && entry.supplierId) {
      if (typeof applySupplierPayableChange === 'function') {
        applySupplierPayableChange(entry.supplierId, 0, entry.amount);
      } else {
        const supplier = APP_STATE.suppliers.find(s => s.id === entry.supplierId);
        if (supplier) supplier.totalPayable = round2((supplier.totalPayable || 0) - entry.amount);
      }
    }

    // ৩. স্টেট থেকে বাদ দেওয়া ও টেবিল রেন্ডার
    APP_STATE.openingEntries = APP_STATE.openingEntries.filter(e => e.entryId !== entryId);
    toast('এন্ট্রি মুছে ফেলা হয়েছে।', 's');
    renderObTable();

  } catch (err) { 
    showFatalError('এন্ট্রি মুছতে সমস্যা:\n' + err.message); 
  }
}
