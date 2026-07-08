'use strict';

// ════════════════════════════════════════════════════════════
// ADMIN PANEL — শুধু ADMIN_EMAIL-এর জন্য দৃশ্যমান।
// Firestore users কালেকশন রিয়েল-টাইম শোনে, Approve/Revoke করে।
// ════════════════════════════════════════════════════════════

let adminUsersUnsub = null;

function renderAdminModule() {
  const c = document.getElementById('admin-content');
  if (!c) return;

  if (!APP_STATE.isAdmin) {
    c.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-xl p-8 text-center text-slate-400">
      <i class="fa-solid fa-lock text-2xl mb-3 opacity-40"></i><p class="text-sm">এই পেজ শুধু মালিকের জন্য।</p>
    </div>`;
    return;
  }

  c.innerHTML = `<div id="admin-user-list" class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
    <div class="px-5 py-10 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>ইউজার লোড হচ্ছে...</div>
  </div>`;

  if (adminUsersUnsub) adminUsersUnsub();

  adminUsersUnsub = fbDb.collection('users').orderBy('createdAt', 'desc').onSnapshot((snap) => {
    renderAdminUserList(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
  }, (err) => {
    document.getElementById('admin-user-list').innerHTML = `<div class="px-5 py-6 text-center text-red-500 text-xs">লোড ব্যর্থ: ${esc(err.message)}</div>`;
  });
}

function renderAdminUserList(users) {
  const el = document.getElementById('admin-user-list');
  if (!el) return;

  const badge = (u) => {
    if (u.status === 'approved') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Approved</span>`;
    if (u.status === 'revoked') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Revoked</span>`;
    const days = trialDaysLeft(u);
    return days > 0
      ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Trial — ${days} দিন বাকি</span>`
      : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Trial শেষ — অনুমোদন প্রয়োজন</span>`;
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
        ${users.map(u => `
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
          <td class="px-4 py-3 text-center whitespace-nowrap">
            ${u.role === 'owner' ? '<span class="text-[11px] text-slate-400">—</span>' : `
              ${u.status !== 'approved' ? `<button onclick="setUserStatus('${u.uid}','approved')" class="text-emerald-600 hover:underline text-xs mr-3"><i class="fa-solid fa-check mr-1"></i>Approve</button>` : ''}
              ${u.status !== 'revoked' ? `<button onclick="setUserStatus('${u.uid}','revoked')" class="text-red-500 hover:underline text-xs"><i class="fa-solid fa-ban mr-1"></i>Revoke</button>` : ''}
            `}
          </td>
        </tr>`).join('')}
      </tbody>
    </table>
    </div>`;
}

function setUserStatus(uid, status) {
  fbDb.collection('users').doc(uid).update({ status }).then(() => {
    toast(status === 'approved' ? 'ইউজার Approve করা হয়েছে।' : 'ইউজার Revoke করা হয়েছে।', 's');
  }).catch((err) => toast('ব্যর্থ: ' + err.message, 'e'));
}