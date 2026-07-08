'use strict';

// ════════════════════════════════════════════════════════════
// ACCOUNTS / LEDGER MODULE
// এটা একটা সরল লেনদেন-লগ, rigorous P&L নয় (সেটা Dashboard-এ)।
// 'তথ্য' ব্যাজের এন্ট্রি (বাকি ক্রয়, পাওনা-সমন্বয় রিটার্ন) নন-ক্যাশ —
// টোটালে যোগ হয় না, শুধু দৃশ্যমানতার জন্য দেখানো হয়।
// ════════════════════════════════════════════════════════════

function renderAccountsModule() {
  const c = document.getElementById('accounts-content');
  if (!c) return;
  APP_STATE.ledgerDate = APP_STATE.ledgerDate || todayStr();
  APP_STATE.ledgerTab = APP_STATE.ledgerTab || 'all';
  APP_STATE.showExpenseForm = false;

  c.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4">
      <div class="flex flex-wrap items-center gap-3 justify-between">
        <div class="flex items-center gap-2">
          <label class="text-xs font-semibold text-slate-500 uppercase">তারিখ</label>
          <input type="date" id="ledger-date" value="${APP_STATE.ledgerDate}" onchange="onLedgerDateChange(this.value)"
            class="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div class="flex gap-2">
          <button onclick="setLedgerTab('all')" id="lt-all" class="px-4 py-1.5 rounded-lg text-xs font-semibold border"></button>
          <button onclick="setLedgerTab('income')" id="lt-income" class="px-4 py-1.5 rounded-lg text-xs font-semibold border"></button>
          <button onclick="setLedgerTab('expense')" id="lt-expense" class="px-4 py-1.5 rounded-lg text-xs font-semibold border"></button>
        </div>
        <button onclick="toggleExpenseForm()" class="px-4 py-1.5 bg-brand hover:bg-blue-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5">
          <i class="fa-solid fa-plus"></i> নতুন খরচ যোগ
        </button>
      </div>
      <div id="expense-form-box" class="hidden mt-4 pt-4 border-t border-slate-200 dark:border-slate-700"></div>
    </div>

    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 text-center">
        <div class="text-[11px] uppercase text-emerald-600 font-semibold mb-1">মোট আয়</div>
        <div id="ledger-total-income" class="text-lg font-extrabold font-mono text-emerald-600">৳০</div>
      </div>
      <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 text-center">
        <div class="text-[11px] uppercase text-red-600 font-semibold mb-1">মোট ব্যয়</div>
        <div id="ledger-total-expense" class="text-lg font-extrabold font-mono text-red-600">৳০</div>
      </div>
      <div class="bg-brand/10 border border-brand/30 rounded-xl p-4 text-center">
        <div class="text-[11px] uppercase text-brand font-semibold mb-1">নেট</div>
        <div id="ledger-total-net" class="text-lg font-extrabold font-mono text-brand">৳০</div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div id="ledger-table-body"></div>
    </div>
  `;
  updateLedgerTabsUI();
  renderLedgerTable();
}

function onLedgerDateChange(val) {
  APP_STATE.ledgerDate = val || todayStr();
  renderLedgerTable();
}

function setLedgerTab(tab) {
  APP_STATE.ledgerTab = tab;
  updateLedgerTabsUI();
  renderLedgerTable();
}

function updateLedgerTabsUI() {
  const map = { all: 'সব', income: 'আয়', expense: 'ব্যয়' };
  Object.keys(map).forEach(key => {
    const btn = document.getElementById('lt-' + key);
    if (!btn) return;
    btn.textContent = map[key];
    const active = APP_STATE.ledgerTab === key;
    btn.className = `px-4 py-1.5 rounded-lg text-xs font-semibold border transition ${active ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`;
  });
}

// ────────────────────────────────────────────────────────────
// LEDGER ENTRIES BUILDER — সব সোর্স একত্র করে
// ────────────────────────────────────────────────────────────
function buildLedgerEntries(dateStr) {
  const entries = [];

  APP_STATE.sales.filter(s => s.date === dateStr).forEach(s => {
    entries.push({ type: 'income', category: 'বিক্রয়', desc: s.invoiceNo + ' — ' + s.customerName, amount: s.totalBill, deletable: false });
  });

  (APP_STATE.payments || []).filter(p => p.date === dateStr).forEach(p => {
    entries.push({ type: 'income', category: 'বাকি আদায়', desc: p.customerName + (p.note ? ' — ' + p.note : ''), amount: p.amount, deletable: false });
  });

  APP_STATE.expenses.filter(e => e.date === dateStr).forEach(e => {
    entries.push({ type: 'expense', category: e.category, desc: e.description, amount: e.amount, deletable: true, refId: e.id });
  });

  APP_STATE.purchases.filter(p => p.date === dateStr).forEach(p => {
    if (p.paymentType === 'নগদ') {
      entries.push({ type: 'expense', category: 'ক্রয় (নগদ)', desc: p.supplierName + ' — ' + (p.medicineName || ''), amount: p.totalCost, deletable: false });
    } else {
      entries.push({ type: 'info', category: 'ক্রয় (বাকি)', desc: p.supplierName + ' — নগদ প্রভাব নেই', amount: p.totalCost, deletable: false });
    }
  });

  (APP_STATE.supplierPayments || []).filter(p => p.date === dateStr).forEach(p => {
    entries.push({ type: 'expense', category: 'সরবরাহকারী পরিশোধ', desc: p.supplierName + (p.note ? ' — ' + p.note : ''), amount: p.amount, deletable: false });
  });

  (APP_STATE.returns || []).filter(r => r.date === dateStr).forEach(r => {
    if (r.returnType === 'customer') {
      entries.push({ type: 'expense', category: 'রিটার্ন (কাস্টমার)', desc: r.refName + ' — ' + r.refId, amount: r.amount, deletable: false });
    } else if (r.reason === 'ধ্বংস') {
      entries.push({ type: 'expense', category: 'এক্সপায়ারি রাইট-অফ', desc: r.refName + ' — ' + r.refId, amount: r.amount, deletable: false });
    } else if (r.refundMethod === 'নগদ ফেরত') {
      entries.push({ type: 'income', category: 'সরবরাহকারী রিটার্ন (নগদ)', desc: r.refName + ' — ' + r.refId, amount: r.amount, deletable: false });
    } else {
      entries.push({ type: 'info', category: 'সরবরাহকারী রিটার্ন (পাওনা সমন্বয়)', desc: r.refName + ' — নগদ প্রভাব নেই', amount: r.amount, deletable: false });
    }
  });

  return entries;
}

function renderLedgerTable() {
  const box = document.getElementById('ledger-table-body');
  if (!box) return;
  const all = buildLedgerEntries(APP_STATE.ledgerDate);

  const totalIncome = round2(all.filter(e => e.type === 'income').reduce((a, b) => a + b.amount, 0));
  const totalExpense = round2(all.filter(e => e.type === 'expense').reduce((a, b) => a + b.amount, 0));
  const net = round2(totalIncome - totalExpense);
  setText('ledger-total-income', '৳' + fmt(totalIncome));
  setText('ledger-total-expense', '৳' + fmt(totalExpense));
  const netEl = document.getElementById('ledger-total-net');
  if (netEl) { netEl.textContent = (net < 0 ? '−' : '') + '৳' + fmt(Math.abs(net)); netEl.className = `text-lg font-extrabold font-mono ${net >= 0 ? 'text-emerald-600' : 'text-red-600'}`; }

  const filtered = APP_STATE.ledgerTab === 'all' ? all : all.filter(e => e.type === APP_STATE.ledgerTab || (APP_STATE.ledgerTab === 'all'));
  const list = APP_STATE.ledgerTab === 'all' ? all : all.filter(e => e.type === APP_STATE.ledgerTab);

  if (!list.length) {
    box.innerHTML = `<div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-book-open text-2xl opacity-30 mb-2 block"></i>এই তারিখে কোনো এন্ট্রি নেই</div>`;
    return;
  }

  box.innerHTML = `
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase text-slate-500 dark:text-slate-400">
        <tr><th class="px-4 py-2.5 text-left">ধরন</th><th class="px-4 py-2.5 text-left">ক্যাটাগরি</th><th class="px-4 py-2.5 text-left">বিবরণ</th><th class="px-4 py-2.5 text-right">পরিমাণ</th><th class="px-4 py-2.5 text-center">Action</th></tr>
      </thead>
      <tbody>
        ${list.map(e => `
          <tr class="border-t border-slate-100 dark:border-slate-700/50">
            <td class="px-4 py-2.5">${ledgerBadge(e.type)}</td>
            <td class="px-4 py-2.5 text-slate-600 dark:text-slate-300">${esc(e.category)}</td>
            <td class="px-4 py-2.5 text-slate-500 text-xs">${esc(e.desc)}</td>
            <td class="px-4 py-2.5 text-right font-mono font-bold ${e.type === 'income' ? 'text-emerald-600' : e.type === 'expense' ? 'text-red-600' : 'text-slate-400'}">৳${fmt(e.amount)}</td>
            <td class="px-4 py-2.5 text-center">${e.deletable ? `<button onclick="deleteExpenseEntry('${e.refId}')" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-trash text-xs"></i></button>` : '<span class="text-slate-300 text-xs">—</span>'}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

function ledgerBadge(type) {
  if (type === 'income') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">আয়</span>`;
  if (type === 'expense') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">ব্যয়</span>`;
  return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">তথ্য</span>`;
}

// ────────────────────────────────────────────────────────────
// ADD EXPENSE FORM
// ────────────────────────────────────────────────────────────
function toggleExpenseForm() {
  const box = document.getElementById('expense-form-box');
  const isOpen = !box.classList.contains('hidden');
  if (isOpen) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  box.classList.remove('hidden');
  box.innerHTML = `
    <div id="exp-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>
    <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div class="md:col-span-2">
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">বিবরণ</label>
        <input type="text" id="exp-desc" placeholder="যেমন: বিদ্যুৎ বিল" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ক্যাটাগরি</label>
        <select id="exp-cat" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
          <option>ইউটিলিটি</option><option>বেতন</option><option>ভাড়া</option><option>পরিবহন</option><option>রক্ষণাবেক্ষণ</option><option>অন্যান্য</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">পরিমাণ (৳)</label>
        <input type="number" id="exp-amt" min="0.01" step="0.01" placeholder="০.০০" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
      </div>
    </div>
    <button onclick="submitExpenseEntry()" class="mt-3 bg-brand hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm">খরচ যোগ করুন</button>`;
  document.getElementById('exp-desc').focus();
}

async function submitExpenseEntry() {
  const errEl = document.getElementById('exp-form-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');
  const desc = document.getElementById('exp-desc').value.trim();
  const cat = document.getElementById('exp-cat').value;
  const amount = round2(parseFloat(document.getElementById('exp-amt').value) || 0);
  if (!desc) return showErr('বিবরণ দিন।');
  if (amount <= 0) return showErr('সঠিক পরিমাণ দিন।');

  const exp = { id: 'EXP-' + Date.now(), date: APP_STATE.ledgerDate, description: desc, amount, category: cat };
  try {
    const res = await apiAddExpense(exp);
    if (!res.success) return showErr(res.message);
    APP_STATE.expenses.push(exp);
    toast('খরচ যোগ হয়েছে।', 's');
    toggleExpenseForm();
    renderLedgerTable();
  } catch (err) { showFatalError('খরচ সংরক্ষণে সমস্যা:\n' + err.message); }
}

async function deleteExpenseEntry(expId) {
  if (!confirm('এই খরচ এন্ট্রি মুছবেন?')) return;
  try {
    const res = await apiDeleteExpense(expId);
    if (!res.success) return toast(res.message, 'w');
    APP_STATE.expenses = APP_STATE.expenses.filter(e => e.id !== expId);
    toast('খরচ মুছে ফেলা হয়েছে।', 's');
    renderLedgerTable();
  } catch (err) { showFatalError('খরচ মুছতে সমস্যা:\n' + err.message); }
}