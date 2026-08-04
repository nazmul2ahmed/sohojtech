'use strict';

let adminUsersUnsub = null;
const SUB_DURATIONS = [{ label: '১ মাস', days: 30 }, { label: '৩ মাস', days: 90 }, { label: '৬ মাস', days: 180 }, { label: '১ বছর', days: 365 }];

function renderAdminModule() {
  const c = document.getElementById('admin-content');
  if (!c) return;

  // ১. অ্যাডমিন চেক
  if (!APP_STATE.isAdmin) {
    c.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-400"><i class="fa-solid fa-lock text-2xl mb-3 opacity-40"></i><p class="text-sm">এই পেজ শুধু মালিকের জন্য।</p></div>`;
    return;
  }

  // ২. ট্যাব স্টেট সেট ও HTML রেন্ডার
  APP_STATE.adminTab = APP_STATE.adminTab || 'pending';
  c.innerHTML = `
    <div class="flex gap-2 mb-4">
      ${['pending', 'approved', 'revoked', 'all'].map(t => `<button onclick="setAdminTab('${t}')" id="admin-tab-${t}" class="px-4 py-1.5 rounded-lg text-xs font-semibold border"></button>`).join('')}
    </div>
    <div id="admin-user-list" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>ইউজার লোড হচ্ছে...</div>
    </div>`;

  // ৩. UI ও সাব-মডিউল ইনিশিয়ালিজেশন (HTML তৈরি হওয়ার পর)
  updateAdminTabsUI();
  setTimeout(renderGlobalMedUploader, 100); // <--- এখানে কল করা সবচেয়ে নিরাপদ

  // ৪. ফায়ারবেস লিসেনার (Realtime Listener)
  if (adminUsersUnsub) adminUsersUnsub();
  adminUsersUnsub = fbDb.collection('users').orderBy('createdAt', 'desc').onSnapshot((snap) => {
    APP_STATE.adminUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    renderAdminUserList();
  }, (err) => { 
    const listEl = document.getElementById('admin-user-list');
    if (listEl) listEl.innerHTML = `<div class="px-5 py-6 text-center text-red-500 text-xs">লোড ব্যর্থ: ${esc(err.message)}</div>`; 
  });
}

function setAdminTab(t) { APP_STATE.adminTab = t; updateAdminTabsUI(); renderAdminUserList(); }

function updateAdminTabsUI() {
  const labels = { pending: 'পেন্ডিং', approved: 'Approved', revoked: 'Revoked', all: 'সব' };
  Object.keys(labels).forEach(k => {
    const btn = document.getElementById('admin-tab-' + k);
    if (!btn) return;
    btn.textContent = labels[k];
    const active = APP_STATE.adminTab === k;
    btn.className = `btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`;
  });
}

function userEffectiveStatus(u) {
  if (u.status === 'revoked') return 'revoked';
  if (u.status === 'approved') return subscriptionDaysLeft(u) > 0 || subscriptionDaysLeft(u) === Infinity ? 'approved' : 'pending';
  return 'pending'; // trial (active বা expired দুটোই pending-review হিসেবে গণ্য)
}

function renderAdminUserList() {
  const el = document.getElementById('admin-user-list');
  if (!el) return;
  let users = APP_STATE.adminUsers || [];
  const tab = APP_STATE.adminTab;

  if (tab !== 'all') users = users.filter(u => userEffectiveStatus(u) === tab);
  if (tab === 'pending') {
    // সবচেয়ে বেশিদিন Trial-শেষ (overdue) — আগে
    users = users.slice().sort((a, b) => trialDaysLeft(a) - trialDaysLeft(b));
  }

  const badge = (u) => {
    const es = userEffectiveStatus(u);
    if (es === 'approved') {
      const sd = subscriptionDaysLeft(u);
      return sd === Infinity ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Approved (সীমাহীন)</span>`
        : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Approved — ${sd} দিন বাকি</span>`;
    }
    if (es === 'revoked') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Revoked</span>`;
    const days = trialDaysLeft(u);
    return days > 0
      ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Trial — ${days} দিন বাকি</span>`
      : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Trial শেষ (${Math.abs(days)} দিন আগে) — অনুমোদন প্রয়োজন</span>`;
  };

  const actionCell = (u) => {
    if (u.role === 'owner') return '<span class="text-[11px] text-slate-400">—</span>';
    const es = userEffectiveStatus(u);
    const durOpts = SUB_DURATIONS.map(d => `<option value="${d.days}">${d.label}</option>`).join('');
    // ✅ AI-B: AI অ্যাক্সেস প্যানেল বাটন — status নির্বিশেষে সব non-owner রো-তে
    // (BYOK/Addon admin আগে থেকেও প্রস্তুত রাখতে পারবেন, actual ব্যবহার
    // তখনও ownerHasPaidAccessAi()-এর ওপর নির্ভরশীল — AiProxy.gs দেখুন)
    const aiBtn = `<button onclick="openAiAccessModal('${u.uid}')" title="AI অ্যাক্সেস ম্যানেজ করুন" class="text-purple-600 hover:underline text-xs ml-2"><i class="fa-solid fa-robot"></i></button>`;
    if (es === 'approved') {
      return `<div class="flex items-center gap-1 justify-center flex-wrap">
        <select id="dur-${u.uid}" class="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700">${durOpts}</select>
        <button onclick="extendSubscription('${u.uid}')" class="text-brand hover:underline text-xs"><i class="fa-solid fa-arrows-rotate mr-1"></i>Extend</button>
        <button onclick="setUserStatus('${u.uid}','revoked')" class="text-red-500 hover:underline text-xs ml-2"><i class="fa-solid fa-ban"></i></button>
        ${aiBtn}
      </div>`;
    }
    return `<div class="flex items-center gap-1 justify-center flex-wrap">
      <select id="dur-${u.uid}" class="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700">${durOpts}</select>
      <button onclick="approveWithDuration('${u.uid}')" class="text-emerald-600 hover:underline text-xs"><i class="fa-solid fa-check mr-1"></i>Approve</button>
      ${es !== 'revoked' ? `<button onclick="setUserStatus('${u.uid}','revoked')" class="text-red-500 hover:underline text-xs ml-2"><i class="fa-solid fa-ban"></i></button>` : ''}
      ${aiBtn}
    </div>`;
  };

  el.innerHTML = `
    <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-user-shield text-brand mr-1"></i> ইউজার ম্যানেজমেন্ট (${users.length})</h5>
    </div>
    <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="bg-slate-50 dark:bg-slate-900/40 text-[11px] uppercase text-slate-500 dark:text-slate-400">
        <tr><th class="px-4 py-2.5 text-left">ইউজার</th><th class="px-4 py-2.5 text-left">স্ট্যাটাস</th><th class="px-4 py-2.5 text-center">অ্যাকশন</th></tr>
      </thead>
      <tbody>
        ${users.length ? users.map(u => `
        <tr class="border-t border-slate-100 dark:border-slate-700/50">
          <td class="px-4 py-3">
            <div class="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              ${u.photoURL ? `<img src="${esc(u.photoURL)}" class="w-6 h-6 rounded-full"/>` : ''}
              ${esc(u.displayName || '—')}
              ${u.role === 'owner' ? '<i class="fa-solid fa-crown text-amber-400 text-xs" title="মালিক"></i>' : ''}
            </div>
            <div class="text-[11px] text-slate-400">${esc(u.email)}</div>
          </td>
          <td class="px-4 py-3">${badge(u)}</td>
          <td class="px-4 py-3 text-center whitespace-nowrap">${actionCell(u)}</td>
        </tr>`).join('') : `<tr><td colspan="3" class="px-5 py-8 text-center text-slate-400 text-sm">কোনো ইউজার নেই</td></tr>`}
      </tbody>
    </table>
    </div>`;
}

function setUserStatus(uid, status) {
  const data = { status };
  if (status === 'revoked') data.subscriptionExpiresAt = firebase.firestore.FieldValue.delete();
  fbDb.collection('users').doc(uid).update(data).then(() => {
    toast(status === 'approved' ? 'ইউজার Approve করা হয়েছে।' : 'ইউজার Revoke করা হয়েছে।', 's');
  }).catch((err) => toast('ব্যর্থ: ' + err.message, 'e'));
}

function approveWithDuration(uid) {
  const days = parseInt(document.getElementById('dur-' + uid).value) || 30;
  const expiresAt = firebase.firestore.Timestamp.fromMillis(Date.now() + days * 86400000);
  fbDb.collection('users').doc(uid).update({ status: 'approved', subscriptionExpiresAt: expiresAt }).then(() => {
    toast(`Approve করা হয়েছে — মেয়াদ ${days} দিন।`, 's');
  }).catch((err) => toast('ব্যর্থ: ' + err.message, 'e'));
}

function extendSubscription(uid) {
  const days = parseInt(document.getElementById('dur-' + uid).value) || 30;
  const u = (APP_STATE.adminUsers || []).find(x => x.uid === uid);
  const currentExp = u?.subscriptionExpiresAt?.toDate ? u.subscriptionExpiresAt.toDate().getTime() : Date.now();
  const base = Math.max(currentExp, Date.now()); // মেয়াদ শেষ হয়ে থাকলে আজ থেকে, নাহলে বর্তমান মেয়াদের পর থেকে
  const newExp = firebase.firestore.Timestamp.fromMillis(base + days * 86400000);
  fbDb.collection('users').doc(uid).update({ subscriptionExpiresAt: newExp }).then(() => {
    toast(`সাবস্ক্রিপশন ${days} দিন বাড়ানো হয়েছে।`, 's');
  }).catch((err) => toast('ব্যর্থ: ' + err.message, 'e'));
}

// ════════════════════════════════════════════════════════════
// GLOBAL MEDICINE MASTER — CSV UPLOAD (ফাইল বাছাই + ম্যানুয়াল পেস্ট দুটোই)
// ════════════════════════════════════════════════════════════
function renderGlobalMedUploader() {
  const box = document.getElementById('admin-content');
  const existing = document.getElementById('gm-upload-box');
  if (existing) return;
  const div = document.createElement('div');
  div.id = 'gm-upload-box';
  div.className = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mt-4';
  div.innerHTML = `
    <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2"><i class="fa-solid fa-database text-brand mr-1"></i> Global Medicine Master Upload (শুধু Admin)</h5>
    <p class="text-[11px] text-slate-400 mb-2">CSV ফরম্যাট (হেডার সহ): <code class="bg-slate-100 dark:bg-slate-700 px-1 rounded">brand,generic,doseForm,strength,manufacturer,category</code></p>

    <div class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 mb-3 text-center">
      <input type="file" id="gm-csv-file" accept=".csv,text/csv" onchange="onGlobalMedFileSelect(event)" class="hidden"/>
      <label for="gm-csv-file" class="cursor-pointer inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
        <i class="fa-solid fa-file-arrow-up"></i> CSV ফাইল বাছাই করুন
      </label>
      <div id="gm-file-name" class="text-[11px] text-slate-400 mt-1"></div>
    </div>

    <details class="mb-2">
      <summary class="text-[11px] text-slate-400 cursor-pointer select-none">অথবা ম্যানুয়ালি পেস্ট করুন</summary>
      <textarea id="gm-csv-input" rows="6" placeholder="brand,generic,doseForm,strength,manufacturer,category&#10;Napa,Paracetamol,ট্যাবলেট,500mg,Beximco,Analgesic" class="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white mt-2"></textarea>
    </details>

    <div id="gm-upload-status" class="text-xs text-slate-500 mb-2"></div>
    <button onclick="uploadGlobalMedCsv()" id="gm-upload-btn" class="btn btn-primary">আপলোড করুন</button>
  `;
  box.appendChild(div);
}

// ফাইল বাছাই হলে টেক্সট রিড করে টেক্সটএরিয়ায় বসানো হয় — parsing/upload লজিক একই থাকে
function onGlobalMedFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const nameEl = document.getElementById('gm-file-name');
  const statusEl = document.getElementById('gm-upload-status');

  if (!file.name.toLowerCase().endsWith('.csv')) {
    statusEl.textContent = 'শুধু .csv ফাইল আপলোড করুন।';
    event.target.value = '';
    return;
  }

  nameEl.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB) — পড়া হচ্ছে...`;

  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('gm-csv-input').value = reader.result;
    const rowCount = reader.result.trim().split('\n').filter(l => l.trim()).length - 1;
    nameEl.textContent = `${file.name} — আনুমানিক ${Math.max(rowCount, 0)} টি সারি পাওয়া গেছে। "আপলোড করুন" চাপুন।`;
  };
  reader.onerror = () => {
    statusEl.textContent = 'ফাইল পড়তে ব্যর্থ: ' + reader.error?.message;
  };
  reader.readAsText(file, 'UTF-8');
}

// ✅ ফিক্স: কোটেড ফিল্ডে (") কমা থাকলেও সঠিকভাবে ভাঙে
function parseCsvLine(line) {
  const result = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result.map(v => v.trim());
}

async function uploadGlobalMedCsv() {
  const raw = document.getElementById('gm-csv-input').value.trim();
  if (!raw) return toast('CSV ফাইল বাছাই করুন বা পেস্ট করুন।', 'w');

  const lines = raw.split('\n').filter(l => l.trim());
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  }).filter(r => r.brand);

  if (!rows.length) return toast('কোনো বৈধ row পাওয়া যায়নি।', 'w');

  const btn = document.getElementById('gm-upload-btn');
  const statusEl = document.getElementById('gm-upload-status');
  const idleText = 'আপলোড করুন';

  btn.disabled = true;
  btn.textContent = 'প্রক্রিয়াকরণ হচ্ছে...';
  statusEl.textContent = `০ / ${rows.length} সারি আপলোড হয়েছে...`;

  // ✅ প্রতি ব্যাচ (৪০০ সারি) শেষে লাইভ প্রোগ্রেস দেখাবে — কোথায় আটকাচ্ছে বোঝা যাবে
  const res = await apiBulkUploadGlobalMedicines(rows, (done, total) => {
    statusEl.textContent = `${done} / ${total} সারি আপলোড হয়েছে...`;
  });

  btn.disabled = false;
  btn.textContent = idleText;

  if (!res.success && res.quotaExceeded) {
  document.getElementById('gm-upload-status').innerHTML = `<span class="text-amber-600">${esc(res.message)}</span>`;
  toast('Quota শেষ — আংশিক আপলোড হয়েছে, নিরাপদে পরে চালিয়ে নিতে পারবেন।', 'w');
  return;
}

  if (res.success) {
    toast(`${res.count} টি ওষুধ Global Master-এ যোগ হয়েছে।`, 's');
    document.getElementById('gm-csv-input').value = '';
    document.getElementById('gm-csv-file').value = '';
    document.getElementById('gm-file-name').textContent = '';
    statusEl.textContent = '';
  } else {
    statusEl.textContent = 'ব্যর্থ: ' + res.message;
  }
}

// ════════════════════════════════════════════════════════════
// ✅ AI-B: AI ACCESS MANAGEMENT — owner প্রতি BYOK (lifetime) +
// Premium Addon (duration-based) — দুটো স্বতন্ত্র admin-controlled টগল।
// ════════════════════════════════════════════════════════════
const AI_ADDON_DURATIONS = [
  { label: '৭ দিন', days: 7 }, { label: '৩০ দিন', days: 30 },
  { label: '৯০ দিন', days: 90 }, { label: '১ বছর', days: 365 },
];

function formatAiTimestamp(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('bn-BD') + ' ' + d.toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
}

async function openAiAccessModal(uid) {
  const u = (APP_STATE.adminUsers || []).find(x => x.uid === uid);
  if (!u) return;
  document.getElementById('ai-access-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'ai-access-modal';
  modal.className = 'fixed inset-0 z-[9995] bg-black/50 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      <h4 class="font-bold text-slate-800 dark:text-white mb-1"><i class="fa-solid fa-robot text-brand mr-1"></i> AI অ্যাক্সেস</h4>
      <p class="text-xs text-slate-400 mb-4">${esc(u.displayName || '')} — ${esc(u.email)}</p>
      <div id="ai-access-body" class="text-center text-slate-400 text-sm py-8"><i class="fa-solid fa-spinner fa-spin mr-2"></i>লোড হচ্ছে...</div>
      <button onclick="document.getElementById('ai-access-modal').remove()" class="btn btn-secondary btn-block mt-4">বন্ধ করুন</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('ai-access-modal', () => document.getElementById('ai-access-modal')?.remove());

  await loadAndRenderAiAccessModal(uid);
}

async function loadAndRenderAiAccessModal(uid) {
  const body = document.getElementById('ai-access-body');
  if (!body) return;
  try {
    const [accessDoc, addonDoc] = await Promise.all([
      fbDb.collection('users').doc(uid).collection('config').doc('aiAccess').get(),
      fbDb.collection('users').doc(uid).collection('config').doc('aiPremiumAddon').get(),
    ]);
    const access = accessDoc.exists ? accessDoc.data() : { byokEnabled: false };
    const addon = addonDoc.exists ? addonDoc.data() : null;
    renderAiAccessBody(uid, access, addon);
  } catch (err) {
    if (document.getElementById('ai-access-body')) {
      body.innerHTML = `<div class="text-red-500 text-xs py-4">লোড ব্যর্থ: ${esc(err.message)}</div>`;
    }
  }
}

function renderAiAccessBody(uid, access, addon) {
  const body = document.getElementById('ai-access-body');
  if (!body) return;
  const byokOn = !!access.byokEnabled;
  const addonExpiryMs = addon && addon.expiresAt && addon.expiresAt.toMillis ? addon.expiresAt.toMillis() : null;
  const addonExpired = addonExpiryMs !== null && addonExpiryMs < Date.now();
  const addonActive = !!(addon && addon.active) && !addonExpired;

  body.innerHTML = `
    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-4 mb-3 text-left">
      <div class="flex items-center justify-between mb-1">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-key text-brand mr-1"></i> নিজের API Key (BYOK) — Lifetime</h5>
        ${byokOn
          ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">সক্রিয়</span>`
          : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">নিষ্ক্রিয়</span>`}
      </div>
      <p class="text-[11px] text-slate-400 mb-3">একবার সক্রিয় করলে সাবস্ক্রিপশন রিনিউ/মেয়াদ-নির্বিশেষে আজীবন থাকবে — সেটাপ-চার্জ ভিত্তিক এককালীন আনলক। (ব্যবহারের জন্য তখনও সক্রিয় সাবস্ক্রিপশন লাগবে — এটা শুধু BYOK-এর অনুমতি, সাবস্ক্রিপশনের বিকল্প না।)</p>
      ${byokOn && access.byokEnabledAt ? `<p class="text-[11px] text-slate-400 mb-2">সক্রিয় হয়েছে: ${esc(formatAiTimestamp(access.byokEnabledAt))}${access.byokEnabledBy ? ' — ' + esc(access.byokEnabledBy) : ''}</p>` : ''}
      <button id="ai-byok-toggle-btn" onclick="toggleByokAccess('${uid}', ${!byokOn})" class="btn btn-sm ${byokOn ? 'btn-danger-outline' : 'btn-success'} btn-block">
        ${byokOn ? 'নিষ্ক্রিয় করুন' : 'সক্রিয় করুন (Lifetime Unlock)'}
      </button>
    </div>

    <div class="border border-slate-200 dark:border-slate-600 rounded-lg p-4 text-left">
      <div class="flex items-center justify-between mb-1">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-crown text-brand mr-1"></i> শেয়ার্ড AI (প্ল্যাটফর্ম প্রিমিয়াম)</h5>
        ${addonActive
          ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">সক্রিয়</span>`
          : addonExpired ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">মেয়াদ শেষ</span>`
          : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">নিষ্ক্রিয়</span>`}
      </div>
      <p class="text-[11px] text-slate-400 mb-3">নিজের key ছাড়াই প্ল্যাটফর্মের শেয়ার্ড key ব্যবহার — subscription-এর মতোই মেয়াদভিত্তিক, দৈনিক ব্যবহার-সীমা সহ।</p>
      ${addonExpiryMs ? `<p class="text-[11px] text-slate-400 mb-2">${addonExpired ? 'মেয়াদ ফুরিয়েছিল' : 'বর্তমান মেয়াদ'}: ${esc(formatAiTimestamp(addon.expiresAt))} পর্যন্ত</p>` : ''}
      ${addon ? `<p class="text-[11px] text-slate-400 mb-2">আজকের ব্যবহার: ${addon.dailyUsageCount || 0} / ${addon.dailyCap || 20}</p>` : ''}

      <div class="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">মেয়াদ বাড়ান</label>
          <select id="ai-addon-duration" class="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
            ${AI_ADDON_DURATIONS.map(d => `<option value="${d.days}">${d.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[10px] text-slate-400 mb-1">দৈনিক সীমা</label>
          <input type="number" id="ai-addon-cap" value="${addon?.dailyCap || 20}" min="1" class="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"/>
        </div>
      </div>
      <div class="flex gap-2">
        <button onclick="grantOrExtendAiAddon('${uid}')" class="btn btn-primary btn-sm flex-1">${addonActive ? 'মেয়াদ বাড়ান' : 'সক্রিয় করুন'}</button>
        ${addon && addon.active ? `<button onclick="revokeAiAddon('${uid}')" class="btn btn-danger-outline btn-sm">বন্ধ করুন</button>` : ''}
      </div>
    </div>
  `;
}

async function toggleByokAccess(uid, enable) {
  const confirmMsg = enable
    ? 'এই ইউজারের জন্য BYOK (নিজের API key) ফিচার আজীবনের জন্য আনলক করবেন? এটা সেটাপ-চার্জ গ্রহণের পরই করা উচিত।'
    : 'BYOK অ্যাক্সেস বন্ধ করবেন? ইউজার আর নিজের key দিয়ে AI ব্যবহার করতে পারবেন না (আগে সেভ করা key Firestore-এ থেকে যাবে, কিন্তু ব্যবহার ব্লকড হবে)।';
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById('ai-byok-toggle-btn');
  if (btn) { btn.disabled = true; btn.textContent = '...'; }
  try {
    const data = { byokEnabled: enable };
    if (enable) {
      data.byokEnabledAt = firebase.firestore.FieldValue.serverTimestamp();
      data.byokEnabledBy = APP_STATE.currentUser.email;
    }
    await fbDb.collection('users').doc(uid).collection('config').doc('aiAccess').set(data, { merge: true });
    toast(enable ? 'BYOK আনলক করা হয়েছে।' : 'BYOK বন্ধ করা হয়েছে।', 's');
    await loadAndRenderAiAccessModal(uid);
  } catch (err) {
    toast('ব্যর্থ: ' + err.message, 'e');
    if (btn) btn.disabled = false;
  }
}

async function grantOrExtendAiAddon(uid) {
  const days = parseInt(document.getElementById('ai-addon-duration').value, 10) || 30;
  const dailyCap = parseInt(document.getElementById('ai-addon-cap').value, 10) || 20;
  try {
    const addonDoc = await fbDb.collection('users').doc(uid).collection('config').doc('aiPremiumAddon').get();
    const existing = addonDoc.exists ? addonDoc.data() : null;
    // ✅ admin.js-এর extendSubscription()-এর একই প্যাটার্ন — মেয়াদ চলমান থাকলে
    // তার পর থেকে, ফুরিয়ে থাকলে আজ থেকে যোগ হবে
    const currentExpiryMs = existing && existing.expiresAt && existing.expiresAt.toMillis
      ? Math.max(existing.expiresAt.toMillis(), Date.now())
      : Date.now();
    const newExpiry = firebase.firestore.Timestamp.fromMillis(currentExpiryMs + days * 86400000);

    await fbDb.collection('users').doc(uid).collection('config').doc('aiPremiumAddon').set({
      active: true, expiresAt: newExpiry, dailyCap,
    }, { merge: true });

    toast(`শেয়ার্ড AI ${days} দিনের জন্য সক্রিয়/বর্ধিত করা হয়েছে।`, 's');
    await loadAndRenderAiAccessModal(uid);
  } catch (err) { toast('ব্যর্থ: ' + err.message, 'e'); }
}

async function revokeAiAddon(uid) {
  if (!confirm('শেয়ার্ড AI অ্যাডঅন বন্ধ করবেন?')) return;
  try {
    await fbDb.collection('users').doc(uid).collection('config').doc('aiPremiumAddon').set({ active: false }, { merge: true });
    toast('শেয়ার্ড AI বন্ধ করা হয়েছে।', 's');
    await loadAndRenderAiAccessModal(uid);
  } catch (err) { toast('ব্যর্থ: ' + err.message, 'e'); }
}


// ════════════════════════════════════════════════════════════
// ✅ AI-B addendum: PLATFORM SHARED AI KEY — platformConfig/aiSharedProvider
// এটা প্ল্যাটফর্মের নিজস্ব shared key (tenant-এর BYOK থেকে আলাদা) —
// premium-addon সক্রিয় থাকা ক্লায়েন্টরা এই key দিয়ে AI ব্যবহার করবেন,
// নিজের key ছাড়াই। শুধু admin — কোনো tenant owner/staff এটা দেখতে/
// বদলাতে পারবে না (Firestore rules: platformConfig/{docId} → isAdmin())।
//
// ⚠️ এটা js/staff.js (owner-নিয়ন্ত্রিত নিজস্ব-দোকান-স্টাফ ম্যানেজমেন্ট)
// থেকে ইচ্ছাকৃতভাবে আলাদা রাখা হয়েছে — staff.js প্রতিটা tenant owner
// নিজে দেখতে পান, সেখানে এই platform-level secret বসালে প্রতিটা owner
// এটা দেখে/বদলে ফেলতে পারতেন — গুরুতর নিরাপত্তা-ঝুঁকি।
// ════════════════════════════════════════════════════════════
async function renderPlatformAiKeyPanel() {
  const box = document.getElementById('admin-content');
  if (document.getElementById('platform-ai-key-box')) return;
  const div = document.createElement('div');
  div.id = 'platform-ai-key-box';
  div.className = 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mt-4';
  div.innerHTML = `
    <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
      <i class="fa-solid fa-server text-brand"></i> প্ল্যাটফর্ম শেয়ার্ড AI Key (শুধু Admin)
    </h5>
    <p class="text-[11px] text-slate-400 mb-4">প্রিমিয়াম-অ্যাডঅন সক্রিয় থাকা ক্লায়েন্টরা এই key দিয়ে AI ব্যবহার করবেন — নিজের key ছাড়াই। এই key কোনো tenant owner/staff কখনো দেখতে পারবেন না।</p>
    <div id="platform-ai-key-status" class="text-xs mb-3"><i class="fa-solid fa-spinner fa-spin mr-1"></i>লোড হচ্ছে...</div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
      <div>
        <label class="block text-[11px] text-slate-400 mb-1">Provider</label>
        <select id="pak-provider" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
          <option value="gemini">Google Gemini</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Anthropic Claude</option>
        </select>
      </div>
      <div class="md:col-span-2">
        <label class="block text-[11px] text-slate-400 mb-1">API Key</label>
        <div class="flex gap-2">
          <input type="password" id="pak-apikey" placeholder="নতুন key পেস্ট করুন" class="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
          <button type="button" id="pak-toggle-visibility" class="btn-icon"><i class="fa-solid fa-eye"></i></button>
        </div>
      </div>
    </div>
    <div class="mb-3">
      <label class="block text-[11px] text-slate-400 mb-1">দৈনিক গ্লোবাল সীমা (সব ক্লায়েন্ট মিলিয়ে)</label>
      <input type="number" id="pak-globalcap" min="1" value="500" class="w-full md:w-48 px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
    </div>
    <div class="flex gap-2">
      <button id="pak-save-btn" onclick="savePlatformAiKey()" class="btn btn-primary">সংরক্ষণ করুন</button>
      <button id="pak-delete-btn" onclick="deletePlatformAiKey()" class="btn btn-danger-outline">মুছে ফেলুন</button>
    </div>
  `;
  box.appendChild(div);
  await loadPlatformAiKeyStatus();

  document.getElementById('pak-toggle-visibility').addEventListener('click', () => {
    const inp = document.getElementById('pak-apikey');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });
}

async function loadPlatformAiKeyStatus() {
  const statusEl = document.getElementById('platform-ai-key-status');
  if (!statusEl) return;
  try {
    const doc = await fbDb.collection('platformConfig').doc('aiSharedProvider').get();
    if (!doc.exists || !doc.data().apiKey) {
      statusEl.innerHTML = `<span class="text-slate-400"><i class="fa-solid fa-circle-xmark mr-1"></i>এখনো কনফিগার করা হয়নি</span>`;
      return;
    }
    const d = doc.data();
    document.getElementById('pak-provider').value = d.provider || 'gemini';
    document.getElementById('pak-globalcap').value = d.dailyGlobalCap || 500;
    statusEl.innerHTML = `<span class="text-emerald-600"><i class="fa-solid fa-circle-check mr-1"></i>সক্রিয় — Provider: ${esc(d.provider || '—')}, Key: ${esc(maskKey(d.apiKey))}</span>`;
  } catch (err) {
    statusEl.innerHTML = `<span class="text-red-500">লোড ব্যর্থ: ${esc(err.message)}</span>`;
  }
}

async function savePlatformAiKey() {
  const provider = document.getElementById('pak-provider').value;
  const apiKey = document.getElementById('pak-apikey').value.trim();
  const dailyGlobalCap = parseInt(document.getElementById('pak-globalcap').value, 10) || 500;
  if (!apiKey) { toast('নতুন key দিন।', 'w'); return; }

  const btn = document.getElementById('pak-save-btn');
  btn.disabled = true; btn.textContent = 'সংরক্ষণ হচ্ছে...';
  try {
    await fbDb.collection('platformConfig').doc('aiSharedProvider').set({
      provider, apiKey, dailyGlobalCap,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: APP_STATE.currentUser.email,
    }, { merge: true });
    toast('প্ল্যাটফর্ম শেয়ার্ড AI key সংরক্ষিত হয়েছে।', 's');
    document.getElementById('pak-apikey').value = '';
    await loadPlatformAiKeyStatus();
  } catch (err) {
    toast('ব্যর্থ: ' + err.message, 'e');
  } finally {
    btn.disabled = false; btn.textContent = 'সংরক্ষণ করুন';
  }
}

async function deletePlatformAiKey() {
  if (!confirm('প্ল্যাটফর্ম শেয়ার্ড AI key মুছে ফেলবেন? এটা মুছলে premium-addon থাকা সব ক্লায়েন্টের শেয়ার্ড-AI সাথে সাথে বন্ধ হয়ে যাবে।')) return;
  try {
    await fbDb.collection('platformConfig').doc('aiSharedProvider').delete();
    toast('মুছে ফেলা হয়েছে।', 's');
    await loadPlatformAiKeyStatus();
  } catch (err) { toast('ব্যর্থ: ' + err.message, 'e'); }
}
