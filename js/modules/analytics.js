'use strict';

// ✅ ধাপ ২৮: বাংলাদেশ NBR ফিসক্যাল ইয়ার — জুলাই ১ থেকে জুন ৩০
const FISCAL_MONTHS = [
  { value: 7, label: 'জুলাই' }, { value: 8, label: 'আগস্ট' }, { value: 9, label: 'সেপ্টেম্বর' },
  { value: 10, label: 'অক্টোবর' }, { value: 11, label: 'নভেম্বর' }, { value: 12, label: 'ডিসেম্বর' },
  { value: 1, label: 'জানুয়ারি' }, { value: 2, label: 'ফেব্রুয়ারি' }, { value: 3, label: 'মার্চ' },
  { value: 4, label: 'এপ্রিল' }, { value: 5, label: 'মে' }, { value: 6, label: 'জুন' },
];

// বর্তমান তারিখ থেকে শুরু করে গত ১০ বছরের ফিসক্যাল ইয়ার অপশন তৈরি করে
// value = FY-শুরুর ক্যালেন্ডার বছর (যেমন 2024 মানে "2024-25")
function getFiscalYearOptions(yearsBack = 10) {
  const now = new Date();
  const currentCalYear = now.getFullYear();
  const currentFYStartYear = now.getMonth() >= 6 ? currentCalYear : currentCalYear - 1; // মাস ৬=জুলাই (0-indexed)

  const options = [];
  for (let i = 0; i < yearsBack; i++) {
    const startYear = currentFYStartYear - i;
    options.push({ value: startYear, label: `${startYear}-${String(startYear + 1).slice(2)}` });
  }
  return options;
}

// FY-শুরুর বছর + ঐচ্ছিক ক্যালেন্ডার-মাস (১-১২) থেকে fromDate/toDate বের করে
function getFiscalPeriodRange(fyStartYear, month) {
  if (!month) {
    return { fromDate: `${fyStartYear}-07-01`, toDate: `${fyStartYear + 1}-06-30` };
  }
  // জুলাই(৭)-ডিসেম্বর(১২) → fyStartYear; জানুয়ারি(১)-জুন(৬) → fyStartYear+1
  const calYear = month >= 7 ? fyStartYear : fyStartYear + 1;
  const lastDay = new Date(calYear, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  return { fromDate: `${calYear}-${mm}-01`, toDate: `${calYear}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

function renderAnalyticsModule() {
  const c = document.getElementById('analytics-content');
  if (!c) return;
  const today = todayStr();
  APP_STATE.anaFrom = APP_STATE.anaFrom || addDaysStr(today, -29);
  APP_STATE.anaTo = APP_STATE.anaTo || today;

  const anyCapReached = APP_STATE.capReached && (APP_STATE.capReached.sales || APP_STATE.capReached.purchases || APP_STATE.capReached.returns);
  const fyOptions = getFiscalYearOptions();

  c.innerHTML = `
  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
    <div class="flex items-center gap-2"><label class="text-xs font-semibold text-slate-500">থেকে</label>
      <input type="date" id="ana-from" value="${APP_STATE.anaFrom}" onchange="onAnaDateChange()" class="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
    <div class="flex items-center gap-2"><label class="text-xs font-semibold text-slate-500">পর্যন্ত</label>
      <input type="date" id="ana-to" value="${APP_STATE.anaTo}" onchange="onAnaDateChange()" class="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/></div>
    <button onclick="setAnaRange(6)" class="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300">৭ দিন</button>
    <button onclick="setAnaRange(29)" class="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300">৩০ দিন</button>
    <button onclick="setAnaRange(89)" class="px-3 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300">৯০ দিন</button>
    <div class="ml-auto">
      ${APP_STATE.olderHistoryLoaded
        ? `<span class="text-xs text-emerald-600 font-semibold"><i class="fa-solid fa-circle-check mr-1"></i>সম্পূর্ণ হিস্টোরি লোড হয়েছে</span>`
        : `<button id="load-older-history-btn" onclick="loadOlderHistory()" class="px-3 py-1.5 text-xs border border-brand text-brand rounded-lg font-semibold">
             <i class="fa-solid fa-clock-rotate-left mr-1"></i> ১২ মাসের আগের হিস্টোরি লোড করুন
           </button>`}
    </div>
  </div>

  <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-4 flex flex-wrap items-center gap-3">
    <div class="flex items-center gap-2">
      <label class="text-xs font-semibold text-slate-500 whitespace-nowrap"><i class="fa-solid fa-calendar-days mr-1"></i>অর্থবছর</label>
      <select id="fy-select" class="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
        ${fyOptions.map(fy => `<option value="${fy.value}">${esc(fy.label)}</option>`).join('')}
      </select>
    </div>
    <div class="flex items-center gap-2">
      <label class="text-xs font-semibold text-slate-500 whitespace-nowrap">মাস (ঐচ্ছিক)</label>
      <select id="fy-month-select" class="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
        <option value="">— পুরো বছর —</option>
        ${FISCAL_MONTHS.map(m => `<option value="${m.value}">${esc(m.label)}</option>`).join('')}
      </select>
    </div>
    <button id="fy-load-btn" onclick="loadFiscalPeriodData()" class="px-3 py-1.5 text-xs bg-brand hover:bg-blue-700 text-white rounded-lg font-semibold">
      <i class="fa-solid fa-download mr-1"></i> এই মেয়াদের ডেটা লোড করুন
    </button>
    <span id="fy-load-status" class="text-xs text-slate-400"></span>
  </div>

  ${anyCapReached && !APP_STATE.olderHistoryLoaded ? `
  <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 mb-4">
    <i class="fa-solid fa-circle-info mr-1"></i> বুট-টাইমে সাম্প্রতিক ৮,০০০টা এন্ট্রি পর্যন্ত লোড হয়েছে (পারফরম্যান্সের জন্য) — এই মেয়াদের কিছু পুরনো তথ্য এখনো এই চার্টে/সারসংক্ষেপে অন্তর্ভুক্ত নাও থাকতে পারে। সম্পূর্ণ ছবি পেতে ওপরের "১২ মাসের আগের হিস্টোরি লোড করুন" বাটন চাপুন।
  </div>` : ''}
  <div id="ana-body"></div>
`;
  renderAnaBody();
}

function setAnaRange(daysBack) {
  APP_STATE.anaTo = todayStr();
  APP_STATE.anaFrom = addDaysStr(APP_STATE.anaTo, -daysBack);
  document.getElementById('ana-from').value = APP_STATE.anaFrom;
  document.getElementById('ana-to').value = APP_STATE.anaTo;
  renderAnaBody();
}
function onAnaDateChange() {
  APP_STATE.anaFrom = document.getElementById('ana-from').value;
  APP_STATE.anaTo = document.getElementById('ana-to').value;
  renderAnaBody();
}
function addDaysStr(dateStr, delta) {
  const d = new Date(dateStr); d.setDate(d.getDate() + delta);
  return d.toISOString().split('T')[0];
}

function renderAnaBody() {
  const body = document.getElementById('ana-body');
  const from = APP_STATE.anaFrom, to = APP_STATE.anaTo;
  const sales = APP_STATE.sales.filter(s => s.date >= from && s.date <= to);

  let revenue = 0, cogs = 0, discount = 0;
  const dayMap = {}, medMap = {}, custMap = {}, catMap = {};

  sales.forEach(s => {
    let saleRev = 0;
    (s.items || []).forEach(item => {
      const gross = item.qty * item.price;
      const disc = gross * (item.discountPct || 0) / 100;
      const net = gross - disc;
      revenue += net; discount += disc; cogs += item.qty * (item.costPrice || 0); saleRev += net;

      if (!medMap[item.medId]) medMap[item.medId] = { name: item.name, qty: 0, revenue: 0 };
      medMap[item.medId].qty += item.qty; medMap[item.medId].revenue += net;

      const med = APP_STATE.medicines.find(m => m.id === item.medId);
      const cat = med?.category || 'অজানা';
      catMap[cat] = round2((catMap[cat] || 0) + net);
    });
    dayMap[s.date] = round2((dayMap[s.date] || 0) + saleRev);
    if (s.customerId !== 'WALK_IN') {
      if (!custMap[s.customerId]) custMap[s.customerId] = { name: s.customerName, revenue: 0, count: 0 };
      custMap[s.customerId].revenue += saleRev; custMap[s.customerId].count += 1;
    }
  });

  const grossProfit = round2(revenue - cogs);
  const topMeds = Object.values(medMap).sort((a, b) => b.qty - a.qty).slice(0, 10);
  const topMedsByRevenue = Object.values(medMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const topCustomers = Object.values(custMap).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const catList = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  const maxCat = Math.max(...catList.map(c => c[1]), 1);

  // দৈনিক ট্রেন্ড — from-to রেঞ্জের প্রতিটা দিন (এমনকি বিক্রয় না থাকলেও ০)
  const days = [];
  let d = new Date(from);
  const toD = new Date(to);
  while (d <= toD) { days.push(d.toISOString().split('T')[0]); d.setDate(d.getDate() + 1); }
  const maxDay = Math.max(...days.map(dt => dayMap[dt] || 0), 1);

  document.getElementById('ana-body').innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      ${statCard('মোট বিক্রয়', '৳' + fmtK(revenue), 'fa-sack-dollar', 'blue')}
      ${statCard('COGS', '৳' + fmtK(cogs), 'fa-boxes-stacked', 'orange')}
      ${statCard('গ্রস প্রফিট', '৳' + fmtK(grossProfit), 'fa-chart-line', 'green')}
      ${statCard('ইনভয়েস সংখ্যা', sales.length + ' টি', 'fa-receipt', 'red')}
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4"><i class="fa-solid fa-chart-column text-brand mr-1"></i> দৈনিক বিক্রয় প্রবণতা</h5>
      <div class="flex items-end gap-1 overflow-x-auto pb-2" style="min-height:140px">
        ${days.map(dt => {
          const val = dayMap[dt] || 0;
          const h = Math.max(4, Math.round((val / maxDay) * 120));
          return `<div class="flex flex-col items-center flex-shrink-0" style="width:${days.length > 40 ? '8px' : '22px'}" title="${dt}: ৳${fmt(val)}">
            <div class="w-full bg-brand rounded-t" style="height:${h}px"></div>
          </div>`;
        }).join('')}
      </div>
      <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>${esc(from)}</span><span>${esc(to)}</span></div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700"><h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-trophy text-amber-500 mr-1"></i> টপ-সেলিং ওষুধ (Qty)</h5></div>
        <div class="max-h-72 overflow-y-auto">
          ${topMeds.length ? topMeds.map((m, i) => `
            <div class="px-5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-sm">
              <span class="text-slate-700 dark:text-slate-200"><span class="text-slate-400 mr-2">${i + 1}.</span>${esc(m.name)}</span>
              <span class="font-mono font-bold text-brand">${m.qty} ইউনিট</span>
            </div>`).join('') : emptyRow('কোনো বিক্রয় নেই')}
        </div>
      </div>
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700"><h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-money-bill-trend-up text-emerald-500 mr-1"></i> টপ রেভিনিউ (ওষুধ)</h5></div>
        <div class="max-h-72 overflow-y-auto">
          ${topMedsByRevenue.length ? topMedsByRevenue.map((m, i) => `
            <div class="px-5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-sm">
              <span class="text-slate-700 dark:text-slate-200"><span class="text-slate-400 mr-2">${i + 1}.</span>${esc(m.name)}</span>
              <span class="font-mono font-bold text-emerald-600">৳${fmt(m.revenue)}</span>
            </div>`).join('') : emptyRow('কোনো বিক্রয় নেই')}
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3"><i class="fa-solid fa-tags text-brand mr-1"></i> ক্যাটাগরি-ভিত্তিক বিক্রয়</h5>
        ${catList.length ? catList.map(([cat, val]) => `
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs text-slate-500 w-24 truncate">${esc(cat)}</span>
            <div class="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden"><div class="h-full bg-brand" style="width:${(val / maxCat * 100).toFixed(0)}%"></div></div>
            <span class="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 w-20 text-right">৳${fmtK(val)}</span>
          </div>`).join('') : emptyRow('কোনো ডেটা নেই')}
      </div>
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700"><h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-users text-brand mr-1"></i> শীর্ষ গ্রাহক (রেভিনিউ)</h5></div>
        <div class="max-h-64 overflow-y-auto">
          ${topCustomers.length ? topCustomers.map((c, i) => `
            <div class="px-5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-sm">
              <span class="text-slate-700 dark:text-slate-200"><span class="text-slate-400 mr-2">${i + 1}.</span>${esc(c.name)} <span class="text-[11px] text-slate-400">(${c.count} বিল)</span></span>
              <span class="font-mono font-bold text-brand">৳${fmt(c.revenue)}</span>
            </div>`).join('') : emptyRow('কোনো গ্রাহক নেই')}
        </div>
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────
// LOAD OLDER HISTORY — cutoff-এর আগের ডেটা on-demand
// ────────────────────────────────────────────────────────────
async function loadOlderHistory() {
  const btn = document.getElementById('load-older-history-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> লোড হচ্ছে...'; }

  try {
    const res = await apiGetOlderHistory();
    if (!res.success) {
      toast('পুরনো হিস্টোরি লোড ব্যর্থ: ' + res.message, 'w');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left mr-1"></i> ১২ মাসের আগের হিস্টোরি লোড করুন'; }
      return;
    }
    mergeOlderHistoryIntoState(res);
    APP_STATE.olderHistoryLoaded = true;
    toast('পুরনো হিস্টোরি লোড হয়েছে।', 's');
    renderAnalyticsModule();
  } catch (err) {
    showFatalError('পুরনো হিস্টোরি লোডে সমস্যা:\n' + err.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left mr-1"></i> ১২ মাসের আগের হিস্টোরি লোড করুন'; }
  }
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ২৮: নির্বাচিত ফিসক্যাল ইয়ার/মাসের ডেটা টার্গেটেডভাবে লোড
// ────────────────────────────────────────────────────────────
async function loadFiscalPeriodData() {
  const fyStartYear = parseInt(document.getElementById('fy-select').value, 10);
  const monthVal = document.getElementById('fy-month-select').value;
  const month = monthVal ? parseInt(monthVal, 10) : null;
  const range = getFiscalPeriodRange(fyStartYear, month);

  const btn = document.getElementById('fy-load-btn');
  const statusEl = document.getElementById('fy-load-status');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> লোড হচ্ছে...';
  statusEl.textContent = '';

  try {
    const res = await apiGetHistoryByPeriod(range.fromDate, range.toDate);
    if (!res.success) {
      toast('মেয়াদের ডেটা লোড ব্যর্থ: ' + res.message, 'w');
      statusEl.textContent = 'লোড ব্যর্থ হয়েছে।';
      return;
    }
    // ✅ existing dedup-safe merge প্যাটার্ন পুনর্ব্যবহার — ডুপ্লিকেট হবে না
    mergeOlderHistoryIntoState(res);
    toast(`${range.fromDate} থেকে ${range.toDate} পর্যন্ত ডেটা লোড হয়েছে।`, 's');
    statusEl.textContent = `সর্বশেষ লোড: ${range.fromDate} — ${range.toDate}`;
    renderAnaBody();
  } catch (err) {
    showFatalError('মেয়াদের ডেটা লোডে সমস্যা:\n' + err.message);
    statusEl.textContent = 'লোড ব্যর্থ হয়েছে।';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-download mr-1"></i> এই মেয়াদের ডেটা লোড করুন';
  }
}

// ✅ Duplicate-safe merge — ID-ভিত্তিক Set ফিল্টারিং
function mergeOlderHistoryIntoState(data) {
  const mergeArr = (existing, incoming, idField) => {
    const existingIds = new Set(existing.map(x => x[idField]));
    const newItems = incoming.filter(x => !existingIds.has(x[idField]));
    return existing.concat(newItems);
  };
  APP_STATE.sales = mergeArr(APP_STATE.sales, data.sales, 'invoiceNo');
  APP_STATE.purchases = mergeArr(APP_STATE.purchases, data.purchases, 'purchaseId');
  APP_STATE.returns = mergeArr(APP_STATE.returns, data.returns, 'returnId');
  APP_STATE.expenses = mergeArr(APP_STATE.expenses, data.expenses, 'id');
  APP_STATE.payments = mergeArr(APP_STATE.payments, data.payments, 'paymentId');
  APP_STATE.supplierPayments = mergeArr(APP_STATE.supplierPayments, data.supplierPayments, 'paymentId');
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ২৯: নির্দিষ্ট date-range-এর ডেটা APP_STATE-এ সম্পূর্ণ আছে কিনা
// যাচাই করে — bootload cap (ধাপ ২৭) বা ১২-মাস cutoff-এর কারণে অসম্পূর্ণ
// হলে ব্যাকগ্রাউন্ডে apiGetHistoryByPeriod() কল করে auto-fetch করে।
// dashboard.js-এর "এই মাসের/এই বছরের রিপোর্ট" বাটন এটা কল করে।
// ────────────────────────────────────────────────────────────
async function ensurePeriodDataLoaded(fromDate, toDate) {
  if (APP_STATE.olderHistoryLoaded) return false; // ইতিমধ্যে সব ডেটা লোড হয়ে গেছে

  const outsideBootWindow = fromDate < (APP_STATE.historyCutoff || '');
  const capMayHideData = APP_STATE.capReached && (
    APP_STATE.capReached.sales || APP_STATE.capReached.purchases || APP_STATE.capReached.returns
  );

  if (!outsideBootWindow && !capMayHideData) return false; // নিশ্চিতভাবে সম্পূর্ণ ডেটা ইতিমধ্যে আছে

  try {
    const res = await apiGetHistoryByPeriod(fromDate, toDate);
    if (!res.success) {
      toast('এই মেয়াদের সম্পূর্ণ ডেটা ব্যাকগ্রাউন্ডে লোড করতে সমস্যা হয়েছে: ' + res.message, 'w');
      return false;
    }
    mergeOlderHistoryIntoState(res);
    toast('এই মেয়াদের সম্পূর্ণ ডেটা লোড হয়েছে।', 's');
    if (APP_STATE.currentTab === 'analytics') renderAnaBody();
    return true;
  } catch (err) {
    showFatalError('মেয়াদের ডেটা অটো-লোডে সমস্যা:\n' + err.message);
    return false;
  }
}
