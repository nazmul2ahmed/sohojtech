'use strict';

// ════════════════════════════════════════════════════════════
// SEARCHABLE DROPDOWN — লিগ্যাসি SD ইঞ্জিনের Tailwind সংস্করণ।
// একক-instance ফিল্ডের জন্য (POS Customer, Purchase Supplier ইত্যাদি)।
// মাল্টি-রো আইটেমের জন্য (POS Medicine rows) আমরা native <datalist>
// ব্যবহার করব — কারণ সেটা বারকোড স্ক্যানার ও Enter-key flow-এর সাথে
// দ্রুত ও সহজে কাজ করে।
// ════════════════════════════════════════════════════════════
const SD = {}; // registry: id → { value, onChange, options }

function createSD(containerId, options, onChange, placeholder = '— খুঁজুন বা নির্বাচন করুন —') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const id = containerId;
  SD[id] = { value: '', onChange, options };

  container.innerHTML = `
    <div class="relative" id="sdw_${id}">
      <div id="sdSel_${id}" class="hidden"></div>
      <div id="sdRow_${id}" class="flex border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 focus-within:ring-2 focus-within:ring-brand">
        <input type="text" id="sdIn_${id}" placeholder="${esc(placeholder)}" autocomplete="off"
          class="flex-1 px-3 py-2 text-sm bg-transparent outline-none text-slate-800 dark:text-white"/>
        <div id="sdChev_${id}" class="px-3 flex items-center text-slate-400 cursor-pointer border-l border-slate-200 dark:border-slate-600">
          <i class="fa-solid fa-chevron-down text-xs"></i>
        </div>
      </div>
      <div id="sdDrop_${id}" class="hidden absolute left-0 right-0 top-[calc(100%+4px)] bg-white dark:bg-slate-700
           border border-brand rounded-lg shadow-lg z-50 max-h-56 overflow-y-auto"></div>
    </div>`;

  const inp = document.getElementById('sdIn_' + id);
  const drop = document.getElementById('sdDrop_' + id);
  const chev = document.getElementById('sdChev_' + id);

  function renderOpts(q = '') {
    const filtered = q
      ? SD[id].options.filter(o => (o.label + ' ' + (o.sub || '')).toLowerCase().includes(q.toLowerCase()))
      : SD[id].options;
    drop.innerHTML = filtered.length
      ? filtered.map(o => `
        <div class="sd-opt px-4 py-2.5 text-sm cursor-pointer hover:bg-brand/10 border-b border-slate-100 dark:border-slate-600/50 last:border-0 flex items-center justify-between gap-2"
             data-val="${esc(o.value)}" data-label="${esc(o.label)}">
          <div class="min-w-0">
            <div class="font-semibold text-slate-800 dark:text-white truncate">${esc(o.label)}</div>
            ${o.sub ? `<div class="text-xs text-slate-400 truncate">${esc(o.sub)}</div>` : ''}
          </div>
          ${o.badge ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${o.badgeClass || 'bg-brand/10 text-brand'}">${esc(o.badge)}</span>` : ''}
        </div>`).join('')
      : `<div class="px-4 py-4 text-center text-sm text-slate-400"><i class="fa-solid fa-magnifying-glass mr-1"></i>পাওয়া যায়নি</div>`;
    drop.classList.remove('hidden');
  }

  drop.addEventListener('click', (e) => {
    const opt = e.target.closest('.sd-opt');
    if (!opt) return;
    sdSelect(id, opt.dataset.val, opt.dataset.label);
  });
  inp.addEventListener('input', () => renderOpts(inp.value));
  inp.addEventListener('focus', () => { if (!SD[id].value) renderOpts(inp.value); });
  chev.addEventListener('click', () => {
    drop.classList.contains('hidden') ? renderOpts(inp.value) : drop.classList.add('hidden');
  });
  document.addEventListener('click', (e) => {
    if (!document.getElementById('sdw_' + id)?.contains(e.target)) drop.classList.add('hidden');
  }, true);
}

function sdSelect(id, value, label) {
  SD[id].value = value;
  document.getElementById('sdDrop_' + id)?.classList.add('hidden');
  document.getElementById('sdRow_' + id).style.display = 'none';
  const selEl = document.getElementById('sdSel_' + id);
  selEl.classList.remove('hidden');
  selEl.innerHTML = `
    <div class="flex items-center justify-between bg-brand/10 border border-brand/30 rounded-lg px-3 py-2">
      <span class="text-sm font-semibold text-brand truncate"><i class="fa-solid fa-circle-check mr-2"></i>${esc(label)}</span>
      <button type="button" class="text-slate-400 hover:text-red-500 flex-shrink-0 ml-2" onclick="sdClear('${id}')"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  if (SD[id].onChange) {
    try {
      SD[id].onChange(value);
    } catch (err) {
      showFatalError('Dropdown onChange("' + id + '") এ সমস্যা:\n' + err.message + '\n' + (err.stack || '').split('\n').slice(0,3).join('\n'));
    }
  }
}

function sdClear(id) {
  SD[id].value = '';
  document.getElementById('sdRow_' + id).style.display = '';
  document.getElementById('sdSel_' + id).classList.add('hidden');
  const inp = document.getElementById('sdIn_' + id);
  if (inp) inp.value = '';
  document.getElementById('sdDrop_' + id)?.classList.add('hidden');
  if (SD[id].onChange) SD[id].onChange('');
}

function sdGetValue(id) { return SD[id]?.value || ''; }
function sdSetOptions(id, newOpts) { if (SD[id]) SD[id].options = newOpts; }

// ════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ════════════════════════════════════════════════════════════
function toast(msg, type = 's') {
  const styles = {
    s: { icon: 'fa-circle-check', bar: 'border-emerald-500', ic: 'text-emerald-500' },
    d: { icon: 'fa-circle-exclamation', bar: 'border-red-500', ic: 'text-red-500' },
    w: { icon: 'fa-triangle-exclamation', bar: 'border-amber-500', ic: 'text-amber-500' },
  };
  const s = styles[type] || styles.s;
  const t = document.createElement('div');
  t.className = `bg-white dark:bg-slate-800 border-l-4 ${s.bar} rounded-lg shadow-lg px-4 py-3 min-w-[240px] max-w-[340px] flex items-start gap-3 transition-all duration-300`;
  t.innerHTML = `<i class="fa-solid ${s.icon} ${s.ic} mt-0.5"></i><span class="text-sm text-slate-700 dark:text-slate-200">${esc(msg)}</span>`;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(40px)';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}