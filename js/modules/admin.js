'use strict';

let adminUsersUnsub = null;
const SUB_DURATIONS = [{ label: '১ মাস', days: 30 }, { label: '৩ মাস', days: 90 }, { label: '৬ মাস', days: 180 }, { label: '১ বছর', days: 365 }];

function renderAdminModule() {
  const c = document.getElementById('admin-content');
  if (!c) return;
  if (!APP_STATE.isAdmin) {
    c.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-400"><i class="fa-solid fa-lock text-2xl mb-3 opacity-40"></i><p class="text-sm">এই পেজ শুধু মালিকের জন্য।</p></div>`;
    return;
  }
  APP_STATE.adminTab = APP_STATE.adminTab || 'pending';
  c.innerHTML = `
    <div class="flex gap-2 mb-4">
      ${['pending', 'approved', 'revoked', 'all'].map(t => `<button onclick="setAdminTab('${t}')" id="admin-tab-${t}" class="px-4 py-1.5 rounded-lg text-xs font-semibold border"></button>`).join('')}
    </div>
    <div id="admin-user-list" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>ইউজার লোড হচ্ছে...</div>
    </div>`;
  updateAdminTabsUI();

  if (adminUsersUnsub) adminUsersUnsub();
  adminUsersUnsub = fbDb.collection('users').orderBy('createdAt', 'desc').onSnapshot((snap) => {
    APP_STATE.adminUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    renderAdminUserList();
  }, (err) => { document.getElementById('admin-user-list').innerHTML = `<div class="px-5 py-6 text-center text-red-500 text-xs">লোড ব্যর্থ: ${esc(err.message)}</div>`; });
}

function setAdminTab(t) { APP_STATE.adminTab = t; updateAdminTabsUI(); renderAdminUserList(); }

function updateAdminTabsUI() {
  const labels = { pending: 'পেন্ডিং', approved: 'Approved', revoked: 'Revoked', all: 'সব' };
  Object.keys(labels).forEach(k => {
    const btn = document.getElementById('admin-tab-' + k);
    if (!btn) return;
    btn.textContent = labels[k];
    const active = APP_STATE.adminTab === k;
    btn.className = `px-4 py-1.5 rounded-lg text-xs font-semibold border transition ${active ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'}`;
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
    if (es === 'approved') {
      return `<div class="flex items-center gap-1 justify-center">
        <select id="dur-${u.uid}" class="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700">${durOpts}</select>
        <button onclick="extendSubscription('${u.uid}')" class="text-brand hover:underline text-xs"><i class="fa-solid fa-arrows-rotate mr-1"></i>Extend</button>
        <button onclick="setUserStatus('${u.uid}','revoked')" class="text-red-500 hover:underline text-xs ml-2"><i class="fa-solid fa-ban"></i></button>
      </div>`;
    }
    return `<div class="flex items-center gap-1 justify-center">
      <select id="dur-${u.uid}" class="text-[11px] border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700">${durOpts}</select>
      <button onclick="approveWithDuration('${u.uid}')" class="text-emerald-600 hover:underline text-xs"><i class="fa-solid fa-check mr-1"></i>Approve</button>
      ${es !== 'revoked' ? `<button onclick="setUserStatus('${u.uid}','revoked')" class="text-red-500 hover:underline text-xs ml-2"><i class="fa-solid fa-ban"></i></button>` : ''}
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
    <textarea id="gm-csv-input" rows="6" placeholder="brand,generic,doseForm,strength,manufacturer,category&#10;Napa,Paracetamol,ট্যাবলেট,500mg,Beximco,Analgesic" class="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white mb-2"></textarea>
    <div id="gm-upload-status" class="text-xs text-slate-500 mb-2"></div>
    <button onclick="uploadGlobalMedCsv()" class="bg-brand hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">আপলোড করুন</button>
  `;
  box.appendChild(div);
}

async function uploadGlobalMedCsv() {
  const raw = document.getElementById('gm-csv-input').value.trim();
  if (!raw) return toast('CSV পেস্ট করুন।', 'w');
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = (vals[i] || '').trim());
    return obj;
  }).filter(r => r.brand);

  if (!rows.length) return toast('কোনো বৈধ row পাওয়া যায়নি।', 'w');
  document.getElementById('gm-upload-status').textContent = `${rows.length} টি এন্ট্রি আপলোড হচ্ছে...`;
  const res = await apiBulkUploadGlobalMedicines(rows);
  if (res.success) {
    toast(`${res.count} টি ওষুধ Global Master-এ যোগ হয়েছে।`, 's');
    document.getElementById('gm-csv-input').value = '';
    document.getElementById('gm-upload-status').textContent = '';
  } else {
    document.getElementById('gm-upload-status').textContent = 'ব্যর্থ: ' + res.message;
  }
}
