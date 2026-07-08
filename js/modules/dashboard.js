'use strict';

// ════════════════════════════════════════════════════════════
// DASHBOARD MODULE — P&L (Accrual) + Cash Flow + Receivables + Returns Effect
// ✅ Step 10 আপডেট: supplierPayments এখন Cash Flow-এ যুক্ত (cash-out)
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

  // ── Expiry Alert (৯০ দিন) ──
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const expiryAlerts = state.inventory
    .filter(m => m.nearestExpiry)
    .map(m => {
      const ed = parseExpiryDate(m.nearestExpiry);
      return ed ? { ...m, daysLeft: Math.ceil((ed - now) / 86400000) } : null;
    })
    .filter(m => m && m.daysLeft <= 90)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return {
    netRevenue, netCogs, discountTotal, grossProfit, todayExpenseTotal, netProfit,
    newDueToday, cashFromSalesToday, dueCollectedToday, cashPurchaseToday, supplierPaymentTotal,
    cashIn, cashOut, netCashFlow,
    totalCustDue, totalSupPayable, dueCustomers, netReceivableChange,
    stockCostValue, stockMrpValue, lowStock, outStock, expiryAlerts,
    invoiceCount: todaySales.length, paymentCount: todayPayments.length,
    todayPayments, revenueReturnToday, writeOffLossToday, todayReturns,
  };
}

function renderDashboardModule() {
  const container = document.getElementById('dashboard-content');
  if (!container) return;
  const m = computeDashboardMetrics(APP_STATE);
  const netColor = m.netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  const cashColor = m.netCashFlow >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';

  container.innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${kpiCard('আজকের বিক্রয় (নিট)', '৳' + fmtK(m.netRevenue), m.invoiceCount + ' টি ইনভয়েস', 'fa-sack-dollar', 'blue')}
      ${kpiCard('নিট মুনাফা (Net Profit)', (m.netProfit >= 0 ? '৳' : '−৳') + fmtK(Math.abs(m.netProfit)), 'Revenue − COGS − Expense − Write-off', 'fa-chart-line', m.netProfit >= 0 ? 'green' : 'red')}
      ${kpiCard('আজ নগদ আদায় (Cash In)', '৳' + fmtK(m.cashIn), 'বিক্রয় নগদ + বাকি আদায়', 'fa-hand-holding-dollar', 'green')}
      ${kpiCard('আজ বাকি আদায়', '৳' + fmtK(m.dueCollectedToday), m.paymentCount + ' টি পেমেন্ট', 'fa-money-bill-transfer', 'orange')}
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
              <span class="text-xs font-semibold ${x.daysLeft <= 30 ? 'text-red-600' : 'text-amber-600'}">${x.daysLeft} দিন</span>
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