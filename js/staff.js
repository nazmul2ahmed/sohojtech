'use strict';

// ════════════════════════════════════════════════════════════
// STAFF MANAGEMENT MODULE (Track A - ধাপ A.2) — Owner-only UI
// ইনভাইট পাঠানো, pending invite তালিকা, active/disabled staff তালিকা +
// role change/disable/remove। Accept-ফ্লো (staff নিজে Google দিয়ে লগইন
// করে roster-এ self-register করা) এখনো বাস্তবায়িত হয়নি (ধাপ A.3) —
// তাই এই মুহূর্তে ইনভাইট পাঠানো যাবে, কিন্তু staff লগইন করলেও এখনো
// আগের মতোই নিজস্ব (খালি) ট্রায়াল-অ্যাকাউন্ট তৈরি হবে, roster-এ যোগ
// হবে না। এটা A.3-এ ঠিক হবে।
// ════════════════════════════════════════════════════════════

let staffListUnsub = null;
let staffInvitesUnsub = null;

const STAFF_ROLE_LABELS = { manager: 'ম্যানেজার', cashier: 'ক্যাশিয়ার' };

function renderStaffModule() {
  const c = document.getElementById('staff-content');
  if (!c) return;

  APP_STATE.staffList = APP_STATE.staffList || [];
  APP_STATE.staffInvites = APP_STATE.staffInvites || [];

  c.innerHTML = `
    <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs rounded-lg px-4 py-3 mb-4">
      <i class="fa-solid fa-circle-info mr-1"></i> স্টাফ ইনভাইট গ্রহণ করতে তাদের নিজের Google অ্যাকাউন্ট থাকতে হবে, এবং
      সেই অ্যাকাউন্ট দিয়ে অ্যাপে সাইন-ইন করলেই স্বয়ংক্রিয়ভাবে আপনার দোকানের স্টাফ হিসেবে যুক্ত হয়ে যাবে
      <span class="font-semibold">(এই স্বয়ংক্রিয় সংযুক্তি এখনো বাস্তবায়িত হয়নি — পরের ধাপে আসছে)</span>।
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
        <i class="fa-solid fa-user-plus text-brand"></i> নতুন স্টাফ ইনভাইট করুন
      </h5>
      <div id="staff-invite-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="md:col-span-2">
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Google ইমেইল</label>
          <input type="email" id="staff-invite-email" placeholder="staff@gmail.com"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">Role</label>
          <select id="staff-invite-role" class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white">
            <option value="manager">ম্যানেজার — স্টাফ-ম্যানেজমেন্ট/রিসেট ছাড়া প্রায় সবকিছু</option>
            <option value="cashier">ক্যাশিয়ার — শুধু বিক্রয়/ক্রয়/রিটার্ন</option>
          </select>
        </div>
      </div>
      <button id="staff-invite-btn" onclick="submitStaffInvite()" class="mt-3 bg-brand hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded-lg text-sm">
        <i class="fa-solid fa-paper-plane mr-1"></i> ইনভাইট পাঠান
      </button>
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden mb-4">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-hourglass-half text-amber-500 mr-1"></i> পেন্ডিং ইনভাইট</h5>
      </div>
      <div id="staff-invites-list">
        <div class="px-5 py-6 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>লোড হচ্ছে...</div>
      </div>
    </div>

    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div class="px-5 py-3 border-b border-slate-200 dark:border-slate-700">
        <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200"><i class="fa-solid fa-users-gear text-brand mr-1"></i> সক্রিয় স্টাফ</h5>
      </div>
      <div id="staff-roster-list">
        <div class="px-5 py-6 text-center text-slate-400 text-sm"><i class="fa-solid fa-spinner fa-spin mr-2"></i>লোড হচ্ছে...</div>
      </div>
    </div>
  `;

  wireStaffListeners();
}

function wireStaffListeners() {
  const uid = APP_STATE.currentUser.uid;

  if (staffInvitesUnsub) staffInvitesUnsub();
  staffInvitesUnsub = fbDb.collection('users').doc(uid).collection('staffInvites')
    .onSnapshot((snap) => {
      APP_STATE.staffInvites = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderStaffInvitesList();
    }, (err) => {
      const box = document.getElementById('staff-invites-list');
      if (box) box.innerHTML = `<div class="px-5 py-4 text-center text-red-500 text-xs">লোড ব্যর্থ: ${esc(err.message)}</div>`;
    });

  if (staffListUnsub) staffListUnsub();
  staffListUnsub = fbDb.collection('users').doc(uid).collection('staff')
    .onSnapshot((snap) => {
      APP_STATE.staffList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderStaffRosterList();
    }, (err) => {
      const box = document.getElementById('staff-roster-list');
      if (box) box.innerHTML = `<div class="px-5 py-4 text-center text-red-500 text-xs">লোড ব্যর্থ: ${esc(err.message)}</div>`;
    });
}

function renderStaffInvitesList() {
  const box = document.getElementById('staff-invites-list');
  if (!box) return;
  const pending = APP_STATE.staffInvites.filter(i => i.status === 'pending');
  if (!pending.length) {
    box.innerHTML = `<div class="px-5 py-6 text-center text-slate-400 text-sm">কোনো পেন্ডিং ইনভাইট নেই।</div>`;
    return;
  }
  box.innerHTML = pending.map(inv => `
    <div class="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 flex justify-between items-center gap-2">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(inv.email)}</div>
        <div class="text-[11px] text-slate-400">${esc(STAFF_ROLE_LABELS[inv.role] || inv.role)}</div>
      </div>
      <button onclick="cancelStaffInvite('${esc(inv.id)}')" class="text-red-500 hover:underline text-xs whitespace-nowrap">
        <i class="fa-solid fa-xmark mr-1"></i>বাতিল করুন
      </button>
    </div>`).join('');
}

function renderStaffRosterList() {
  const box = document.getElementById('staff-roster-list');
  if (!box) return;
  if (!APP_STATE.staffList.length) {
    box.innerHTML = `<div class="px-5 py-8 text-center text-slate-400 text-sm"><i class="fa-solid fa-user-group text-2xl opacity-30 mb-2 block"></i>এখনো কোনো স্টাফ যোগ হয়নি।</div>`;
    return;
  }
  box.innerHTML = APP_STATE.staffList.map(s => `
    <div class="px-5 py-3 border-t border-slate-100 dark:border-slate-700/50 flex flex-wrap justify-between items-center gap-2">
      <div class="min-w-0">
        <div class="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">${esc(s.displayName || s.email)}</div>
        <div class="text-[11px] text-slate-400">${esc(s.email)}</div>
      </div>
      <div class="flex items-center gap-2 flex-shrink-0">
        <select onchange="changeStaffRole('${esc(s.id)}', this.value)" class="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200">
          <option value="manager" ${s.role === 'manager' ? 'selected' : ''}>ম্যানেজার</option>
          <option value="cashier" ${s.role === 'cashier' ? 'selected' : ''}>ক্যাশিয়ার</option>
        </select>
        ${s.status === 'active'
          ? `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">সক্রিয়</span>
             <button onclick="toggleStaffStatus('${esc(s.id)}','disabled')" class="text-amber-600 hover:underline text-xs whitespace-nowrap">নিষ্ক্রিয় করুন</button>`
          : `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">নিষ্ক্রিয়</span>
             <button onclick="toggleStaffStatus('${esc(s.id)}','active')" class="text-emerald-600 hover:underline text-xs whitespace-nowrap">সক্রিয় করুন</button>`}
        <button onclick="removeStaffConfirm('${esc(s.id)}','${esc((s.displayName || s.email || '').replace(/'/g, ''))}')" class="text-red-500 hover:underline text-xs"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

async function submitStaffInvite() {
  const errEl = document.getElementById('staff-invite-error');
  errEl.classList.add('hidden');
  const email = document.getElementById('staff-invite-email').value;
  const role = document.getElementById('staff-invite-role').value;

  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    errEl.textContent = 'সঠিক ইমেইল ঠিকানা দিন।';
    errEl.classList.remove('hidden');
    return;
  }
  const alreadyStaff = APP_STATE.staffList.find(s => s.email === cleanEmail);
  if (alreadyStaff) {
    errEl.textContent = 'এই ইমেইল ইতিমধ্যে স্টাফ তালিকায় আছে।';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('staff-invite-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> পাঠানো হচ্ছে...';

  try {
    const res = await apiInviteStaff(cleanEmail, role);
    if (!res.success) {
      errEl.textContent = res.message;
      errEl.classList.remove('hidden');
    } else {
      toast(res.message, 's');
      document.getElementById('staff-invite-email').value = '';
    }
  } catch (err) {
    showFatalError('ইনভাইট পাঠাতে সমস্যা:\n' + humanizeError(err), err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane mr-1"></i> ইনভাইট পাঠান';
  }
}

async function cancelStaffInvite(email) {
  if (!confirm(`"${email}"-এর ইনভাইট বাতিল করবেন?`)) return;
  try {
    const res = await apiCancelInvite(email);
    if (!res.success) return toast(res.message, 'w');
    toast(res.message, 's');
  } catch (err) { showFatalError('ইনভাইট বাতিল করতে সমস্যা:\n' + humanizeError(err), err); }
}

async function changeStaffRole(staffUid, newRole) {
  try {
    const res = await apiUpdateStaffRole(staffUid, newRole);
    if (!res.success) { toast(res.message, 'w'); renderStaffRosterList(); return; }
    toast(res.message, 's');
  } catch (err) { showFatalError('Role পরিবর্তনে সমস্যা:\n' + humanizeError(err), err); }
}

async function toggleStaffStatus(staffUid, newStatus) {
  try {
    const res = await apiSetStaffStatus(staffUid, newStatus);
    if (!res.success) return toast(res.message, 'w');
    toast(res.message, 's');
  } catch (err) { showFatalError('স্ট্যাটাস পরিবর্তনে সমস্যা:\n' + humanizeError(err), err); }
}

async function removeStaffConfirm(staffUid, label) {
  if (!confirm(`"${label}"-কে স্টাফ তালিকা থেকে সরিয়ে দেবেন? এর ফলে তার অ্যাক্সেস সাথে সাথে বন্ধ হয়ে যাবে।`)) return;
  try {
    const res = await apiRemoveStaff(staffUid);
    if (!res.success) return toast(res.message, 'w');
    toast(res.message, 's');
  } catch (err) { showFatalError('স্টাফ সরাতে সমস্যা:\n' + humanizeError(err), err); }
}
