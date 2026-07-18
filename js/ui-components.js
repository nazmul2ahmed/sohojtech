'use strict';

// ════════════════════════════════════════════════════════════
// SEARCHABLE DROPDOWN — লিগ্যাসি SD ইঞ্জিনের Tailwind সংস্করণ।
// একক-instance ফিল্ডের জন্য (POS Customer, Purchase Supplier ইত্যাদি)।
// মাল্টি-রো আইটেমের জন্য (POS Medicine rows) আমরা native <datalist>
// ব্যবহার করব — কারণ সেটা বারকোড স্ক্যানার ও Enter-key flow-এর সাথে
// দ্রুত ও সহজে কাজ করে।
// ════════════════════════════════════════════════════════════
const SD = {}; // registry: id → { value, onChange, options }
const SD_DOC_LISTENERS = {}; // ✅ নতুন: id → পূর্ববর্তী document click-listener রেফারেন্স, সরানোর জন্য

function createSD(containerId, options, onChange, placeholder = '— খুঁজুন বা নির্বাচন করুন —') {
  const container = document.getElementById(containerId);
  if (!container) return;
  const id = containerId;
  SD[id] = { value: '', onChange, options };

  // ✅ ফিক্স: এই id-এর জন্য আগে বসানো document click-listener থাকলে প্রথমে
  // সরিয়ে ফেলুন। নাহলে createSD() বারবার কল হলে (যেমন প্রতিটা বিক্রয়ের পর
  // POS ফর্ম রিসেটে) প্রতিবার একটা নতুন listener যোগ হতে থাকবে, কখনো সরবে
  // না — memory leak, যা লম্বা সেশনে অ্যাপ ধীর করে দেয়।
  if (SD_DOC_LISTENERS[id]) {
    document.removeEventListener('click', SD_DOC_LISTENERS[id], true);
    delete SD_DOC_LISTENERS[id];
  }

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

  // ✅ ফিক্স: এই handler-টা এখন একটা নামযুক্ত ভ্যারিয়েবলে রাখা হলো, যাতে
  // পরের createSD() কলে এটাকে খুঁজে বের করে সরানো যায়।
  const outsideClickHandler = (e) => {
    if (!document.getElementById('sdw_' + id)?.contains(e.target)) drop.classList.add('hidden');
  };
  document.addEventListener('click', outsideClickHandler, true);
  SD_DOC_LISTENERS[id] = outsideClickHandler;
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
function toggleCalculator() {
  let modal = document.getElementById('calc-modal');
  if (modal) { modal.remove(); return; }
  modal = document.createElement('div');
  modal.id = 'calc-modal';
  modal.className = 'fixed bottom-20 right-4 z-[9997] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 w-64';
  modal.innerHTML = `
    <input id="calc-display" readonly class="w-full text-right text-xl font-mono p-2 mb-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-800 dark:text-white" value="0"/>
    <div class="grid grid-cols-4 gap-1.5">
      ${['7','8','9','÷','4','5','6','×','1','2','3','−','C','0','.','+'].map(k => `<button onclick="calcPress('${k}')" class="py-2 rounded-lg text-sm font-semibold ${['÷','×','−','+'].includes(k) ? 'bg-brand text-white' : k === 'C' ? 'bg-red-100 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-white'}">${k}</button>`).join('')}
      <button onclick="calcPress('=')" class="col-span-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white mt-1">=</button>
    </div>`;
  document.body.appendChild(modal);
  APP_STATE.calcExpr = '';
}
function calcPress(k) {
  const disp = document.getElementById('calc-display');
  if (k === 'C') { APP_STATE.calcExpr = ''; disp.value = '0'; return; }
  if (k === '=') {
    try { disp.value = Function('"use strict";return (' + APP_STATE.calcExpr.replace(/×/g,'*').replace(/÷/g,'/').replace(/−/g,'-') + ')')(); APP_STATE.calcExpr = String(disp.value); }
    catch (e) { disp.value = 'Error'; APP_STATE.calcExpr = ''; }
    return;
  }
  APP_STATE.calcExpr += k;
  disp.value = APP_STATE.calcExpr;
}

// ════════════════════════════════════════════════════════════
// READ-ONLY GUARD — ধাপ ১৭: revoked/trial-expired/subscription-expired
// ইউজারের জন্য সাবমিট/এডিট/ডিলিট ফাংশনের শুরুতে এক লাইনে বসবে।
// true রিটার্ন মানে ব্লকড (ফাংশন এখানেই থেমে যাওয়া উচিত), false মানে
// এগোনো যাবে। server-side Firestore rules-ই আসল নিরাপত্তা — এটা শুধু
// raw permission-denied এরর মেসেজের বদলে বন্ধুত্বপূর্ণ বার্তা দেখানোর জন্য।
// ════════════════════════════════════════════════════════════
function guardReadOnly() {
  if (APP_STATE.readOnly) {
    toast('আপনার অ্যাকাউন্ট এখন শুধু পুরনো তথ্য দেখার (Read-Only) মোডে আছে — নতুন এন্ট্রি/পরিবর্তন করা যাবে না। সক্রিয় করতে মালিকের সাথে যোগাযোগ করুন।', 'w');
    return true;
  }
  return false;
}

// ════════════════════════════════════════════════════════════
// MEDICINE DISAMBIGUATION PANEL — ধাপ ২৫: একাধিক partial match
// হলে ব্যবহারকারীকে বাধ্যতামূলক স্পষ্ট selection করতে হবে।
// হালকা, custom floating panel — SD প্যাটার্নের ভারী registry ছাড়াই।
// ════════════════════════════════════════════════════════════
let _medDisambig = null; // { inputEl, matches, textFn, activeIdx, onSelect, panelEl }

function isMedDisambiguationOpenFor(inputEl) {
  return !!(_medDisambig && _medDisambig.inputEl === inputEl);
}

function showMedDisambiguation(inputEl, matches, textFn, onSelect) {
  closeMedDisambiguation();
  const rect = inputEl.getBoundingClientRect();
  const panel = document.createElement('div');
  panel.id = 'med-disambig-panel';
  panel.className = 'fixed z-[9994] bg-white dark:bg-slate-700 border border-brand rounded-lg shadow-lg max-h-56 overflow-y-auto';
  panel.style.left = rect.left + 'px';
  panel.style.top = (rect.bottom + 4) + 'px';
  panel.style.width = Math.max(rect.width, 220) + 'px';
  document.body.appendChild(panel);

  _medDisambig = { inputEl, matches, textFn, activeIdx: 0, onSelect, panelEl: panel };
  renderMedDisambigPanel();

  // mousedown (click না) — যাতে input-এর blur হওয়ার আগেই সিলেকশন ধরা যায়
  panel.addEventListener('mousedown', (e) => {
    const opt = e.target.closest('.med-dis-opt');
    if (!opt) return;
    e.preventDefault();
    confirmMedDisambiguationChoice(parseInt(opt.dataset.idx, 10));
  });

  document.addEventListener('mousedown', _medDisambigOutsideHandler, true);
}

function _medDisambigOutsideHandler(e) {
  if (!_medDisambig) return;
  if (_medDisambig.panelEl.contains(e.target) || e.target === _medDisambig.inputEl) return;
  closeMedDisambiguation();
}

function renderMedDisambigPanel() {
  if (!_medDisambig) return;
  const { matches, textFn, activeIdx, panelEl } = _medDisambig;
  panelEl.innerHTML = matches.map((m, i) => `
    <div class="med-dis-opt px-3 py-2 text-sm cursor-pointer border-b border-slate-100 dark:border-slate-600/50 last:border-0 ${i === activeIdx ? 'bg-brand/10 text-brand font-semibold' : 'text-slate-700 dark:text-slate-200'}" data-idx="${i}">
      ${esc(textFn(m))}
    </div>`).join('');
}

// keydown হ্যান্ডলিং — pos.js/purchase.js-এর কীডাউন হ্যান্ডলারের শুরুতে কল হবে।
// true রিটার্ন মানে এই কীপ্রেস প্যানেল সামলে নিয়েছে, কলার আর কিছু করবে না।
function medDisambiguationHandleKey(e) {
  if (!_medDisambig) return false;
  if (e.key === 'ArrowDown') { e.preventDefault(); _medDisambig.activeIdx = Math.min(_medDisambig.activeIdx + 1, _medDisambig.matches.length - 1); renderMedDisambigPanel(); return true; }
  if (e.key === 'ArrowUp') { e.preventDefault(); _medDisambig.activeIdx = Math.max(_medDisambig.activeIdx - 1, 0); renderMedDisambigPanel(); return true; }
  if (e.key === 'Enter') { e.preventDefault(); confirmMedDisambiguationChoice(_medDisambig.activeIdx); return true; }
  if (e.key === 'Escape') { e.preventDefault(); closeMedDisambiguation(); return true; }
  // অন্য কোনো কী (টাইপিং চালিয়ে যাওয়া) — তালিকা stale হয়ে যাবে, তাই বন্ধ করে দাও;
  // আবার Enter চাপলে নতুন করে ম্যাচ হবে
  closeMedDisambiguation();
  return false;
}

function confirmMedDisambiguationChoice(idx) {
  if (!_medDisambig) return;
  const chosen = _medDisambig.matches[idx];
  const cb = _medDisambig.onSelect;
  closeMedDisambiguation();
  if (cb) cb(chosen);
}

function closeMedDisambiguation() {
  if (!_medDisambig) return;
  _medDisambig.panelEl.remove();
  document.removeEventListener('mousedown', _medDisambigOutsideHandler, true);
  _medDisambig = null;
}

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ২৭: BOOTLOAD CAP HINT — sales/purchases/returns bootload-এ
// orderBy+limit cap থাকার কারণে পুরনো এন্ট্রি bootload-এ নাও থাকতে
// পারে। এই হেল্পার cap ছোঁয়া থাকলে (এবং older history এখনো লোড না
// হলে) একটা সতর্কতা ব্যানার + "লোড করুন" বাটন তৈরি করে — POS/Purchase/
// Returns তিন জায়গাতেই পুনঃব্যবহারযোগ্য, প্রতিটার নিজস্ব rerender
// ফাংশন-নাম স্ট্রিং হিসেবে পাস করে।
// ════════════════════════════════════════════════════════════
function capHintHTML(type, btnId, rerenderFnName, label) {
  if (!APP_STATE.capReached || !APP_STATE.capReached[type] || APP_STATE.olderHistoryLoaded) return '';
  return `
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-3 py-2 m-3 flex items-center justify-between gap-2 flex-wrap">
      <span><i class="fa-solid fa-triangle-exclamation mr-1"></i>${esc(label)}</span>
      <button id="${btnId}" onclick="handleLoadOlderHistoryClick('${btnId}','${rerenderFnName}')" class="text-brand font-semibold hover:underline whitespace-nowrap">
        <i class="fa-solid fa-clock-rotate-left mr-1"></i>পুরনো হিস্টোরি লোড করুন
      </button>
    </div>`;
}

// সফল হলে APP_STATE.olderHistoryLoaded = true হয়ে যায়, তাই capHintHTML()
// পরের রেন্ডারে আর কিছু দেখাবে না — rerenderFnName দিয়ে ডাইনামিকভাবে
// সঠিক মডিউলের রি-রেন্ডার ফাংশন কল হয় (POS/Purchase/Returns যেটাই হোক)।
async function handleLoadOlderHistoryClick(btnId, rerenderFnName) {
  const btn = document.getElementById(btnId);
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> লোড হচ্ছে...'; }
  try {
    const res = await apiGetOlderHistory();
    if (!res.success) {
      toast('পুরনো হিস্টোরি লোড ব্যর্থ: ' + res.message, 'w');
      if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left mr-1"></i>পুরনো হিস্টোরি লোড করুন'; }
      return;
    }
    mergeOlderHistoryIntoState(res);
    APP_STATE.olderHistoryLoaded = true;
    toast('পুরনো হিস্টোরি লোড হয়েছে।', 's');
    if (typeof window[rerenderFnName] === 'function') window[rerenderFnName]();
  } catch (err) {
    showFatalError('পুরনো হিস্টোরি লোডে সমস্যা:\n' + err.message);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-clock-rotate-left mr-1"></i>পুরনো হিস্টোরি লোড করুন'; }
  }
}
