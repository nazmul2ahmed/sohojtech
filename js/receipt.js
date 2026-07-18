'use strict';

// ════════════════════════════════════════════════════════════
// RECEIPT MODULE — থার্মাল-স্টাইল রিসিট (Print + WhatsApp Share)
// sale/purchase/return — তিনটাই এই একই জেনেরিক রেন্ডারার ব্যবহার করে।
// কোনো external dependency নেই — window.print() + native Canvas API।
// ════════════════════════════════════════════════════════════

const RECEIPT_CANVAS_WIDTH = 384; // ~80mm থার্মাল স্কেল
const RECEIPT_FONT = "'JetBrains Mono', monospace";

// ────────────────────────────────────────────────────────────
// buildReceiptConfig(type, doc) — sale/purchase/return → কমন shape
// ────────────────────────────────────────────────────────────
function buildReceiptConfig(type, doc) {
  const pharmacy = {
    name: APP_STATE.pharmacyName || 'ফার্মেসি',
    address: APP_STATE.address || '',
    phone: APP_STATE.phone || '',
  };
  if (type === 'sale') return buildSaleReceiptConfig(doc, pharmacy);
  if (type === 'purchase') return buildPurchaseReceiptConfig(doc, pharmacy);
  if (type === 'return') return buildReturnReceiptConfig(doc, pharmacy);
  throw new Error('অজানা রিসিট টাইপ: ' + type);
}

function buildSaleReceiptConfig(sale, pharmacy) {
  const items = (sale.items || []).map(item => {
    const gross = item.qty * item.price;
    const disc = gross * (item.discountPct || 0) / 100;
    return {
      name: item.name, qty: item.qty, unitPrice: item.price,
      discountPct: item.discountPct || 0, lineTotal: round2(gross - disc),
    };
  });
  const grossSubtotal = round2(items.reduce((a, b) => a + b.qty * b.unitPrice, 0));
  const discountTotal = round2(grossSubtotal - sale.totalBill);

  const totals = [
    { label: 'সাবটোটাল', value: grossSubtotal },
    ...(discountTotal > 0 ? [{ label: 'ডিসকাউন্ট', value: -discountTotal }] : []),
    { label: 'গ্র্যান্ড টোটাল', value: sale.totalBill, bold: true },
    { label: 'নগদ', value: sale.cashPaid },
    ...(sale.due > 0 ? [{ label: 'বাকি', value: sale.due, emphasis: true }] : []),
  ];

  return {
    type: 'sale', docLabel: 'বিক্রয় রসিদ', pharmacy,
    refLabel: 'Invoice', refNo: sale.invoiceNo, date: sale.date,
    partyLabel: 'গ্রাহক', partyName: sale.customerName,
    items, totals, notes: [],
  };
}

function buildPurchaseReceiptConfig(pur, pharmacy) {
  const items = (pur.items || []).map(item => ({
    name: item.brand, qty: item.qty, unitPrice: item.purchasePrice,
    expiry: item.expiryDate || '', lineTotal: round2(item.qty * item.purchasePrice),
  }));
  const totals = [
    { label: 'মোট ক্রয়মূল্য', value: pur.totalCost, bold: true },
    { label: 'পেমেন্ট', value: pur.paymentType, isText: true },
  ];
  return {
    type: 'purchase', docLabel: 'ক্রয় রসিদ', pharmacy,
    refLabel: 'Purchase ID', refNo: pur.purchaseId, date: pur.date,
    partyLabel: 'সরবরাহকারী', partyName: pur.supplierName,
    items, totals, notes: [],
  };
}

function buildReturnReceiptConfig(ret, pharmacy) {
  const isCustomer = ret.returnType === 'customer';
  const items = (ret.items || []).map(item => ({
    name: item.name, qty: item.qty,
    unitPrice: isCustomer ? item.price : item.purchasePrice,
    lineTotal: isCustomer
      ? round2(item.qty * item.price * (1 - (item.discountPct || 0) / 100))
      : round2(item.qty * item.purchasePrice),
  }));
  const totals = [{ label: 'মোট পরিমাণ', value: ret.amount, bold: true }];

  const notes = [];
  if (isCustomer) {
    notes.push('রিফান্ড মেথড: ' + (ret.refundMethod || '—'));
  } else {
    notes.push('কারণ: ' + (ret.reason || '—'));
    if (ret.reason === 'ফেরত') notes.push('মেথড: ' + (ret.refundMethod || '—'));
  }

  return {
    type: 'return',
    docLabel: isCustomer ? 'কাস্টমার রিটার্ন' : (ret.reason === 'ধ্বংস' ? 'রাইট-অফ রসিদ' : 'সাপ্লায়ার রিটার্ন'),
    pharmacy,
    refLabel: isCustomer ? 'মূল Invoice' : 'মূল Purchase', refNo: ret.refId, date: ret.date,
    partyLabel: isCustomer ? 'গ্রাহক' : 'সরবরাহকারী', partyName: ret.refName,
    items, totals, notes,
  };
}

// ────────────────────────────────────────────────────────────
// PRINT — window.print() + @media print, 80mm ন্যারো লেআউট
// ────────────────────────────────────────────────────────────
function printReceiptHTML(config) {
  ensureReceiptPrintStyles();
  document.getElementById('receipt-print-area')?.remove();

  const area = document.createElement('div');
  area.id = 'receipt-print-area';
  area.innerHTML = buildReceiptHTMLContent(config);
  document.body.appendChild(area);

  window.print();

  const cleanup = () => { area.remove(); window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
}

function buildReceiptHTMLContent(config) {
  const p = config.pharmacy;
  const itemRows = config.items.map(item => `
    <div class="r-item-name">${esc(item.name)}</div>
    <div class="r-item-line">
      <span>${item.qty} x ৳${fmt(item.unitPrice)}${item.discountPct ? ' (' + item.discountPct + '%)' : ''}${item.expiry ? ' • ' + esc(item.expiry) : ''}</span>
      <span>৳${fmt(item.lineTotal)}</span>
    </div>`).join('');

  const totalRows = config.totals.map(t => `
    <div class="r-total-row ${t.bold ? 'r-bold' : ''} ${t.emphasis ? 'r-emphasis' : ''}">
      <span>${esc(t.label)}</span><span>${t.isText ? esc(t.value) : '৳' + fmt(t.value)}</span>
    </div>`).join('');

  const noteRows = (config.notes || []).map(n => `<div class="r-note">${esc(n)}</div>`).join('');

  return `
    <div class="r-center r-bold r-name">${esc(p.name)}</div>
    ${p.address ? `<div class="r-center r-small">${esc(p.address)}</div>` : ''}
    ${p.phone ? `<div class="r-center r-small">${esc(p.phone)}</div>` : ''}
    <div class="r-dashed"></div>
    <div class="r-center r-bold">${esc(config.docLabel)}</div>
    <div class="r-dashed"></div>
    <div class="r-meta"><span>${esc(config.refLabel)}</span><span>${esc(config.refNo)}</span></div>
    <div class="r-meta"><span>তারিখ</span><span>${esc(config.date)}</span></div>
    <div class="r-meta"><span>${esc(config.partyLabel)}</span><span>${esc(config.partyName)}</span></div>
    <div class="r-dashed"></div>
    ${itemRows}
    <div class="r-dashed"></div>
    ${totalRows}
    ${noteRows ? `<div class="r-dashed"></div>${noteRows}` : ''}
    <div class="r-dashed"></div>
    <div class="r-center r-small">ধন্যবাদ!</div>`;
}

function ensureReceiptPrintStyles() {
  if (document.getElementById('receipt-print-style')) return;
  const style = document.createElement('style');
  style.id = 'receipt-print-style';
  style.textContent = `
    #receipt-print-area { display: none; }
    @media print {
      body * { visibility: hidden; }
      #receipt-print-area, #receipt-print-area * { visibility: visible; }
      #receipt-print-area {
        display: block !important; position: absolute; left: 0; top: 0;
        width: 80mm; padding: 2mm; font-family: 'JetBrains Mono', monospace;
        font-size: 11px; color: #000;
      }
      .r-center { text-align: center; }
      .r-bold { font-weight: 700; }
      .r-small { font-size: 9px; }
      .r-name { font-size: 14px; }
      .r-dashed { border-top: 1px dashed #000; margin: 4px 0; }
      .r-meta { display: flex; justify-content: space-between; }
      .r-item-name { font-weight: 600; }
      .r-item-line { display: flex; justify-content: space-between; margin-bottom: 2px; }
      .r-total-row { display: flex; justify-content: space-between; }
      .r-total-row.r-emphasis { color: #b91c1c; font-weight: 700; }
      .r-note { font-size: 10px; }
      @page { margin: 0; size: 80mm auto; }
    }`;
  document.head.appendChild(style);
}

// ────────────────────────────────────────────────────────────
// CANVAS RENDER — WhatsApp শেয়ারের জন্য ইমেজ তৈরি
// ────────────────────────────────────────────────────────────
function renderReceiptCanvas(config) {
  const width = RECEIPT_CANVAS_WIDTH;
  const padding = 16;
  const lineHeight = 20;
  const estimatedLines = 12 + config.items.length * 2 + config.totals.length + (config.notes || []).length;
  const draftHeight = padding * 2 + estimatedLines * lineHeight;

  const draft = document.createElement('canvas');
  draft.width = width; draft.height = draftHeight;
  const ctx = draft.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, draftHeight);
  ctx.fillStyle = '#111111'; ctx.textBaseline = 'top';

  let y = padding;
  const centerX = width / 2;

  const dashedLine = (yy) => {
    ctx.beginPath(); ctx.setLineDash([3, 3]);
    ctx.moveTo(padding, yy); ctx.lineTo(width - padding, yy);
    ctx.strokeStyle = '#999'; ctx.stroke(); ctx.setLineDash([]);
  };
  const truncate = (text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 3 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  };

  ctx.font = `bold 16px ${RECEIPT_FONT}`; ctx.textAlign = 'center';
  ctx.fillText(config.pharmacy.name, centerX, y); y += lineHeight + 2;

  ctx.font = `10px ${RECEIPT_FONT}`;
  if (config.pharmacy.address) { ctx.fillText(config.pharmacy.address, centerX, y); y += lineHeight - 4; }
  if (config.pharmacy.phone) { ctx.fillText(config.pharmacy.phone, centerX, y); y += lineHeight - 4; }

  y += 6; dashedLine(y); y += 10;
  ctx.font = `bold 13px ${RECEIPT_FONT}`;
  ctx.fillText(config.docLabel, centerX, y); y += lineHeight;
  dashedLine(y); y += 10;

  ctx.font = `11px ${RECEIPT_FONT}`;
  const metaRow = (label, val) => {
    ctx.textAlign = 'left'; ctx.fillText(label, padding, y);
    ctx.textAlign = 'right'; ctx.fillText(String(val), width - padding, y);
    y += lineHeight - 4;
  };
  metaRow(config.refLabel, config.refNo);
  metaRow('তারিখ', config.date);
  metaRow(config.partyLabel, config.partyName);

  y += 6; dashedLine(y); y += 10;

  config.items.forEach(item => {
    ctx.textAlign = 'left'; ctx.font = `bold 11px ${RECEIPT_FONT}`;
    ctx.fillText(truncate(item.name, width - padding * 2), padding, y);
    y += lineHeight - 5;

    ctx.font = `10px ${RECEIPT_FONT}`;
    let sub = `${item.qty} x ৳${fmt(item.unitPrice)}`;
    if (item.discountPct) sub += ` (${item.discountPct}%)`;
    if (item.expiry) sub += ` • ${item.expiry}`;
    ctx.textAlign = 'left'; ctx.fillText(sub, padding, y);
    ctx.textAlign = 'right'; ctx.fillText('৳' + fmt(item.lineTotal), width - padding, y);
    y += lineHeight - 2;
  });

  y += 4; dashedLine(y); y += 10;

  config.totals.forEach(t => {
    ctx.font = t.bold ? `bold 12px ${RECEIPT_FONT}` : `11px ${RECEIPT_FONT}`;
    ctx.fillStyle = t.emphasis ? '#b91c1c' : '#111111';
    ctx.textAlign = 'left'; ctx.fillText(t.label, padding, y);
    ctx.textAlign = 'right'; ctx.fillText(t.isText ? String(t.value) : '৳' + fmt(t.value), width - padding, y);
    ctx.fillStyle = '#111111'; y += lineHeight - 3;
  });

  if (config.notes && config.notes.length) {
    y += 4; dashedLine(y); y += 10;
    ctx.font = `10px ${RECEIPT_FONT}`;
    config.notes.forEach(n => { ctx.textAlign = 'left'; ctx.fillText(n, padding, y); y += lineHeight - 6; });
  }

  y += 6; dashedLine(y); y += 14;
  ctx.font = `10px ${RECEIPT_FONT}`; ctx.textAlign = 'center';
  ctx.fillText('ধন্যবাদ!', centerX, y); y += lineHeight;

  // ✅ প্রকৃত ব্যবহৃত height অনুযায়ী resize — নিচে অতিরিক্ত সাদা জায়গা এড়াতে
  const final = document.createElement('canvas');
  final.width = width; final.height = y + padding;
  const fctx = final.getContext('2d');
  fctx.fillStyle = '#ffffff'; fctx.fillRect(0, 0, final.width, final.height);
  fctx.drawImage(draft, 0, 0);
  return final;
}

// ────────────────────────────────────────────────────────────
// SHARE — Web Share API (files), fallback: ডাউনলোড
// ────────────────────────────────────────────────────────────
function shareReceiptImage(config) {
  const canvas = renderReceiptCanvas(config);
  canvas.toBlob(async (blob) => {
    if (!blob) { toast('রিসিট ইমেজ তৈরি করতে সমস্যা হয়েছে।', 'e'); return; }
    const fileName = `receipt-${config.refNo}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: config.docLabel, text: `${config.docLabel} — ${config.refNo}` });
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast('শেয়ার করতে সমস্যা হয়েছে — ইমেজ ডাউনলোড হচ্ছে।', 'w');
          downloadBlob(blob, fileName);
        }
      }
    } else {
      toast('এই ব্রাউজারে সরাসরি শেয়ার সাপোর্ট নেই — ইমেজ ডাউনলোড হচ্ছে।', 'w');
      downloadBlob(blob, fileName);
    }
  }, 'image/png');
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ────────────────────────────────────────────────────────────
// MODAL — non-blocking, skip করা যায়
// ────────────────────────────────────────────────────────────
function openReceiptModal(type, doc) {
  const config = buildReceiptConfig(type, doc);
  document.getElementById('receipt-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'receipt-modal';
  modal.className = 'fixed inset-0 z-[9997] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-5 max-w-sm w-full">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-receipt text-brand mr-1"></i> রিসিট প্রস্তুত</h4>
      <p class="text-xs text-slate-400 mb-4">${esc(config.docLabel)} — ${esc(config.refNo)}</p>
      <div class="flex flex-col gap-2">
        <button id="receipt-print-btn" class="w-full bg-brand hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm"><i class="fa-solid fa-print mr-1"></i> প্রিন্ট করুন</button>
        <button id="receipt-share-btn" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm"><i class="fa-brands fa-whatsapp mr-1"></i> WhatsApp-এ শেয়ার করুন</button>
        <button onclick="document.getElementById('receipt-modal').remove()" class="w-full border border-slate-300 dark:border-slate-600 rounded-lg py-2 text-sm text-slate-600 dark:text-slate-300">বাদ দিন</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  document.getElementById('receipt-print-btn').addEventListener('click', () => printReceiptHTML(config));
  document.getElementById('receipt-share-btn').addEventListener('click', () => shareReceiptImage(config));
}

// ────────────────────────────────────────────────────────────
// RE-PRINT হেল্পার — History list-এর print আইকন থেকে কল হয়
// ────────────────────────────────────────────────────────────
function reprintSaleReceipt(invoiceNo) {
  const sale = APP_STATE.sales.find(s => s.invoiceNo === invoiceNo);
  if (!sale) return toast('বিক্রয় খুঁজে পাওয়া যায়নি।', 'w');
  openReceiptModal('sale', sale);
}
function reprintPurchaseReceipt(purchaseId) {
  const pur = APP_STATE.purchases.find(p => p.purchaseId === purchaseId);
  if (!pur) return toast('ক্রয় খুঁজে পাওয়া যায়নি।', 'w');
  openReceiptModal('purchase', pur);
}
function reprintReturnReceipt(returnId) {
  const ret = APP_STATE.returns.find(r => r.returnId === returnId);
  if (!ret) return toast('রিটার্ন খুঁজে পাওয়া যায়নি।', 'w');
  openReceiptModal('return', ret);
}
