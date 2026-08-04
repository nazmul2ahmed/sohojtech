'use strict';

// ════════════════════════════════════════════════════════════
// AI SETTINGS MODULE — ধাপ ১৪/Step 3
// Owner-only ট্যাব — provider key কনফিগার, staffAccess টগল,
// task-routing (fallback chain) নির্বাচন, শেয়ার্ড-AI এন্টাইটেলমেন্ট দেখা।
//
// ⚠️ গুরুত্বপূর্ণ: aiSecret কখনো read হয় না (Firestore rules-এ ব্লকড)।
// তাই key input সবসময় খালি থাকবে — শুধু aiSettings.providers[x].keyMask
// আর validated দেখিয়ে "key আছে/নেই" বোঝানো হয়। নতুন key দিলে ওভাররাইট হয়,
// পুরনোটা কখনো UI-তে ফেরত আসে না (এটাই ইচ্ছাকৃত — security trade-off)।
// ════════════════════════════════════════════════════════════

const AI_PROVIDERS = [
  { id: 'gemini', label: 'Google Gemini', hint: 'ফ্রি-টিয়ার সবচেয়ে উদার — সুপারিশকৃত primary' },
  { id: 'openai', label: 'OpenAI (GPT-4o-mini)', hint: 'নতুন অ্যাকাউন্টে সীমিত ফ্রি ক্রেডিট' },
  { id: 'claude', label: 'Anthropic Claude', hint: 'সাধারণত ফ্রি-টিয়ার নেই — ব্যাকআপ হিসেবে ভালো' },
];

const AI_TASKS = [
  { id: 'purchaseInvoiceReader', label: 'ক্রয়-ইনভয়েস রিডার', desc: 'ইনভয়েসের ছবি থেকে স্বয়ংক্রিয়ভাবে ক্রয়-এন্ট্রি তৈরি' },
  { id: 'prescriptionAssist', label: 'প্রেসক্রিপশন সহায়ক', desc: 'প্রেসক্রিপশনের ছবি থেকে ওষুধ সাজেশন (POS-এ, সবসময় নিজে যাচাই করতে হবে)' },
  { id: 'dashboardInsight', label: 'ড্যাশবোর্ড ইনসাইট', desc: 'ব্যবসার তথ্য থেকে AI-ভিত্তিক পরামর্শ' },
];

let _aiSettingsCache = null; // সর্বশেষ লোড করা aiSettings — save-এর সময় merge করতে

function renderAiSettingsModule() {
  const c = document.getElementById('aiSettings-content');
  if (!c) return;

  if (APP_STATE.isStaffMember) {
    c.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-400"><i class="fa-solid fa-lock text-2xl mb-3 opacity-40"></i><p class="text-sm">এই পেজ শুধু মালিকের জন্য।</p></div>`;
    return;
  }

  c.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <div class="px-5 py-10 text-center text-slate-400 text-sm" id="ai-settings-loading"><i class="fa-solid fa-spinner fa-spin mr-2"></i>লোড হচ্ছে...</div>
    </div>`;

  loadAndRenderAiSettings();
}

async function loadAndRenderAiSettings() {
  try {
    const uid = APP_STATE.currentUser.uid;
    const [settingsDoc, addonDoc] = await Promise.all([
      fbDb.collection('users').doc(uid).collection('config').doc('aiSettings').get(),
      fbDb.collection('users').doc(uid).collection('config').doc('aiPremiumAddon').get(),
    ]);

    _aiSettingsCache = settingsDoc.exists ? settingsDoc.data() : defaultAiSettings();
    const addon = addonDoc.exists ? addonDoc.data() : null;

    renderAiSettingsBody(_aiSettingsCache, addon);
  } catch (err) {
    const box = document.getElementById('ai-settings-loading');
    if (box) box.innerHTML = `<span class="text-red-500">লোড ব্যর্থ: ${esc(humanizeError(err))}</span>`;
  }
}

function defaultAiSettings() {
  return {
    providers: {},
    taskRouting: { purchaseInvoiceReader: [], prescriptionAssist: [], dashboardInsight: [] },
    staffAccess: 'owner_only',
  };
}

function renderAiSettingsBody(settings, addon) {
  const c = document.getElementById('aiSettings-content');
  if (!c) return;

  c.innerHTML = `
    ${renderProviderCards(settings)}
    ${renderStaffAccessCard(settings)}
    ${renderTaskRoutingCard(settings)}
    ${renderPremiumAddonCard(addon)}
  `;

  wireProviderCardEvents();
  wireStaffAccessEvents(settings);
  wireTaskRoutingEvents(settings);
}

// ────────────────────────────────────────────────────────────
// PROVIDER CARDS — key input + mask + validated badge + test বাটন
// ────────────────────────────────────────────────────────────
function renderProviderCards(settings) {
  const providers = settings.providers || {};
  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
        <i class="fa-solid fa-key text-brand"></i> AI Provider Key
      </h5>
      <p class="text-[11px] text-slate-400 mb-4">নিরাপত্তার জন্য key একবার সেভ করার পর আর ফেরত দেখানো হয় না — শুধু মাস্কড ফর্ম দেখাবে। নতুন key দিলে পুরনোটা ওভাররাইট হয়ে যাবে।</p>
      <div class="space-y-4">
        ${AI_PROVIDERS.map(p => renderOneProviderCard(p, providers[p.id])).join('')}
      </div>
    </div>`;
}

function renderOneProviderCard(provider, data) {
  const hasKey = !!(data && data.keyMask);
  const validated = !!(data && data.validated);
  return `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-4" data-provider-card="${provider.id}">
      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div>
          <div class="text-sm font-semibold text-slate-800 dark:text-white">${esc(provider.label)}</div>
          <div class="text-[11px] text-slate-400">${esc(provider.hint)}</div>
        </div>
        ${hasKey ? (validated
          ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>সচল</span>`
          : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600"><i class="fa-solid fa-triangle-exclamation mr-1"></i>যাচাই করা হয়নি</span>`)
          : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">কনফিগার করা নেই</span>`}
      </div>
      ${hasKey ? `<div class="text-xs font-mono text-slate-500 mb-2">বর্তমান: ${esc(data.keyMask)}</div>` : ''}
      <div class="flex gap-2">
        <input type="password" id="ai-key-input-${provider.id}" placeholder="নতুন API key পেস্ট করুন"
          class="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        <button type="button" data-toggle-visibility="${provider.id}" class="btn-icon" title="দেখুন/লুকান"><i class="fa-solid fa-eye"></i></button>
        <button type="button" data-test-save="${provider.id}" class="btn btn-primary btn-sm whitespace-nowrap">টেস্ট ও সেভ</button>
      </div>
      <div id="ai-key-status-${provider.id}" class="text-xs mt-2"></div>
    </div>`;
}

function wireProviderCardEvents() {
  AI_PROVIDERS.forEach(p => {
    document.querySelector(`[data-toggle-visibility="${p.id}"]`)?.addEventListener('click', () => {
      const inp = document.getElementById(`ai-key-input-${p.id}`);
      inp.type = inp.type === 'password' ? 'text' : 'password';
    });
    document.querySelector(`[data-test-save="${p.id}"]`)?.addEventListener('click', () => testAndSaveProviderKey(p.id));
  });
}

function maskKey(key) {
  if (key.length <= 10) return key[0] + '***';
  return key.slice(0, 6) + '***-' + key.slice(-4);
}

async function testAndSaveProviderKey(providerId) {
  if (guardReadOnly()) return;
  const inp = document.getElementById(`ai-key-input-${providerId}`);
  const statusEl = document.getElementById(`ai-key-status-${providerId}`);
  const key = inp.value.trim();
  if (!key) { statusEl.innerHTML = `<span class="text-red-500">Key দিন।</span>`; return; }

  const btn = document.querySelector(`[data-test-save="${providerId}"]`);
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> যাচাই হচ্ছে...';
  statusEl.innerHTML = '';

  try {
    const uid = APP_STATE.currentUser.uid;

    // ১. আগে Firestore-এ key লিখে ফেলা হচ্ছে (owner-write অনুমোদিত) — এটা ছাড়া
    // proxy-সাইড টেস্ট সম্ভব না, কারণ proxy সবসময় Firestore থেকেই key পড়ে।
    await fbDb.collection('users').doc(uid).collection('config').doc('aiSecret')
      .set({ [providerId]: { apiKey: key }, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });

    // ২. Apps Script proxy-কে বলা হচ্ছে এই নির্দিষ্ট provider সরাসরি টেস্ট করতে
    const testResult = await testAiProviderConnection(providerId);

    // ৩. ফলাফল অনুযায়ী aiSettings.providers[x] আপডেট
    const validated = !!testResult.success;
    const patch = {};
    patch[`providers.${providerId}`] = {
      keyMask: maskKey(key),
      validated,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await fbDb.collection('users').doc(uid).collection('config').doc('aiSettings').set(patch, { merge: true });

    if (validated) {
      statusEl.innerHTML = `<span class="text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>সফল! Key সচল আছে।</span>`;
      toast(`${providerId} key সংরক্ষিত ও যাচাই হয়েছে।`, 's');
    } else {
      statusEl.innerHTML = `<span class="text-red-500"><i class="fa-solid fa-circle-xmark mr-1"></i>ব্যর্থ: ${esc(testResult.message || 'অজানা সমস্যা')}</span>`;
      toast('Key সংরক্ষণ হয়েছে কিন্তু যাচাই ব্যর্থ — key সঠিক কিনা চেক করুন।', 'w');
    }
    inp.value = '';
    loadAndRenderAiSettings(); // রিফ্রেশ — নতুন mask/status দেখানোর জন্য
  } catch (err) {
    statusEl.innerHTML = `<span class="text-red-500">সমস্যা: ${esc(humanizeError(err))}</span>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'টেস্ট ও সেভ';
  }
}

// ────────────────────────────────────────────────────────────
// STAFF ACCESS টগল
// ────────────────────────────────────────────────────────────
function renderStaffAccessCard(settings) {
  const enabled = settings.staffAccess === 'enabled';
  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
        <i class="fa-solid fa-users-gear text-brand"></i> স্টাফরাও কি AI ব্যবহার করতে পারবে?
      </h5>
      <div class="space-y-2 mb-2">
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="ai-staff-access" value="owner_only" ${!enabled ? 'checked' : ''}/> শুধু আমি (মালিক)
        </label>
        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="ai-staff-access" value="enabled" ${enabled ? 'checked' : ''}/> ম্যানেজার পারবেন (ক্যাশিয়ার পারবেন না)
        </label>
      </div>
      <p class="text-[11px] text-amber-600"><i class="fa-solid fa-circle-info mr-1"></i>AI কল করলে আপনার নিজের API billing-এ খরচ যোগ হয় — স্টাফদের অনুমতি দিলে তারাও এই খরচ তৈরি করতে পারবে।</p>
    </div>`;
}

function wireStaffAccessEvents(settings) {
  document.querySelectorAll('input[name="ai-staff-access"]').forEach(radio => {
    radio.addEventListener('change', async (e) => {
      if (guardReadOnly()) { renderAiSettingsModule(); return; }
      try {
        const uid = APP_STATE.currentUser.uid;
        await fbDb.collection('users').doc(uid).collection('config').doc('aiSettings')
          .set({ staffAccess: e.target.value }, { merge: true });
        toast('স্টাফ-অ্যাক্সেস আপডেট হয়েছে।', 's');
      } catch (err) { toast(humanizeError(err), 'e'); }
    });
  });
}

// ────────────────────────────────────────────────────────────
// TASK ROUTING — প্রতি টাস্কে ১ম/২য়/৩য় পছন্দ (fallback chain)
// ────────────────────────────────────────────────────────────
function renderTaskRoutingCard(settings) {
  const routing = settings.taskRouting || {};
  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
        <i class="fa-solid fa-route text-brand"></i> কোন কাজে কোন AI (ফলব্যাক অর্ডার)
      </h5>
      <p class="text-[11px] text-slate-400 mb-4">১ম পছন্দ ব্যর্থ হলে ২য়টা, সেটাও ব্যর্থ হলে ৩য়টা চেষ্টা হবে। "শেয়ার্ড AI" শুধু প্রিমিয়াম-অ্যাডঅন সাবস্ক্রাইবারদের জন্য কাজ করবে।</p>
      <div class="space-y-5">
        ${AI_TASKS.map(t => renderOneTaskRouting(t, routing[t.id] || [])).join('')}
      </div>
    </div>`;
}

function renderOneTaskRouting(task, chain) {
  const options = [
    { value: '', label: '— কিছু না —' },
    { value: 'gemini', label: 'Gemini' },
    { value: 'openai', label: 'OpenAI' },
    { value: 'claude', label: 'Claude' },
    { value: 'platform_shared', label: 'শেয়ার্ড AI (প্রিমিয়াম)' },
  ];
  const slotSelect = (slotIdx, currentVal) => `
    <select data-task="${task.id}" data-slot="${slotIdx}" class="ai-routing-select px-2 py-1.5 text-xs border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
      ${options.map(o => `<option value="${o.value}" ${currentVal === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
    </select>`;

  return `
    <div>
      <div class="text-sm font-semibold text-slate-700 dark:text-slate-200">${esc(task.label)}</div>
      <div class="text-[11px] text-slate-400 mb-2">${esc(task.desc)}</div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-[11px] text-slate-400">১ম:</span> ${slotSelect(0, chain[0] || '')}
        <span class="text-[11px] text-slate-400">২য়:</span> ${slotSelect(1, chain[1] || '')}
        <span class="text-[11px] text-slate-400">৩য়:</span> ${slotSelect(2, chain[2] || '')}
      </div>
    </div>`;
}

function wireTaskRoutingEvents(settings) {
  document.querySelectorAll('.ai-routing-select').forEach(sel => {
    sel.addEventListener('change', () => saveTaskRoutingFromUI(settings));
  });
}

async function saveTaskRoutingFromUI(settings) {
  if (guardReadOnly()) { renderAiSettingsModule(); return; }
  const newRouting = {};
  AI_TASKS.forEach(t => {
    const slots = [0, 1, 2].map(i => document.querySelector(`.ai-routing-select[data-task="${t.id}"][data-slot="${i}"]`)?.value || '');
    newRouting[t.id] = slots.filter(Boolean); // খালি স্লট বাদ, ক্রম অক্ষুণ্ণ
  });

  try {
    const uid = APP_STATE.currentUser.uid;
    await fbDb.collection('users').doc(uid).collection('config').doc('aiSettings')
      .set({ taskRouting: newRouting }, { merge: true });
    toast('কাজ-বিন্যাস সংরক্ষিত হয়েছে।', 's');
  } catch (err) { toast(humanizeError(err), 'e'); }
}

// ────────────────────────────────────────────────────────────
// PREMIUM ADDON স্ট্যাটাস (read-only — শুধু admin বদলাতে পারে)
// ────────────────────────────────────────────────────────────
function renderPremiumAddonCard(addon) {
  const active = addon && addon.active;
  return `
    <div class="bg-brand/5 border border-brand/20 rounded-xl p-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
        <i class="fa-solid fa-crown text-brand"></i> শেয়ার্ড AI (প্রিমিয়াম অ্যাডঅন)
      </h5>
      ${active ? `
        <p class="text-sm text-emerald-600 font-semibold mb-1"><i class="fa-solid fa-circle-check mr-1"></i>সক্রিয়</p>
        <p class="text-xs text-slate-500">আজকের ব্যবহার: ${addon.dailyUsageCount || 0} / ${addon.dailyCap || 20}</p>
        ${addon.expiresAt ? `<p class="text-xs text-slate-500">মেয়াদ শেষ: ${esc(new Date(addon.expiresAt).toLocaleDateString('bn-BD'))}</p>` : ''}
      ` : `
        <p class="text-sm text-slate-500 mb-2">এই সেবা সাবস্ক্রাইব করা নেই — নিজের key কনফিগার না থাকলে বা সেগুলো ব্যর্থ হলে এই ফলব্যাক পাওয়া যাবে না।</p>
        <button onclick="openSubscriptionPromo('trial')" class="btn btn-brand-outline btn-sm">প্ল্যান দেখুন</button>
      `}
    </div>`;
}
