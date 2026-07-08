'use strict';

// ════════════════════════════════════════════════════════════
// MEDICINE MASTER MODULE — Add/Edit/Delete + Duplicate Guard
// পরিচয় = Brand Name + Dose Form + Strength (কম্পোজিট কী)
// Brand Name সবসময় ইংরেজি হতে হবে; বাকি ফিল্ড বাংলা থাকতে পারে।
// ✅ Firestore রিওয়্যার: এখন সব CRUD apiXxx() ফাংশন কল করে,
// APP_STATE-এ optimistic লোকাল আপডেটও একইসাথে হয় (তাৎক্ষণিক UI রিফ্রেশ)।
// ════════════════════════════════════════════════════════════

function isEnglishBrand(str) {
  return /^[A-Za-z0-9\s\-\+\.\/()]+$/.test(String(str || '').trim());
}

function findDuplicateMedicine(brand, doseForm, strength, excludeId) {
  const key = (s) => String(s || '').trim().toLowerCase();
  return APP_STATE.medicines.find(m =>
    m.id !== excludeId &&
    key(m.brand) === key(brand) &&
    key(m.doseForm) === key(doseForm) &&
    key(m.strength) === key(strength)
  );
}

function genMedicineId(brand) {
  const slug = String(brand).toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) || 'MED';
  let n = APP_STATE.medicines.length + 1;
  let id = `MED-${slug}-${String(n).padStart(4, '0')}`;
  while (APP_STATE.medicines.some(m => m.id === id)) {
    n++;
    id = `MED-${slug}-${String(n).padStart(4, '0')}`;
  }
  return id;
}

// ────────────────────────────────────────────────────────────
// MAIN RENDER
// ────────────────────────────────────────────────────────────
function renderMedicineModule() {
  const c = document.getElementById('medicine-content');
  if (!c) return;
  APP_STATE.medSearch = APP_STATE.medSearch || '';

  const meds = APP_STATE.medicines;
  const categories = new Set(meds.map(m => m.category).filter(Boolean));
  const manufacturers = new Set(meds.map(m => m.manufacturer).filter(Boolean));

  c.innerHTML = `
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
      ${statCard('মোট ওষুধ', meds.length + ' টি', 'fa-capsules', 'blue')}
      ${statCard('ক্যাটাগরি', categories.size + ' টি', 'fa-tags', 'green')}
      ${statCard('ম্যানুফ্যাকচারার', manufacturers.size + ' টি', 'fa-industry', 'orange')}
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center gap-3 flex-wrap">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-capsules text-brand mr-1"></i> ওষুধ মাস্টার তালিকা</h5>
        <div class="flex items-center gap-2">
          <input type="text" id="med-search" placeholder="ওষুধ খুঁজুন..." value="${esc(APP_STATE.medSearch)}"
            oninput="onMedSearch(this.value)"
            class="w-40 sm:w-56 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
          <button onclick="openMedicineForm(null)" class="bg-brand hover:bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg whitespace-nowrap">
            <i class="fa-solid fa-plus mr-1"></i> নতুন ওষুধ
          </button>
        </div>
      </div>
      <div id="med-table-body"></div>
    </div>
  `;
  renderMedTable();
}

function onMedSearch(val) {
  APP_STATE.medSearch = val;
  renderMedTable();
}

function renderMedTable() {
  const body = document.getElementById('med-table-body');
  if (!body) return;
  const q = (APP_STATE.medSearch || '').toLowerCase();
  const list = APP_STATE.medicines.filter(m =>
    !q || (m.brand + ' ' + (m.generic || '') + ' ' + (m.doseForm || '') + ' ' + (m.strength || '')).toLowerCase().includes(q)
  );

  if (!list.length) {
    body.innerHTML = `<div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-capsules text-2xl opacity-30 mb-2 block"></i>কোনো ওষুধ পাওয়া যায়নি</div>`;
    return;
  }

  body.innerHTML = `
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase text-slate-500 dark:text-slate-400">
        <tr>
          <th class="px-4 py-2.5 text-left">ব্র্যান্ড (EN)</th>
          <th class="px-4 py-2.5 text-left hidden sm:table-cell">জেনেরিক</th>
          <th class="px-4 py-2.5 text-left">ফর্ম/শক্তি</th>
          <th class="px-4 py-2.5 text-left hidden md:table-cell">ক্যাটাগরি</th>
          <th class="px-4 py-2.5 text-right hidden lg:table-cell">রি-অর্ডার</th>
          <th class="px-4 py-2.5 text-center">অ্যাকশন</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(m => `
        <tr class="border-t border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
          <td class="px-4 py-3">
            <div class="font-semibold text-slate-800 dark:text-white">${esc(m.brand)}</div>
            <div class="text-[11px] font-mono text-slate-400">${esc(m.id)}</div>
          </td>
          <td class="px-4 py-3 hidden sm:table-cell text-slate-500 text-xs">${esc(m.generic || '—')}</td>
          <td class="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">${esc(m.doseForm || '—')} ${esc(m.strength || '')}</td>
          <td class="px-4 py-3 hidden md:table-cell text-xs text-slate-500">${esc(m.category || '—')}</td>
          <td class="px-4 py-3 hidden lg:table-cell text-right font-mono text-xs text-slate-500">${m.reorderLevel ?? '—'}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">
            <button onclick="openMedicineForm('${m.id}')" class="text-brand hover:underline text-xs mr-3"><i class="fa-solid fa-pen mr-1"></i>এডিট</button>
            <button onclick="deleteMedicineConfirm('${m.id}')" class="text-red-500 hover:underline text-xs"><i class="fa-solid fa-trash mr-1"></i>মুছুন</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

// ────────────────────────────────────────────────────────────
// ADD / EDIT MODAL
// ────────────────────────────────────────────────────────────
function openMedicineForm(medId) {
  const isEdit = !!medId;
  const med = isEdit ? APP_STATE.medicines.find(m => m.id === medId) : null;
  if (isEdit && !med) return;

  const doseForms = ['ট্যাবলেট', 'ক্যাপসুল', 'সিরাপ', 'ইনজেকশন', 'ক্রিম/মলম', 'ড্রপস', 'ইনহেলার', 'সাপোজিটরি', 'অন্যান্য'];
  const units = ['পাতা', 'বোতল', 'পিস', 'টিউব', 'ভায়াল', 'বক্স'];

  const modal = document.createElement('div');
  modal.id = 'medicine-form-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1">${isEdit ? 'ওষুধ এডিট' : 'নতুন ওষুধ যোগ করুন'}</h4>
      ${isEdit ? `<p class="text-xs text-slate-400 mb-4 font-mono">${esc(med.id)}</p>` : `<p class="text-xs text-slate-400 mb-4">Brand Name অবশ্যই ইংরেজিতে লিখুন</p>`}
      <div id="med-form-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-4"></div>
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="col-span-2">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Brand Name (English) *</label>
          <input type="text" id="mf-brand" value="${esc(med?.brand || '')}" placeholder="e.g. Maxpro"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div class="col-span-2">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">জেনেরিক নাম</label>
          <input type="text" id="mf-generic" value="${esc(med?.generic || '')}" placeholder="e.g. Omeprazole"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ডোজ ফর্ম *</label>
          <select id="mf-doseform" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            ${doseForms.map(d => `<option value="${esc(d)}" ${med?.doseForm === d ? 'selected' : ''}>${esc(d)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">শক্তি/পরিমাণ *</label>
          <input type="text" id="mf-strength" value="${esc(med?.strength || '')}" placeholder="20mg বা 100ml"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div class="col-span-2">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ম্যানুফ্যাকচারার</label>
          <input type="text" id="mf-mfr" value="${esc(med?.manufacturer || '')}"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ক্যাটাগরি</label>
          <input type="text" id="mf-category" value="${esc(med?.category || '')}" placeholder="এন্টাসিড"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">একক (Unit)</label>
          <select id="mf-unit" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            ${units.map(u => `<option value="${esc(u)}" ${(med?.unit || 'পাতা') === u ? 'selected' : ''}>${esc(u)}</option>`).join('')}
          </select>
        </div>
        <div class="col-span-2">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">রি-অর্ডার লেভেল</label>
          <input type="number" id="mf-reorder" value="${med?.reorderLevel ?? 10}" min="0"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
      </div>
      <div class="flex gap-2">
        <button id="med-save-btn" onclick="saveMedicine(${isEdit ? `'${medId}'` : 'null'})" class="flex-1 bg-brand hover:bg-blue-700 text-white font-semibold py-2 rounded-lg text-sm">সংরক্ষণ করুন</button>
        <button onclick="closeMedicineForm()" class="px-5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-600 dark:text-slate-300">বাতিল</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  document.getElementById('mf-brand').focus();
}

function closeMedicineForm() {
  document.getElementById('medicine-form-modal')?.remove();
}

// ✅ async — Firestore কল শেষ না হওয়া পর্যন্ত বাটন disabled থাকবে (ডাবল-সাবমিট রোধ)
async function saveMedicine(medId) {
  const isEdit = !!medId;
  const errEl = document.getElementById('med-form-error');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  errEl.classList.add('hidden');

  const brand = document.getElementById('mf-brand').value.trim();
  const generic = document.getElementById('mf-generic').value.trim();
  const doseForm = document.getElementById('mf-doseform').value;
  const strength = document.getElementById('mf-strength').value.trim();
  const manufacturer = document.getElementById('mf-mfr').value.trim();
  const category = document.getElementById('mf-category').value.trim();
  const unit = document.getElementById('mf-unit').value;
  const reorderLevel = parseInt(document.getElementById('mf-reorder').value) || 0;

  if (!brand) return showErr('Brand Name আবশ্যক।');
  if (!isEnglishBrand(brand)) return showErr('Brand Name অবশ্যই ইংরেজি অক্ষরে লিখতে হবে (বাংলায় নয়)।');
  if (!strength) return showErr('শক্তি/পরিমাণ আবশ্যক (যেমন: 20mg বা 100ml)।');

  const dup = findDuplicateMedicine(brand, doseForm, strength, medId);
  if (dup) return showErr(`এই ওষুধ ইতিমধ্যে আছে (${dup.id}) — "${dup.brand} ${dup.doseForm} ${dup.strength}"। নতুন এন্ট্রি না করে Edit করুন।`);

  const btn = document.getElementById('med-save-btn');
  btn.disabled = true;
  btn.textContent = 'সংরক্ষণ হচ্ছে...';

  try {
    if (isEdit) {
      const res = await apiUpdateMedicine(medId, { brand, generic, doseForm, strength, manufacturer, category, unit, reorderLevel });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }

      await apiUpdateInventoryFields(medId, { brand, doseForm, strength });

      const med = APP_STATE.medicines.find(m => m.id === medId);
      Object.assign(med, { brand, generic, doseForm, strength, manufacturer, category, unit, reorderLevel });
      const inv = APP_STATE.inventory.find(i => i.medId === medId);
      if (inv) { inv.brand = brand; inv.doseForm = doseForm; inv.strength = strength; }
      toast('ওষুধ আপডেট হয়েছে।', 's');
    } else {
      const id = genMedicineId(brand);
      const res = await apiAddMedicine({ id, brand, generic, doseForm, strength, manufacturer, category, unit, reorderLevel });
      if (!res.success) { showErr(res.message); btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন'; return; }

      const invRow = { medId: id, brand, doseForm, strength, totalStock: 0, costValue: 0, mrpValue: 0, sellPrice: 0, nearestExpiry: '', status: 'out', batches: [] };
      await apiSetInventoryRow(id, invRow);

      APP_STATE.medicines.push({ id, brand, generic, doseForm, strength, manufacturer, category, unit, reorderLevel });
      APP_STATE.inventory.push(invRow);
      toast(`"${brand}" যোগ হয়েছে। এখন Purchase থেকে স্টক যোগ করুন।`, 's');
    }
    closeMedicineForm();
    renderMedTable();
  } catch (err) {
    showFatalError('ওষুধ সংরক্ষণে সমস্যা:\n' + err.message);
    btn.disabled = false;
    btn.textContent = 'সংরক্ষণ করুন';
  }
}

// ────────────────────────────────────────────────────────────
// DELETE
// ────────────────────────────────────────────────────────────
async function deleteMedicineConfirm(medId) {
  const med = APP_STATE.medicines.find(m => m.id === medId);
  if (!med) return;
  const inv = APP_STATE.inventory.find(i => i.medId === medId);
  if (inv && inv.totalStock > 0) {
    toast(`স্টক আছে (${inv.totalStock} ইউনিট)। মুছতে হলে আগে স্টক শূন্য করুন।`, 'w');
    return;
  }
  if (!confirm(`"${med.brand} ${med.doseForm} ${med.strength}" মুছে ফেলতে চান?`)) return;

  try {
    const res = await apiDeleteMedicine(medId);
    if (!res.success) { toast(res.message, 'w'); return; }
    APP_STATE.medicines = APP_STATE.medicines.filter(m => m.id !== medId);
    APP_STATE.inventory = APP_STATE.inventory.filter(i => i.medId !== medId);
    toast('ওষুধ মুছে ফেলা হয়েছে।', 's');
    renderMedTable();
  } catch (err) {
    showFatalError('ওষুধ মুছতে সমস্যা:\n' + err.message);
  }
}