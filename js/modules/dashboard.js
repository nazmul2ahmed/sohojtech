'use strict';

// ════════════════════════════════════════════════════════════
// DASHBOARD MODULE — P&L (Accrual) + Cash Flow + Receivables + Returns Effect
// ✅ Step 10 আপডেট: supplierPayments এখন Cash Flow-এ যুক্ত (cash-out)
// ✅ Step 29 আপডেট: Dashboard → Analytics রিপোর্ট নেভিগেশন কার্ড যুক্ত
// ════════════════════════════════════════════════════════════

function computeDashboardMetrics(state) {
  const today = todayStr();
  const todaySales = state.sales.filter(s => s.date === today);
  const todayPayments = (state.payments || []).filter(p => p.date === today);
  const todaySupplierPayments = (state.supplierPayments || []).filter(p => p.date === today);
  const todayExpenses = state.expenses.filter(e => e.date === today);
  const todayPurchases = state.purchases.filter(p => p.date === today);
  const todayReturns = (state.returns || []).filter(r => r.date === today);

  // ── P&L (Accrual — বাকি আদায় এখানে নেই) ──
  let revenue = 0, cogs = 0, discountTotal = 0, newDueToday = 0, cashFromSalesToday = 0;
  todaySales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const gross = item.qty * item.price;
      const disc = gross * (item.discountPct / 100);
      revenue += (gross - disc);
      discountTotal += disc;
      cogs += item.qty * (item.costPrice || 0);
    });
    newDueToday += (sale.due || 0);
    cashFromSalesToday += (sale.cashPaid || 0);
  });

  // ── Returns Effect ──
  const custReturns = todayReturns.filter(r => r.returnType === 'customer');
  const supReturns = todayReturns.filter(r => r.returnType === 'supplier');
  const revenueReturnToday = custReturns.reduce((a, b) => a + b.amount, 0);
  const cogsReturnToday = custReturns.reduce((a, b) => a + b.cost, 0);
  const cashRefundToday = custReturns.filter(r => r.refundMethod === 'নগদ ফেরত').reduce((a, b) => a + b.amount, 0);
  const dueAdjustToday = custReturns.filter(r => r.refundMethod === 'বাকি সমন্বয়').reduce((a, b) => a + b.amount, 0);
  const writeOffLossToday = supReturns.filter(r => r.reason === 'ধ্বংস').reduce((a, b) => a + b.amount, 0);
  const supReturnCashInToday = supReturns.filter(r => r.reason === 'ফেরত' && r.refundMethod === 'নগদ ফেরত').reduce((a, b) => a + b.amount, 0);

  const netRevenue = round2(revenue - revenueReturnToday);
  const netCogs = round2(cogs - cogsReturnToday);
  const grossProfit = round2(netRevenue - netCogs);
  const todayExpenseTotal = todayExpenses.reduce((a, b) => a + b.amount, 0);
  const netProfit = round2(grossProfit - todayExpenseTotal - writeOffLossToday);

  // ── Cash Flow (✅ supplierPaymentTotal এখন cashOut-এ যুক্ত) ──
  const dueCollectedToday = todayPayments.reduce((a, b) => a + b.amount, 0);
  const supplierPaymentTotal = todaySupplierPayments.reduce((a, b) => a + b.amount, 0);
  const cashPurchaseToday = todayPurchases.filter(p => p.paymentType === 'নগদ').reduce((a, b) => a + b.totalCost, 0);
  const cashIn = round2(cashFromSalesToday + dueCollectedToday + supReturnCashInToday);
  const cashOut = round2(todayExpenseTotal + cashPurchaseToday + cashRefundToday + supplierPaymentTotal);
  const netCashFlow = round2(cashIn - cashOut);

  // ── Receivables ──
  const totalCustDue = state.customers.reduce((a, b) => a + (b.due || 0), 0);
  const totalSupPayable = state.suppliers.reduce((a, b) => a + (b.totalPayable || 0), 0);
  const dueCustomers = state.customers.filter(c => c.due > 0).sort((a, b) => b.due - a.due);
  const netReceivableChange = round2(newDueToday - dueCollectedToday - dueAdjustToday);

  // ── স্টক ──
  const stockCostValue = state.inventory.reduce((a, b) => a + (b.costValue || 0), 0);
  const stockMrpValue = state.inventory.reduce((a, b) => a + (b.mrpValue || 0), 0);
  const lowStock = state.inventory.filter(m => m.status === 'low');
  const outStock = state.inventory.filter(m => m.status === 'out');

  // ✅ ধাপ ৩৫.১ — hardcoded ৯০ বাদ, এখন APP_STATE.expiryAlertDays (Settings-এ কনফিগারযোগ্য)
  const expiryAlertDays = state.expiryAlertDays || 90;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const expiryAlerts = state.inventory
    .filter(m => m.nearestExpiry)
    .map(m => {
      const ed = parseExpiryDate(m.nearestExpiry);
      return ed ? { ...m, daysLeft: Math.ceil((ed - now) / 86400000) } : null;
    })
    .filter(m => m && m.daysLeft <= expiryAlertDays)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  // ✅ নতুন — ইতিমধ্যে মেয়াদোত্তীর্ণ (patient-safety/compliance — সবচেয়ে জরুরি,
  // আগে suggestion-এর daysLeft>=0 ফিল্টারে বাদ পড়ে যেত)
  const expiredItems = expiryAlerts.filter(m => m.daysLeft < 0);

  return {
    netRevenue, netCogs, discountTotal, grossProfit, todayExpenseTotal, netProfit,
    newDueToday, cashFromSalesToday, dueCollectedToday, cashPurchaseToday, supplierPaymentTotal,
    cashIn, cashOut, netCashFlow,
    totalCustDue, totalSupPayable, dueCustomers, netReceivableChange,
    stockCostValue, stockMrpValue, lowStock, outStock, expiryAlerts, expiredItems,
    invoiceCount: todaySales.length, paymentCount: todayPayments.length,
    todayPayments, revenueReturnToday, writeOffLossToday, todayReturns,
  };
}

// ════════════════════════════════════════════════════════════
// ✅ আইটেম ১০: SMART SUGGESTION CARD — সম্পূর্ণ rule-based, কোনো AI/API
// লাগে না। computeDashboardMetrics()-এর existing ডেটা থেকেই actionable
// insight বের করে। ফ্রি-টিয়ারের সবার জন্য ডিফল্ট।
// ════════════════════════════════════════════════════════════

function getMonthRangeOffset(monthsOffset) {
  const today = new Date();
  const target = new Date(today.getFullYear(), today.getMonth() + monthsOffset, 1);
  const year = target.getFullYear();
  const month = target.getMonth();
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

function computeMonthlyGrossProfit(fromDate, toDate) {
  const sales = APP_STATE.sales.filter(s => s.date >= fromDate && s.date <= toDate);
  let revenue = 0, cogs = 0;
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      const gross = item.qty * item.price;
      const disc = gross * (item.discountPct || 0) / 100;
      revenue += (gross - disc);
      cogs += item.qty * (item.costPrice || 0);
    });
  });
  return round2(revenue - cogs);
}

function computeSmartSuggestions(state) {
  const suggestions = [];

  const outStock = state.inventory.filter(m => m.status === 'out');
  if (outStock.length > 0) {
    suggestions.push({ icon: 'fa-ban', color: 'red', text: `${outStock.length} টি ওষুধ স্টকশূন্য — দ্রুত ক্রয় এন্ট্রি করুন।` });
  }

  const lowStock = state.inventory.filter(m => m.status === 'low');
  if (lowStock.length > 0) {
    suggestions.push({ icon: 'fa-box-open', color: 'amber', text: `${lowStock.length} টি ওষুধের স্টক কমে যাচ্ছে — রি-অর্ডার করার কথা ভাবুন।` });
  }

  // ✅ ধাপ ৩৫.১ — তিন-স্তর: expired (<0, এখন আলাদা লাল ব্যানারে দেখানো হয়, এখানে
  // যোগ হয় না যাতে ডাবল-নোটিফাই না হয়), critical (0-30), medium (30-expiryAlertDays)
  const expiryAlertDays = state.expiryAlertDays || 90;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const expiryComputed = state.inventory
    .filter(m => m.nearestExpiry)
    .map(m => { const ed = parseExpiryDate(m.nearestExpiry); return ed ? { daysLeft: Math.ceil((ed - now) / 86400000) } : null; })
    .filter(Boolean);
  const criticalExpiry = expiryComputed.filter(m => m.daysLeft >= 0 && m.daysLeft <= 30);
  const mediumExpiry = expiryComputed.filter(m => m.daysLeft > 30 && m.daysLeft <= expiryAlertDays);
  if (criticalExpiry.length > 0) {
    suggestions.push({ icon: 'fa-triangle-exclamation', color: 'red', text: `${criticalExpiry.length} টি ওষুধের মেয়াদ ৩০ দিনের মধ্যে শেষ হচ্ছে — আগে বিক্রি/ফেরত দেওয়ার ব্যবস্থা করুন।` });
  }
  if (mediumExpiry.length > 0) {
    suggestions.push({ icon: 'fa-hourglass-half', color: 'amber', text: `${mediumExpiry.length} টি ওষুধের মেয়াদ আগামী ${expiryAlertDays} দিনের মধ্যে শেষ হবে — আগেভাগে পরিকল্পনা করে রাখুন।` });
  }

  const dueCustomers = state.customers.filter(c => c.due > 0).sort((a, b) => b.due - a.due);
  if (dueCustomers.length > 0) {
    const top = dueCustomers[0];
    suggestions.push({ icon: 'fa-hand-holding-dollar', color: 'amber', text: `${dueCustomers.length} জন গ্রাহকের বাকি আছে — সবচেয়ে বেশি ${esc(top.name)}-এর কাছে ৳${fmt(top.due)}।` });
  }

  const thisMonth = getMonthRangeOffset(0);
  const lastMonth = getMonthRangeOffset(-1);
  const thisMonthProfit = computeMonthlyGrossProfit(thisMonth.fromDate, thisMonth.toDate);
  const lastMonthProfit = computeMonthlyGrossProfit(lastMonth.fromDate, lastMonth.toDate);
  if (lastMonthProfit > 0) {
    const pctChange = Math.round(((thisMonthProfit - lastMonthProfit) / lastMonthProfit) * 100);
    if (Math.abs(pctChange) >= 5) {
      suggestions.push({
        icon: pctChange >= 0 ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down',
        color: pctChange >= 0 ? 'green' : 'red',
        text: pctChange >= 0
          ? `এই মাসে গত মাসের চেয়ে ${pctChange}% বেশি গ্রস প্রফিট — ভালো চলছে!`
          : `এই মাসে গত মাসের চেয়ে ${Math.abs(pctChange)}% কম গ্রস প্রফিট — কারণ যাচাই করুন।`,
      });
    }
  }

  return suggestions.slice(0, 4);
}

function renderSmartSuggestionsCard(suggestions) {
  if (!suggestions.length) return '';
  const colorMap = {
    red: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400',
  };
  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
        <i class="fa-solid fa-lightbulb text-brand"></i> আজকের পরামর্শ
      </h5>
      <div class="space-y-2">
        ${suggestions.map(s => `
          <div class="flex items-start gap-3 px-3 py-2.5 rounded-lg border ${colorMap[s.color]}">
            <i class="fa-solid ${s.icon} mt-0.5"></i>
            <span class="text-sm">${s.text}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ০.৩ — ডেটা ব্যাকআপ রিমাইন্ডার। Dashboard নিজেই owner-only
// (staff redirect হয়ে POS-এ চলে যায়), তাই এখানে আলাদা role-চেক লাগে না।
// বেসলাইন: APP_STATE.lastExportAt — কখনো এক্সপোর্ট না করা থাকলে
// অ্যাকাউন্ট তৈরির তারিখ (profile.createdAt) থেকে গণনা, যাতে নতুন
// ইউজার প্রথম দিনেই বিরক্তিকর রিমাইন্ডার না দেখে।
// ════════════════════════════════════════════════════════════
function daysSinceExcelExport() {
  const ts = APP_STATE.lastExportAt || APP_STATE.currentUser?.createdAt;
  if (!ts) return null;
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return null;
  // ✅ ফিক্স: serverTimestamp round-trip বা ঘড়ি-skew-এর কারণে সাময়িকভাবে
  // negative হয়ে যেতে পারে ("−১ দিন পার হয়ে গেছে" দেখানো এড়াতে) — 0-এ ক্ল্যাম্প
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function renderBackupReminderBanner() {
  const days = daysSinceExcelExport();
  if (days === null || days < 30) return '';
  const neverExported = !APP_STATE.lastExportAt;
  return `
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm rounded-xl px-4 py-3 mb-5 flex items-center justify-between gap-3 flex-wrap">
      <span><i class="fa-solid fa-cloud-arrow-down mr-1.5"></i> ${neverExported ? 'আপনি এখনো একবারও Excel ব্যাকআপ নেননি' : `শেষ Excel ব্যাকআপ নেওয়ার পর ${days} দিন পার হয়ে গেছে`} — ডেটা-হারানোর ঝুঁকি এড়াতে নিয়মিত ব্যাকআপ রাখুন।</span>
      <button onclick="goTab('settings')" class="text-xs font-semibold underline whitespace-nowrap flex-shrink-0">এখনই এক্সপোর্ট করুন</button>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ৩৫.১ — ইতিমধ্যে মেয়াদোত্তীর্ণ ওষুধের জন্য আলাদা, জোরালো ব্যানার
// (Smart Suggestion-এর সাধারণ "reorder করুন" টাইপ পরামর্শ থেকে গুণগতভাবে
// ভিন্ন — এটা patient-safety/compliance issue, কাউন্টার-স্টাফ যেন ভুলে
// বিক্রি না করে ফেলে)
// ════════════════════════════════════════════════════════════
function renderExpiredMedicineBanner(expiredItems) {
  if (!expiredItems.length) return '';
  return `
    <div class="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl px-4 py-3 mb-5">
      <div class="flex items-start gap-3">
        <i class="fa-solid fa-skull-crossbones text-lg mt-0.5"></i>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-sm mb-1">${expiredItems.length} টি ওষুধের মেয়াদ ইতিমধ্যে শেষ হয়ে গেছে</div>
          <p class="text-xs mb-3">এই ওষুধগুলো বিক্রি করা যাবে না — এখনই রিটার্ন বা রাইট-অফ (ধ্বংস) করুন। ভুলে বিক্রি হয়ে গেলে রোগীর ক্ষতি ও আইনি ঝুঁকি দুটোই আছে।</p>
          <div class="space-y-1.5">
            ${expiredItems.map(x => `
              <div class="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-2">
                <div class="min-w-0">
                  <span class="font-semibold text-slate-800 dark:text-white text-sm">${esc(x.brand)}</span>
                  <span class="text-[11px] text-red-500 ml-2">মেয়াদ শেষ হয়েছে ${Math.abs(x.daysLeft)} দিন আগে</span>
                </div>
                <button onclick="goToReturnForExpiredMedicine()" class="text-xs font-semibold text-brand hover:underline whitespace-nowrap flex-shrink-0">
                  <i class="fa-solid fa-rotate-left mr-1"></i>রিটার্ন/রাইট-অফ
                </button>
              </div>`).join('')}
          </div>
        </div>
      </div>
    </div>`;
}

// ⚠️ Phase ১ — শুধু Returns ট্যাবের সাপ্লায়ার-সাব-ট্যাবে নিয়ে যায়, নির্দিষ্ট
// purchase/batch প্রি-সিলেক্ট করে না। পরের ধাপে batchId→purchase reverse-lookup
// দিয়ে স্মার্ট prefill যোগ হবে।
function goToReturnForExpiredMedicine() {
  goTab('returns');
  setTimeout(() => { if (typeof setRetMode === 'function') setRetMode('supplier'); }, 100);
  toast('উপরে থেকে সংশ্লিষ্ট ক্রয় (Purchase) খুঁজে বের করে রিটার্ন/রাইট-অফ করুন — স্বয়ংক্রিয় প্রি-ফিল পরের ধাপে আসছে।', 'w');
}

function renderDashboardModule() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;
  const m = computeDashboardMetrics(APP_STATE);
  const netColor = m.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const cashColor = m.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const suggestions = computeSmartSuggestions(APP_STATE);

  container.innerHTML = `
  ${renderBackupReminderBanner()}
  ${renderExpiredMedicineBanner(m.expiredItems)}
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${kpiCard('আজকের বিক্রয় (নিট)', '৳' + fmtK(m.netRevenue), m.invoiceCount + ' টি ইনভয়েস', 'fa-sack-dollar', 'blue')}
      ${kpiCard('নিট মুনাফা (Net Profit)', (m.netProfit >= 0 ? '৳' : '−৳') + fmtK(Math.abs(m.netProfit)), 'Revenue − COGS − Expense − Write-off', 'fa-chart-line', m.netProfit >= 0 ? 'green' : 'red')}
      ${kpiCard('আজ নগদ আদায় (Cash In)', '৳' + fmtK(m.cashIn), 'বিক্রয় নগদ + বাকি আদায়', 'fa-hand-holding-dollar', 'green')}
      ${kpiCard('আজ বাকি আদায়', '৳' + fmtK(m.dueCollectedToday), m.paymentCount + ' টি পেমেন্ট', 'fa-money-bill-transfer', 'orange')}
    </div>

    ${renderSmartSuggestionsCard(suggestions)}
    ${renderAiInsightCardShell()}

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
        <i class="fa-solid fa-chart-pie text-brand"></i> রিপোর্ট
      </h5>
      <p class="text-[11px] text-slate-400 mb-3">নির্দিষ্ট মেয়াদের P&L সারসংক্ষেপ দেখতে Analytics-এ যান — cap-এর বাইরের পুরনো ডেটা থাকলে স্বয়ংক্রিয়ভাবে লোড হবে</p>
      <div class="flex flex-wrap gap-2">
        <button onclick="goToReportPeriod('month')" class="px-4 py-2 text-sm font-semibold bg-brand hover:bg-blue-700 text-white rounded-lg">
          <i class="fa-solid fa-calendar-day mr-1"></i> এই মাসের রিপোর্ট
        </button>
        <button onclick="goToReportPeriod('year')" class="px-4 py-2 text-sm font-semibold bg-brand hover:bg-blue-700 text-white rounded-lg">
          <i class="fa-solid fa-calendar-days mr-1"></i> এই বছরের রিপোর্ট
        </button>
        <button onclick="goToReportPeriod('custom')" class="px-4 py-2 text-sm font-semibold border border-brand text-brand rounded-lg">
          <i class="fa-solid fa-sliders mr-1"></i> কাস্টম মেয়াদ নির্বাচন
        </button>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
        <i class="fa-solid fa-scale-unbalanced text-brand"></i> ব্যালান্স শিট (স্ন্যাপশট)
      </h5>
      <p class="text-[11px] text-slate-400 mb-4">নগদ ব্যালান্স (ধাপ ৩২ থেকে প্রতিটা লেনদেনে ট্র্যাক করা) + স্টক/বাকি/পাওনার বর্তমান অবস্থা — সম্পূর্ণ ইতিহাস sum করা হয় না, তাই বড় অ্যাকাউন্টেও দ্রুত ও নির্ভুল থাকে</p>
      <div id="balance-sheet-body" class="grid grid-cols-2 lg:grid-cols-5 gap-3">
        ${Array(5).fill(0).map(() => `
          <div class="text-center p-2">
            <div class="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse mx-auto mb-1.5"></div>
            <div class="h-4 w-16 bg-slate-100 dark:bg-slate-700 animate-pulse rounded mx-auto mb-1"></div>
            <div class="h-3 w-14 bg-slate-100 dark:bg-slate-700 animate-pulse rounded mx-auto"></div>
          </div>`).join('')}
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><i class="fa-solid fa-scale-balanced text-brand"></i> মুনাফা-ক্ষতি (P&L)</h5>
        <p class="text-[11px] text-slate-400 mb-3">Accrual ভিত্তিক, রিটার্ন সমন্বিত</p>
        ${plRow('বিক্রয় (নিট)', m.netRevenue, 'text-emerald-600')}
        ${plRow('বিয়োগ: COGS', -m.netCogs, 'text-orange-600')}
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        ${plRow('গ্রস প্রফিট', m.grossProfit, 'text-blue-600', true)}
        ${plRow('বিয়োগ: পরিচালন খরচ', -m.todayExpenseTotal, 'text-orange-600')}
        ${m.writeOffLossToday > 0 ? plRow('বিয়োগ: এক্সপায়ারি রাইট-অফ ক্ষতি', -m.writeOffLossToday, 'text-red-600') : ''}
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        <div class="flex justify-between items-center pt-1">
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">নিট মুনাফা</span>
          <span class="font-mono font-extrabold text-lg ${netColor}">৳${fmt(Math.abs(m.netProfit))}</span>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><i class="fa-solid fa-money-bill-wave text-brand"></i> নগদ প্রবাহ (Cash Flow)</h5>
        <p class="text-[11px] text-slate-400 mb-3">আজ হাতে/ব্যাংকে আসলে যা এলো-গেল</p>
        ${plRow('বিক্রয় থেকে নগদ', m.cashFromSalesToday, 'text-emerald-600')}
        ${plRow('বাকি আদায় (পুরনো)', m.dueCollectedToday, 'text-emerald-600')}
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        ${plRow('মোট নগদ আয়', m.cashIn, 'text-blue-600', true)}
        ${plRow('বিয়োগ: খরচ', -m.todayExpenseTotal, 'text-orange-600')}
        ${plRow('বিয়োগ: নগদ ক্রয়', -m.cashPurchaseToday, 'text-orange-600')}
        ${m.supplierPaymentTotal > 0 ? plRow('বিয়োগ: সরবরাহকারী পরিশোধ', -m.supplierPaymentTotal, 'text-orange-600') : ''}
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        <div class="flex justify-between items-center pt-1">
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">নিট নগদ প্রবাহ</span>
          <span class="font-mono font-extrabold text-lg ${cashColor}">${m.netCashFlow < 0 ? '−' : ''}৳${fmt(Math.abs(m.netCashFlow))}</span>
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><i class="fa-solid fa-file-invoice-dollar text-brand"></i> বকেয়া ট্র্যাকিং</h5>
        <p class="text-[11px] text-slate-400 mb-3">গ্রাহক বাকির ব্যালেন্স পরিবর্তন</p>
        ${plRow('আজ নতুন বাকি তৈরি', m.newDueToday, 'text-red-600')}
        ${plRow('আজ বাকি আদায়', -m.dueCollectedToday, 'text-emerald-600')}
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        <div class="flex justify-between items-center pt-1 mb-3">
          <span class="text-sm font-bold text-slate-700 dark:text-slate-200">নেট বকেয়া পরিবর্তন</span>
          <span class="font-mono font-extrabold ${m.netReceivableChange > 0 ? 'text-red-600' : 'text-emerald-600'}">${m.netReceivableChange > 0 ? '+' : ''}৳${fmt(m.netReceivableChange)}</span>
        </div>
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        <div class="flex justify-between text-sm py-1"><span class="text-slate-500">মোট গ্রাহক বাকি</span><span class="font-mono font-bold text-red-600">৳${fmt(m.totalCustDue)}</span></div>
        <div class="flex justify-between text-sm py-1"><span class="text-slate-500">মোট সরবরাহকারী বাকি</span><span class="font-mono font-bold text-amber-600">৳${fmt(m.totalSupPayable)}</span></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2"><i class="fa-solid fa-boxes-stacked text-brand"></i> স্টক অবস্থা</h5>
        <div class="flex justify-between text-sm py-1.5"><span class="text-slate-500">মোট ওষুধ</span><span class="font-mono font-bold">${APP_STATE.inventory.length} টি</span></div>
        <div class="flex justify-between text-sm py-1.5"><span class="text-slate-500">স্বল্প স্টক</span><span class="font-mono font-bold text-amber-600">${m.lowStock.length} টি</span></div>
        <div class="flex justify-between text-sm py-1.5"><span class="text-slate-500">স্টকশূন্য</span><span class="font-mono font-bold text-red-600">${m.outStock.length} টি</span></div>
        <div class="border-t border-slate-200 dark:border-slate-700 my-2"></div>
        <div class="flex justify-between text-sm py-1.5"><span class="text-slate-500">Cost মূল্য</span><span class="font-mono font-bold text-brand">৳${fmt(m.stockCostValue)}</span></div>
        <div class="flex justify-between text-sm py-1.5"><span class="text-slate-500">MRP মূল্য</span><span class="font-mono font-bold text-emerald-600">৳${fmt(m.stockMrpValue)}</span></div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-triangle-exclamation text-amber-500 mr-1"></i> মেয়াদ সতর্কতা</h5>
          <span class="text-xs bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-semibold">${m.expiryAlerts.length} টি</span>
        </div>
        <div class="max-h-52 overflow-y-auto">
          ${m.expiryAlerts.length ? m.expiryAlerts.map(x => `
            <div class="px-5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-sm">
              <div><span class="font-semibold">${esc(x.brand)}</span></div>
              <span class="text-xs font-semibold ${x.daysLeft <= 30 ? 'text-red-600' : 'text-amber-600'}">${x.daysLeft < 0 ? 'মেয়াদ শেষ' : x.daysLeft + ' দিন বাকি'}</span>
            </div>`).join('') : emptyRow('কোনো সতর্কতা নেই')}
        </div>
      </div>

      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
        <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-rotate-left text-red-500 mr-1"></i> আজকের রিটার্ন</h5>
          <span class="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">${m.todayReturns.length} টি</span>
        </div>
        <div class="max-h-52 overflow-y-auto">
          ${m.todayReturns.length ? m.todayReturns.map(r => `
            <div class="px-5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-sm">
              <div><span class="font-semibold">${esc(r.refName)}</span></div>
              <span class="font-mono font-bold text-red-600">৳${fmt(r.amount)}</span>
            </div>`).join('') : emptyRow('আজ কোনো রিটার্ন নেই')}
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-users text-brand mr-1"></i> শীর্ষ বাকি গ্রাহক</h5>
        <span class="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-semibold">${m.dueCustomers.length} জন</span>
      </div>
      <div class="max-h-64 overflow-y-auto">
        ${m.dueCustomers.length ? m.dueCustomers.map(c => `
          <div class="px-5 py-2.5 border-b border-slate-100 dark:border-slate-700/50 flex justify-between items-center text-sm">
            <div><span class="font-semibold">${esc(c.name)}</span> <span class="text-slate-400 text-xs">${esc(c.phone || '')}</span></div>
            <span class="font-mono font-bold text-red-600">৳${fmt(c.due)}</span>
          </div>`).join('') : emptyRow('কোনো বকেয়া নেই')}
      </div>
    </div>
  `;

  refreshBalanceSheetCard(); // ✅ ধাপ ৩২.৫ — progressive load, DOM বসে যাওয়ার পর কল
  initAiInsightCard();
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ৩২.৫: BALANCE SHEET CARD — async progressive load
// ────────────────────────────────────────────────────────────
async function refreshBalanceSheetCard() {
  const box = document.getElementById('balance-sheet-body');
  if (!box) return;
  try {
    const res = await apiGetBalanceSheet();
    if (!document.getElementById('balance-sheet-body')) return; // ততক্ষণে ট্যাব বদলে গেলে safe no-op

    if (!res.success) {
      box.innerHTML = `<div class="col-span-2 lg:col-span-5 text-center text-xs text-slate-400 py-4">
        <i class="fa-solid fa-triangle-exclamation mr-1"></i> লোড করা যায়নি: ${esc(res.message || 'অজানা সমস্যা')}
      </div>`;
      return;
    }

    box.innerHTML = `
      ${balanceItem('নগদ ব্যালান্স', res.cashBalance, 'fa-sack-dollar', res.cashBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}
      ${balanceItem('স্টক মূল্য (Cost)', res.stockValue, 'fa-boxes-stacked', 'text-brand')}
      ${balanceItem('গ্রাহক বাকি (+)', res.customerDue, 'fa-hand-holding-dollar', 'text-amber-600')}
      ${balanceItem('সরবরাহকারী পাওনা (−)', res.supplierPayable, 'fa-truck-field', 'text-red-500')}
      ${balanceItem('নিট পজিশন', res.netPosition, 'fa-scale-balanced', res.netPosition >= 0 ? 'text-emerald-600' : 'text-red-600', true)}
    `;
  } catch (err) {
    box.innerHTML = `<div class="col-span-2 lg:col-span-5 text-center text-xs text-slate-400 py-4">লোড ব্যর্থ হয়েছে।</div>`;
  }
}

function balanceItem(label, val, icon, colorClass, bold) {
  return `<div class="text-center p-2">
    <div class="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900/30 flex items-center justify-center mx-auto mb-1.5"><i class="fa-solid ${icon} text-xs ${colorClass}"></i></div>
    <div class="font-mono ${bold ? 'font-extrabold text-base' : 'font-bold text-sm'} ${colorClass}">${val < 0 ? '−' : ''}৳${fmt(Math.abs(val))}</div>
    <div class="text-[10px] text-slate-400 mt-0.5">${esc(label)}</div>
  </div>`;
}

function kpiCard(label, val, sub, icon, color) {
  const colors = {
    blue: 'text-brand bg-brand/10', green: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20', orange: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
  };
  return `<div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
    <div class="w-9 h-9 rounded-lg ${colors[color]} flex items-center justify-center mb-3"><i class="fa-solid ${icon} text-sm"></i></div>
    <div class="text-xl font-extrabold font-mono text-slate-800 dark:text-white">${esc(val)}</div>
    <div class="text-xs text-slate-500 mt-1">${esc(label)}</div>
    <div class="text-[11px] text-slate-400 mt-1">${esc(sub)}</div>
  </div>`;
}

function plRow(label, val, colorClass, bold) {
  const sign = val < 0 ? '−' : '';
  return `<div class="flex justify-between items-center py-1.5">
    <span class="text-sm ${bold ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-500'}">${esc(label)}</span>
    <span class="font-mono text-sm ${bold ? 'font-bold' : ''} ${colorClass}">${sign}৳${fmt(Math.abs(val))}</span>
  </div>`;
}

function emptyRow(msg) {
  return `<div class="px-5 py-8 text-center text-slate-400 text-sm"><i class="fa-solid fa-circle-check text-2xl opacity-30 mb-2 block"></i>${esc(msg)}</div>`;
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ২৯: Dashboard → Analytics ইন্টার-মডিউল নেভিগেশন + auto-fetch
// ────────────────────────────────────────────────────────────
function getCurrentMonthRange() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed
  const mm = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    fromDate: `${year}-${mm}-01`,
    toDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

function goToReportPeriod(type) {
  if (type === 'custom') {
    // ইউজার নিজে Analytics ট্যাবে fiscal year/month বেছে নেবেন — prefill/fetch নেই
    goTab('analytics');
    return;
  }
  let range;
  if (type === 'month') {
    range = getCurrentMonthRange();
  } else if (type === 'year') {
    // ✅ analytics.js-এর বিদ্যমান fiscal-year হেল্পার reuse করা হচ্ছে
    const currentFYStartYear = getFiscalYearOptions(1)[0].value;
    range = getFiscalPeriodRange(currentFYStartYear, null);
  } else {
    return;
  }
  APP_STATE.anaFrom = range.fromDate;
  APP_STATE.anaTo = range.toDate;
  goTab('analytics'); // renderAnalyticsModule() এই prefilled তারিখ দিয়েই রেন্ডার করবে
  // ব্যাকগ্রাউন্ডে auto-fetch — cap/cutoff-এর বাইরে পড়লে চুপচাপ ডেটা এনে merge করবে
  ensurePeriodDataLoaded(range.fromDate, range.toDate);
}

// ════════════════════════════════════════════════════════════
// ✅ AI DASHBOARD INSIGHT — Tier ১ (Step ১)
// rule-based computeSmartSuggestions()-এর সম্পূরক (প্রতিস্থাপন না)।
// বিদ্যমান aggregate সংখ্যা (নাম/PII ছাড়া) AI-কে পাঠিয়ে prioritized
// বাংলা bulletin বানায়। ম্যানুয়াল বাটন-ট্রিগার, Firestore cache
// (users/{uid}/config/aiDashboardCache) — রিলোডে আবার call হয় না।
// ════════════════════════════════════════════════════════════

let _aiInsightAvailability = null;

function buildAiInsightSummaryPayload(state) {
  const m = computeDashboardMetrics(state);
  const thisMonth = getMonthRangeOffset(0);
  const lastMonth = getMonthRangeOffset(-1);
  return {
    outOfStockCount: m.outStock.length,
    lowStockCount: m.lowStock.length,
    expiredMedicineCount: m.expiredItems.length, // ✅ নতুন — আগে negative daysLeft বাদ পড়ে যেত
    expiringSoonCount: m.expiryAlerts.filter(x => x.daysLeft >= 0 && x.daysLeft <= 30).length,
    totalCustomerDue: m.totalCustDue,
    dueCustomerCount: m.dueCustomers.length,
    todayNetProfit: m.netProfit,
    todayRevenue: m.netRevenue,
    todayInvoiceCount: m.invoiceCount,
    thisMonthProfit: computeMonthlyGrossProfit(thisMonth.fromDate, thisMonth.toDate),
    lastMonthProfit: computeMonthlyGrossProfit(lastMonth.fromDate, lastMonth.toDate),
  };
}

async function checkAiInsightAvailability() {
  try {
    const doc = await userCol('config').doc('aiSettings').get();
    const settings = doc.exists ? doc.data() : null;
    const hasRouting = !!(settings && settings.taskRouting && (settings.taskRouting.dashboardInsight || []).length);
    let allowedForMe = true;
    if (APP_STATE.isStaffMember) {
      allowedForMe = APP_STATE.staffRole === 'manager' && settings && settings.staffAccess === 'enabled';
    }
    _aiInsightAvailability = { configured: hasRouting, allowedForMe };
  } catch (err) {
    _aiInsightAvailability = { configured: false, allowedForMe: !APP_STATE.isStaffMember };
  }
  return _aiInsightAvailability;
}

async function loadAiInsightCache() {
  try {
    const doc = await userCol('config').doc('aiDashboardCache').get();
    return doc.exists ? doc.data() : null;
  } catch (err) {
    return null;
  }
}

async function saveAiInsightCache(text) {
  try {
    await userCol('config').doc('aiDashboardCache').set({
      text, generatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    console.warn('AI insight cache সংরক্ষণ ব্যর্থ:', err.message);
  }
}

function renderAiInsightCardShell() {
  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-5" id="ai-insight-card">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
        <i class="fa-solid fa-wand-magic-sparkles text-brand"></i> AI ইনসাইট
      </h5>
      <div id="ai-insight-body" class="text-xs text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-1"></i> লোড হচ্ছে...</div>
    </div>`;
}

async function initAiInsightCard() {
  const box = document.getElementById('ai-insight-body');
  if (!box) return;
  const avail = await checkAiInsightAvailability();
  if (!document.getElementById('ai-insight-body')) return;

  if (!avail.allowedForMe) {
    document.getElementById('ai-insight-card')?.remove();
    return;
  }
  if (!avail.configured) {
    box.innerHTML = `
      <p class="text-xs text-slate-400 mb-2">এখনো কোনো AI provider কনফিগার করা নেই।</p>
      ${!APP_STATE.isStaffMember
        ? `<button onclick="goTab('aiSettings')" class="btn btn-brand-outline btn-sm">AI সেটিংসে যান</button>`
        : `<p class="text-[11px] text-slate-400">মালিকের সাথে যোগাযোগ করুন।</p>`}
    `;
    return;
  }
  const cache = await loadAiInsightCache();
  if (!document.getElementById('ai-insight-body')) return;
  renderAiInsightBody(cache);
}

function renderAiInsightBody(cache) {
  const box = document.getElementById('ai-insight-body');
  if (!box) return;
  if (!cache || !cache.text) {
    box.innerHTML = `
      <p class="text-xs text-slate-400 mb-3">AI দিয়ে আজকের ব্যবসার একটা দ্রুত সারাংশ তৈরি করুন।</p>
      <button id="ai-insight-gen-btn" onclick="generateAiInsight()" class="btn btn-primary btn-sm">
        <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> AI ইনসাইট দেখুন
      </button>`;
    return;
  }
  const genDate = cache.generatedAt?.toDate ? cache.generatedAt.toDate() : new Date();
  const timeStr = genDate.toLocaleString('bn-BD', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  box.innerHTML = `
    <div class="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line mb-3">${esc(cache.text)}</div>
    <div class="flex items-center justify-between gap-2 flex-wrap">
      <span class="text-[11px] text-slate-400">শেষ আপডেট: ${esc(timeStr)}</span>
      <button id="ai-insight-gen-btn" onclick="generateAiInsight()" class="text-xs text-brand hover:underline">
        <i class="fa-solid fa-rotate-right mr-1"></i> নতুন করে জেনারেট করুন
      </button>
    </div>`;
}

async function generateAiInsight() {
  const btn = document.getElementById('ai-insight-gen-btn');
  const box = document.getElementById('ai-insight-body');
  if (!box) return;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> তৈরি হচ্ছে...'; }
  else box.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> তৈরি হচ্ছে...`;

  try {
    const summary = buildAiInsightSummaryPayload(APP_STATE);
    const res = await callAiTask('dashboardInsight', { summary });
    const tips = (res.data && res.data.tips) || [];
    if (!tips.length) throw new Error('AI কোনো পরামর্শ দিতে পারেনি।');
    const text = tips.map(t => '• ' + t).join('\n');
    await saveAiInsightCache(text);
    renderAiInsightBody({ text, generatedAt: { toDate: () => new Date() } });
  } catch (err) {
    box.innerHTML = `
      <p class="text-xs text-red-500 mb-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>${esc(humanizeError(err))}</p>
      <button onclick="generateAiInsight()" class="btn btn-secondary btn-sm">আবার চেষ্টা করুন</button>`;
  }
}
