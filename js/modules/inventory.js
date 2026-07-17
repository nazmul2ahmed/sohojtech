'use strict';

// ════════════════════════════════════════════════════════════
// INVENTORY MODULE — ব্যাচ-ভিত্তিক স্টক ভিউ (FEFO)
// ════════════════════════════════════════════════════════════

let invSearchDebounce = null;

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ৭: স্টক মিউটেশন হেল্পার — এখন এখানে কেন্দ্রীভূত (আগে returns.js-এ
// ছিল, কিন্তু আসলে এটাই এদের প্রকৃত জায়গা — inventory.js)।
// এই তিনটা ফাংশন pos.js, purchase.js, returns.js, opening.js, settings.js
// থেকে global scope-এ কল হয়।
// ════════════════════════════════════════════════════════════
function restockItem(medId, qty, cost) {
  const inv = APP_STATE.inventory.find(m => m.medId === medId);
  if (!inv) return;
  if (inv.batches.length) { inv.batches[0].stock += qty; }
  else { inv.batches.push({ batchId: 'BAT-RET-' + Date.now(), expiry: '', stock: qty, cost: cost || 0, mrp: 0, sell: inv.sellPrice }); }
  recalcInventoryRow(inv);
}
function destockItem(medId, qty) {
  const inv = APP_STATE.inventory.find(m => m.medId === medId);
  if (!inv) return;
  let remaining = qty;
  inv.batches.sort((a, b) => (b.expiry || '0000') > (a.expiry || '0000') ? 1 : -1);
  for (const b of inv.batches) { if (remaining <= 0) break; const take = Math.min(b.stock, remaining); b.stock -= take; remaining -= take; }
  inv.batches = inv.batches.filter(b => b.stock > 0);
  recalcInventoryRow(inv);
}
function recalcInventoryRow(inv) {
  inv.totalStock = inv.batches.reduce((a, b) => a + b.stock, 0);
  inv.costValue = round2(inv.batches.reduce((a, b) => a + b.cost * b.stock, 0));
  inv.mrpValue = round2(inv.batches.reduce((a, b) => a + b.mrp * b.stock, 0));
  inv.batches.sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1);
  inv.nearestExpiry = inv.batches[0]?.expiry || '';
  const med = APP_STATE.medicines.find(m => m.id === inv.medId);
  const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
  inv.status = inv.totalStock === 0 ? 'out' : inv.totalStock <= reorderLevel ? 'low' : 'ok';
}

function renderInventoryModule() {
  const c = document.getElementById('inventory-content');
  if (!c) return;
  APP_STATE.invSearch = APP_STATE.invSearch || '';
  APP_STATE.invExpanded = APP_STATE.invExpanded || null;

  const inv = APP_STATE.inventory;
  const totalCost = inv.reduce((a, b) => a + (b.costValue || 0), 0);
  const totalMrp = inv.reduce((a, b) => a + (b.mrpValue || 0), 0);
  const lowCount = inv.filter(m => m.status === 'low').length;
  const outCount = inv.filter(m => m.status === 'out').length;

  c.innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard('মোট ওষুধ', inv.length + ' টি', 'fa-pills', 'blue')}
      ${statCard('স্বল্প স্টক', lowCount + ' টি', 'fa-box-open', 'orange')}
      ${statCard('স্টকশূন্য', outCount + ' টি', 'fa-ban', 'red')}
      ${statCard('মোট MRP মূল্য', '৳' + fmtK(totalMrp), 'fa-money-bill-trend-up', 'green')}
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-table-list text-brand mr-1"></i> স্টক সারসংক্ষেপ</h5>
        <input type="text" id="inv-search" placeholder="ওষুধ খুঁজুন..." value="${esc(APP_STATE.invSearch)}"
          oninput="onInvSearch(this.value)"
          class="w-40 sm:w-56 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
      </div>
      <div id="inv-table-body"></div>
    </div>
  `;
  renderInvTable();
}

function onInvSearch(val) {
  APP_STATE.invSearch = val;
  clearTimeout(invSearchDebounce);
  invSearchDebounce = setTimeout(renderInvTable, 150);
}

function toggleInvBatches(medId) {
  APP_STATE.invExpanded = APP_STATE.invExpanded === medId ? null : medId;
  renderInvTable();
}

function renderInvTable() {
  const body = document.getElementById('inv-table-body');
  if (!body) return;
  const q = (APP_STATE.invSearch || '').toLowerCase();
  const list = APP_STATE.inventory.filter(m =>
    !q || (m.brand + ' ' + (m.doseForm || '') + ' ' + (m.strength || '')).toLowerCase().includes(q)
  );

  if (!list.length) {
    body.innerHTML = `<div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-boxes-stacked text-2xl opacity-30 mb-2 block"></i>কোনো স্টক পাওয়া যায়নি</div>`;
    return;
  }

  body.innerHTML = `
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase text-slate-500 dark:text-slate-400">
        <tr>
          <th class="px-4 py-2.5 text-left">ব্র্যান্ড</th>
          <th class="px-4 py-2.5 text-left hidden sm:table-cell">ফর্ম/শক্তি</th>
          <th class="px-4 py-2.5 text-right">মোট স্টক</th>
          <th class="px-4 py-2.5 text-left hidden md:table-cell">নিকটতম মেয়াদ</th>
          <th class="px-4 py-2.5 text-right hidden md:table-cell">Cost মূল্য</th>
          <th class="px-4 py-2.5 text-right hidden lg:table-cell">MRP মূল্য</th>
          <th class="px-4 py-2.5 text-center">অবস্থা</th>
          <th class="px-4 py-2.5 text-center">ব্যাচ</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(m => renderInvRow(m)).join('')}
      </tbody>
    </table>
    </div>`;
}

function renderInvRow(m) {
  const badge = m.status === 'out' ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">শূন্য</span>`
    : m.status === 'low' ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">স্বল্প</span>`
    : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">স্বাভাবিক</span>`;

  const isExpanded = APP_STATE.invExpanded === m.medId;
  const batchRows = (m.batches || []).map(b => {
    const daysLeft = b.expiry ? Math.ceil((parseExpiryDate(b.expiry) - new Date()) / 86400000) : null;
    const expColor = daysLeft !== null && daysLeft <= 30 ? 'text-red-600' : daysLeft !== null && daysLeft <= 90 ? 'text-amber-600' : 'text-slate-500';
    return `<tr class="text-xs border-t border-slate-100 dark:border-slate-700/50">
      <td class="px-4 py-2 pl-8 font-mono text-slate-400">${esc(b.batchId)}</td>
      <td class="px-4 py-2 ${expColor} font-semibold">${esc(b.expiry || '—')}</td>
      <td class="px-4 py-2 text-right font-mono">${b.stock}</td>
      <td class="px-4 py-2 text-right font-mono text-slate-500">৳${fmt(b.cost)}</td>
      <td class="px-4 py-2 text-right font-mono text-slate-500">৳${fmt(b.mrp)}</td>
      <td class="px-4 py-2 text-right font-mono text-brand">৳${fmt(b.sell)}</td>
      <td class="px-4 py-2 text-right">
        <button onclick="openBatchEdit('${m.medId}','${b.batchId}')" class="text-brand hover:underline text-[11px]"><i class="fa-solid fa-pen mr-1"></i>এডিট</button>
      </td>
    </tr>`;
  }).join('');

  return `
    <tr class="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
      <td class="px-4 py-3 font-semibold text-slate-800 dark:text-white">${esc(m.brand)}</td>
      <td class="px-4 py-3 hidden sm:table-cell text-slate-500 text-xs">${esc(m.doseForm || '—')} ${esc(m.strength || '')}</td>
      <td class="px-4 py-3 text-right font-mono font-bold ${m.status === 'out' ? 'text-red-600' : m.status === 'low' ? 'text-amber-600' : 'text-slate-700 dark:text-slate-200'}">${m.totalStock}</td>
      <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-500">${esc(m.nearestExpiry || '—')}</td>
      <td class="px-4 py-3 hidden md:table-cell text-right font-mono text-xs text-slate-500">৳${fmt(m.costValue || 0)}</td>
      <td class="px-4 py-3 hidden lg:table-cell text-right font-mono text-xs text-slate-500">৳${fmt(m.mrpValue || 0)}</td>
      <td class="px-4 py-3 text-center">${badge}</td>
      <td class="px-4 py-3 text-center">
        <button onclick="toggleInvBatches('${m.medId}')" class="text-slate-400 hover:text-brand">
          <i class="fa-solid fa-chevron-${isExpanded ? 'up' : 'down'}"></i> <span class="text-[11px]">${(m.batches || []).length}</span>
        </button>
      </td>
    </tr>
    ${isExpanded ? `
    <tr class="bg-slate-50 dark:bg-slate-900/20">
      <td colspan="8" class="p-0">
        <table class="w-full">
          <thead><tr class="text-[10px] uppercase text-slate-400">
            <th class="px-4 pt-2 pb-1 text-left pl-8">Batch ID</th>
            <th class="px-4 pt-2 pb-1 text-left">মেয়াদ</th>
            <th class="px-4 pt-2 pb-1 text-right">স্টক</th>
            <th class="px-4 pt-2 pb-1 text-right">ক্রয়মূল্য</th>
            <th class="px-4 pt-2 pb-1 text-right">MRP</th>
            <th class="px-4 pt-2 pb-1 text-right">বিক্রয়মূল্য</th>
            <th class="px-4 pt-2 pb-1 text-right"></th>
          </tr></thead>
          <tbody>${batchRows || `<tr><td colspan="7" class="px-4 py-3 text-center text-xs text-slate-400">কোনো ব্যাচ নেই</td></tr>`}</tbody>
        </table>
      </td>
    </tr>` : ''}
  `;
}

// ────────────────────────────────────────────────────────────
// BATCH EDIT MODAL (হালকা inline modal — sell price/stock সংশোধনের জন্য)
// ────────────────────────────────────────────────────────────
function openBatchEdit(medId, batchId) {
  const inv = APP_STATE.inventory.find(m => m.medId === medId);
  const batch = inv?.batches.find(b => b.batchId === batchId);
  if (!batch) return;

  const modal = document.createElement('div');
  modal.id = 'batch-edit-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
     <h4 class="font-bold text-slate-800 dark:text-white mb-1">ব্যাচ এডিট — ${esc(inv.brand)}</h4>
      <p class="text-xs text-slate-400 mb-4 font-mono">${esc(batchId)}</p>
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 mb-4">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> স্টক সংশোধন সাবধানে করুন — এটা সরাসরি ইনভেন্টরি পরিবর্তন করবে।
      </div>
      <div id="be-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-4"></div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">বর্তমান স্টক</label>
          <input type="number" id="be-stock" value="${batch.stock}" min="0" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">মেয়াদ</label>
          <input type="text" id="be-expiry" value="${esc(batch.expiry)}" placeholder="MM/YYYY" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ক্রয়মূল্য</label>
          <input type="number" id="be-cost" value="${batch.cost}" min="0" step="0.01" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">MRP</label>
          <input type="number" id="be-mrp" value="${batch.mrp}" min="0" step="0.01" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
        <div class="col-span-2"><label class="block text-xs font-semibold text-slate-500 uppercase mb-1">বিক্রয়মূল্য</label>
          <input type="number" id="be-sell" value="${batch.sell}" min="0" step="0.01" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
      </div>
      <div class="flex gap-2">
        <button id="be-save-btn" onclick="saveBatchEdit('${medId}','${batchId}')" class="flex-1 bg-brand hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm">সংরক্ষণ করুন</button>
        <button onclick="closeBatchEdit()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function closeBatchEdit() {
  document.getElementById('batch-edit-modal')?.remove();
}

async function saveBatchEdit(medId, batchId) {
  if (guardReadOnly()) return;
  const inv = APP_STATE.inventory.find(m => m.medId === medId);
  const batch = inv?.batches.find(b => b.batchId === batchId);
  if (!batch) return;

  const errEl = document.getElementById('be-error');
  errEl.classList.add('hidden');

  const fields = {
    stock: parseInt(document.getElementById('be-stock').value) || 0,
    expiry: document.getElementById('be-expiry').value || '',
    cost: parseFloat(document.getElementById('be-cost').value) || 0,
    mrp: parseFloat(document.getElementById('be-mrp').value) || 0,
    sell: parseFloat(document.getElementById('be-sell').value) || 0,
  };

  const btn = document.getElementById('be-save-btn');
  btn.disabled = true;
  btn.textContent = 'সংরক্ষণ হচ্ছে...';

  try {
    const res = await apiUpdateBatch(medId, batchId, fields);
    if (!res.success) {
      errEl.textContent = res.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'সংরক্ষণ করুন';
      return;
    }

    // ✅ Firestore write সফল হলেই local APP_STATE বদলানো হচ্ছে
    Object.assign(batch, fields);
    inv.batches = inv.batches.filter(b => b.stock > 0);
    recalcInventoryRow(inv);
    if (fields.sell > 0) inv.sellPrice = fields.sell;

    toast('ব্যাচ আপডেট হয়েছে।', 's');
    closeBatchEdit();
    renderInvTable();
  } catch (err) {
    showFatalError('ব্যাচ সংরক্ষণে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.textContent = 'সংরক্ষণ করুন';
  }
}

function statCard(label, val, icon, color) {
  const colors = {
    blue: 'text-brand bg-brand/10', green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20', orange: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  };
  return `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
    <div class="w-9 h-9 rounded-lg ${colors[color]} flex items-center justify-center mb-2"><i class="fa-solid ${icon} text-sm"></i></div>
    <div class="text-lg font-extrabold font-mono text-slate-800 dark:text-white">${esc(val)}</div>
    <div class="text-xs text-slate-500">${esc(label)}</div>
  </div>`;
}
