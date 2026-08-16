'use strict';

// ════════════════════════════════════════════════════════════
// REORDER QUICK-LIST MODULE — ধাপ ৩৩.৩
// Dashboard-এর স্টকশূন্য/স্বল্প-স্টক suggestion থেকে ট্রিগার হয়।
// preferredSupplierId (ধাপ ৩৩.২) অনুযায়ী গ্রুপ, ভেতরে preferredRepId
// অনুযায়ী সাব-গ্রুপ। কোনো navigate নেই — সম্পূর্ণ ইনলাইন মডাল।
// কপি-বাটন ছাড়া কোনো auto-send/API-cost নেই — সম্পূর্ণ rule-based,
// ফ্রি-টিয়ার ফিচার (AI Business Assistant/ধাপ ৩৪-এ পরে reorderListDraft
// হিসেবে এক্সপোজ হবে, কিন্তু এই rule-based ভার্সনই সবসময় fallback থাকবে)।
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
// DATA — candidates বের করা ও গ্রুপ করা
// ────────────────────────────────────────────────────────────
function getReorderCandidates() {
  return APP_STATE.inventory
    .filter(inv => inv.status === 'out' || inv.status === 'low')
    .map(inv => {
      const med = APP_STATE.medicines.find(m => m.id === inv.medId);
      return {
        medId: inv.medId,
        brand: inv.brand,
        doseForm: inv.doseForm,
        strength: inv.strength,
        totalStock: inv.totalStock,
        status: inv.status,
        preferredSupplierId: med?.preferredSupplierId || '',
        preferredRepId: med?.preferredRepId || '',
      };
    })
    // স্টকশূন্য আগে, তারপর স্বল্প — জরুরি আইটেম উপরে থাকবে
    .sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1));
}

// রিটার্ন করে: { supplierGroups: [{supplierId, supplier, repGroups:[{repId,repName,repPhone,meds}], noRepMeds}], unassigned: [] }
function buildReorderGroups(candidates) {
  const bySupplier = new Map();
  const unassigned = [];

  candidates.forEach(c => {
    if (!c.preferredSupplierId) { unassigned.push(c); return; }
    const supplier = APP_STATE.suppliers.find(s => s.id === c.preferredSupplierId);
    if (!supplier) {
      // ✅ সরবরাহকারী মুছে ফেলা হয়ে থাকলে — silently unassigned-এ ফেলা না দিয়ে
      // আলাদা ট্যাগ সহ unassigned-এ রাখা হচ্ছে, যাতে ইউজার বুঝতে পারেন কেন এটা এখানে
      unassigned.push({ ...c, supplierDeleted: true });
      return;
    }
    if (!bySupplier.has(c.preferredSupplierId)) {
      bySupplier.set(c.preferredSupplierId, { supplier, repMap: new Map(), noRepMeds: [] });
    }
    const bucket = bySupplier.get(c.preferredSupplierId);
    if (c.preferredRepId) {
      if (!bucket.repMap.has(c.preferredRepId)) bucket.repMap.set(c.preferredRepId, []);
      bucket.repMap.get(c.preferredRepId).push(c);
    } else {
      bucket.noRepMeds.push(c);
    }
  });

  const supplierGroups = Array.from(bySupplier.entries()).map(([supplierId, bucket]) => ({
    supplierId,
    supplier: bucket.supplier,
    repGroupKeys: Array.from(bucket.repMap.keys()), // পরে representative নাম বসানোর জন্য রাখা হলো
    repMap: bucket.repMap,
    noRepMeds: bucket.noRepMeds,
  }));

  return { supplierGroups, unassigned };
}

// ────────────────────────────────────────────────────────────
// REPRESENTATIVES — শুধু যেসব সরবরাহকারীর গ্রুপে repId লাগবে, তাদেরই ফেচ
// ────────────────────────────────────────────────────────────
async function fetchRepsForSupplierGroups(supplierGroups) {
  const repDataMap = {}; // supplierId -> { repId -> {name, phone} }
  const needed = supplierGroups.filter(g => g.repGroupKeys.length > 0);

  await Promise.all(needed.map(async (g) => {
    const res = await apiGetRepresentatives(g.supplierId);
    repDataMap[g.supplierId] = {};
    if (res.success) {
      res.representatives.forEach(r => { repDataMap[g.supplierId][r.id] = r; });
    }
  }));

  return repDataMap;
}

// ────────────────────────────────────────────────────────────
// MODAL — খোলা + প্রগ্রেসিভ লোড
// ────────────────────────────────────────────────────────────
async function openReorderQuickListModal() {
  document.getElementById('reorder-list-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'reorder-list-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-truck-fast text-brand mr-1"></i> রি-অর্ডার তালিকা</h4>
      <p class="text-xs text-slate-400 mb-4">স্টকশূন্য/স্বল্প-স্টক ওষুধ, সরবরাহকারী অনুযায়ী গ্রুপ করা — প্রতি গ্রুপ কপি করে সরাসরি WhatsApp/SMS-এ পাঠান।</p>
      <div id="reorder-list-body">
        <div class="text-center text-slate-400 text-sm py-10"><i class="fa-solid fa-spinner fa-spin mr-2"></i>লোড হচ্ছে...</div>
      </div>
      <button onclick="document.getElementById('reorder-list-modal').remove()" class="btn btn-secondary btn-block mt-4">বন্ধ করুন</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('reorder-list-modal', () => document.getElementById('reorder-list-modal')?.remove());

  const candidates = getReorderCandidates();
  if (!candidates.length) {
    renderReorderListEmpty();
    return;
  }

  const { supplierGroups, unassigned } = buildReorderGroups(candidates);
  const repDataMap = await fetchRepsForSupplierGroups(supplierGroups);
  if (!document.getElementById('reorder-list-body')) return; // মডাল ততক্ষণে বন্ধ হয়ে গেলে safe no-op

  renderReorderListBody(supplierGroups, unassigned, repDataMap);
}

function renderReorderListEmpty() {
  const box = document.getElementById('reorder-list-body');
  if (!box) return;
  box.innerHTML = `<div class="text-center text-slate-400 text-sm py-10"><i class="fa-solid fa-circle-check text-2xl opacity-30 mb-2 block"></i>স্টকশূন্য/স্বল্প-স্টক কোনো ওষুধ নেই।</div>`;
}

function renderReorderListBody(supplierGroups, unassigned, repDataMap) {
  const box = document.getElementById('reorder-list-body');
  if (!box) return;

  const supplierBlocks = supplierGroups.map(g => renderSupplierGroupBlock(g, repDataMap[g.supplierId] || {})).join('');
  const unassignedBlock = unassigned.length ? renderUnassignedBlock(unassigned) : '';

  box.innerHTML = (supplierBlocks || unassignedBlock)
    ? `<div class="space-y-4">${supplierBlocks}${unassignedBlock}</div>`
    : renderReorderListEmpty() || '';

  wireReorderCopyButtons();
}

// ────────────────────────────────────────────────────────────
// RENDER — সরবরাহকারী-গ্রুপ ব্লক (ভেতরে rep-সাব-গ্রুপ + noRep মেডিসিন)
// ────────────────────────────────────────────────────────────
function renderSupplierGroupBlock(g, reps) {
  const repBlocks = Array.from(g.repMap.entries()).map(([repId, meds]) => {
    const rep = reps[repId];
    return renderMedGroupCard({
      title: rep ? `${g.supplier.name} — ${rep.name}` : `${g.supplier.name} — (প্রতিনিধি মুছে ফেলা হয়েছে)`,
      phone: rep?.phone || g.supplier.phone || '',
      meds,
      groupKey: `sup-${g.supplierId}-rep-${repId}`,
    });
  }).join('');

  const noRepBlock = g.noRepMeds.length ? renderMedGroupCard({
    title: g.supplier.name,
    phone: g.supplier.phone || '',
    meds: g.noRepMeds,
    groupKey: `sup-${g.supplierId}-norep`,
  }) : '';

  return repBlocks + noRepBlock;
}

function renderUnassignedBlock(meds) {
  const deletedNote = meds.some(m => m.supplierDeleted)
    ? `<p class="text-[11px] text-amber-600 mb-2"><i class="fa-solid fa-triangle-exclamation mr-1"></i>এর মধ্যে কিছু ওষুধের পূর্বনির্ধারিত সরবরাহকারী মুছে ফেলা হয়েছে — Medicine Master-এ গিয়ে নতুন করে নির্ধারণ করুন।</p>`
    : '';
  return `
    <div class="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-lg p-4">
      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <h5 class="text-sm font-semibold text-amber-700 dark:text-amber-400">
          <i class="fa-solid fa-triangle-exclamation mr-1"></i> সাপ্লায়ার নির্ধারিত নেই (${meds.length} টি)
        </h5>
        <button onclick="document.getElementById('reorder-list-modal').remove(); goTab('medicine');" class="text-xs text-brand hover:underline whitespace-nowrap">
          <i class="fa-solid fa-arrow-right mr-1"></i>Medicine Master-এ গিয়ে নির্ধারণ করুন
        </button>
      </div>
      ${deletedNote}
      <div class="space-y-1">
        ${meds.map(m => renderReorderMedRow(m)).join('')}
      </div>
    </div>`;
}

// ────────────────────────────────────────────────────────────
// RENDER — একটা গ্রুপ কার্ড (সরবরাহকারী/প্রতিনিধি হেডার + মেডিসিন-তালিকা + কপি বাটন)
// ────────────────────────────────────────────────────────────
function renderMedGroupCard({ title, phone, meds, groupKey }) {
  const medsJson = esc(JSON.stringify(meds.map(m => ({
    brand: m.brand, doseForm: m.doseForm, strength: m.strength, status: m.status, totalStock: m.totalStock,
  }))));
  return `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-4" data-reorder-group="${esc(groupKey)}">
      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div>
          <div class="text-sm font-semibold text-slate-800 dark:text-white">${esc(title)}</div>
          ${phone ? `<div class="text-[11px] text-slate-400 font-mono">${esc(phone)}</div>` : ''}
        </div>
        <button type="button" class="reorder-copy-btn text-brand text-xs font-semibold hover:underline whitespace-nowrap"
          data-title="${esc(title)}" data-meds-json="${medsJson}">
          <i class="fa-solid fa-copy mr-1"></i>কপি করুন (${meds.length} টি)
        </button>
      </div>
      <div class="space-y-1">
        ${meds.map(m => renderReorderMedRow(m)).join('')}
      </div>
    </div>`;
}

function renderReorderMedRow(m) {
  const statusBadge = m.status === 'out'
    ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400">শূন্য</span>`
    : `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">স্বল্প (${m.totalStock})</span>`;
  return `
    <div class="flex items-center justify-between gap-2 text-xs px-2 py-1.5 rounded bg-slate-50 dark:bg-slate-900/30">
      <span class="text-slate-700 dark:text-slate-200 truncate">${esc(m.brand)} ${esc(m.doseForm || '')} ${esc(m.strength || '')}</span>
      ${statusBadge}
    </div>`;
}

// ────────────────────────────────────────────────────────────
// COPY — Bengali টেক্সট বানিয়ে clipboard-এ (contact.js-এর copyToClipboardWithToast reuse)
// ────────────────────────────────────────────────────────────
function buildReorderMessageText(title, meds) {
  const lines = meds.map((m, i) =>
    `${i + 1}. ${m.brand} ${m.doseForm || ''} ${m.strength || ''} — ${m.status === 'out' ? 'স্টক শেষ' : `স্টক কম (${m.totalStock})`}`
  );
  const pharmacyName = APP_STATE.pharmacyName || 'ফার্মেসি';
  return `${pharmacyName} থেকে রি-অর্ডার অনুরোধ (${title}):\n\n${lines.join('\n')}\n\nঅনুগ্রহ করে সরবরাহের ব্যবস্থা করুন। ধন্যবাদ।`;
}

function wireReorderCopyButtons() {
  document.querySelectorAll('.reorder-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const title = btn.dataset.title || 'রি-অর্ডার';
      let meds = [];
      try { meds = JSON.parse(btn.dataset.medsJson.replace(/&quot;/g, '"').replace(/&amp;/g, '&')); } catch (e) { meds = []; }
      const text = buildReorderMessageText(title, meds);
      copyToClipboardWithToast(text, `"${title}" রি-অর্ডার তালিকা`);
    });
  });
}