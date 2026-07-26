'use strict';

// ════════════════════════════════════════════════════════════
// ONBOARDING MODULE — growth-polish.md টায়ার ২ আইটেম ৬
// প্রথম-লগইনে (শুধু owner, staff না) স্বয়ংক্রিয়ভাবে ফার্মেসি নাম/
// মালিক/ফোন জিজ্ঞেস করা মডাল। বিদ্যমান apiSaveSettings() reuse করা
// হয়েছে — আলাদা কোনো নতুন Firestore write-path তৈরি হয়নি।
// স্কিপ/বাইরে-বন্ধ করলে flag সেট হয় না — পরের লগইনে আবার দেখাবে।
// ════════════════════════════════════════════════════════════

function maybeShowOnboardingModal() {
  if (APP_STATE.isStaffMember) return false; // staff-এর নিজের ফার্মেসি সেটআপ করার কিছু নেই
  if (APP_STATE.onboardingComplete) return false;

  const hasExistingData = APP_STATE.pharmacyName && APP_STATE.pharmacyName !== 'আমার ফার্মেসি';
  if (hasExistingData) {
    apiSaveSettings({ onboardingComplete: true }).catch(() => {});
    APP_STATE.onboardingComplete = true;
    return false;
  }

  openOnboardingModal();
  return true;
}

function openOnboardingModal() {
  if (document.getElementById('onboarding-modal')) return; // ডাবল-ওপেন গার্ড

  const modal = document.createElement('div');
  modal.id = 'onboarding-modal';
  modal.className = 'fixed inset-0 z-[9996] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
      <div class="w-14 h-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
        <i class="fa-solid fa-store text-2xl text-brand"></i>
      </div>
      <h3 class="text-lg font-extrabold text-slate-800 dark:text-white mb-1">স্বাগতম! আপনার ফার্মেসির তথ্য দিন</h3>
      <p class="text-xs text-slate-400 mb-4">এই তথ্য পরে Settings থেকে যেকোনো সময় বদলাতে পারবেন।</p>
      <div id="onb-error" class="hidden bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs rounded-lg px-3 py-2 mb-3"></div>
      <div class="space-y-3 mb-5">
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ফার্মেসির নাম <span class="text-red-500">*</span></label>
          <input type="text" id="onb-name" placeholder="যেমন: আল-শিফা ফার্মেসি"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-brand"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">মালিকের নাম</label>
          <input type="text" id="onb-owner" placeholder="ঐচ্ছিক"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase mb-1">ফোন নম্বর</label>
          <input type="tel" id="onb-phone" placeholder="ঐচ্ছিক"
            class="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-white"/>
        </div>
      </div>
      <button id="onb-save-btn" onclick="submitOnboardingForm()" class="btn btn-primary btn-block">শুরু করুন</button>
      <button onclick="closeAppModal()" class="w-full mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">পরে করব</button>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('onboarding-modal', () => document.getElementById('onboarding-modal')?.remove());
  document.getElementById('onb-name').focus();
}

async function submitOnboardingForm() {
  if (guardReadOnly()) return; // ✅ defensive — settings.js-এর নিজস্ব ফাংশনে এই গার্ড নেই (আলাদা পরিচিত ইস্যু, এখানে ছোঁয়া হয়নি)

  const errEl = document.getElementById('onb-error');
  errEl.classList.add('hidden');

  const name = document.getElementById('onb-name').value.trim();
  if (!name) {
    errEl.textContent = 'ফার্মেসির নাম দিন।';
    errEl.classList.remove('hidden');
    return;
  }

  const data = {
    pharmacyName: name,
    ownerName: document.getElementById('onb-owner').value.trim(),
    phone: document.getElementById('onb-phone').value.trim(),
    onboardingComplete: true,
  };

  const btn = document.getElementById('onb-save-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> সংরক্ষণ হচ্ছে...';

  try {
    const res = await apiSaveSettings(data);
    if (!res.success) {
      errEl.textContent = res.message;
      errEl.classList.remove('hidden');
      btn.disabled = false;
      btn.innerHTML = 'শুরু করুন';
      return;
    }

    Object.assign(APP_STATE, data);
    setText('sidebar-pharma-name', APP_STATE.pharmacyName);
    toast(`স্বাগতম, ${APP_STATE.pharmacyName}!`, 's');
    closeAppModal(); // ✅ history-back প্যাটার্ন — modalStack-এর closeFn কল করে DOM থেকে সরাবে
    setTimeout(() => { if (typeof startGuidedTour === 'function') startGuidedTour(); }, 300); // ✅ নতুন — একই সেশনে অটো-ট্যুর
  } catch (err) {
    showFatalError('তথ্য সংরক্ষণে সমস্যা:\n' + humanizeError(err), err);
    btn.disabled = false;
    btn.innerHTML = 'শুরু করুন';
  }
}
