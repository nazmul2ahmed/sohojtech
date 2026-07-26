'use strict';

// ════════════════════════════════════════════════════════════
// REVIEW/REFERRAL PROMPT — growth-polish.md টায়ার ৩ আইটেম ১১
// ৫০তম সেল বা ৩০ দিন ব্যবহারের পর ট্রিগার — ভালো লাগলে about/referral-এ,
// খারাপ হলে সরাসরি WhatsApp ফিডব্যাক। একবার dismiss করলে Firestore
// ফ্ল্যাগে persist (onboardingComplete-এর একই প্যাটার্ন)।
// ════════════════════════════════════════════════════════════

const REVIEW_PROMPT_DELAY_MS = 4 * 60 * 1000; // ৪ মিনিট — subscription-promo-র থেকে আলাদা টাইমিং
const REVIEW_PROMPT_SESSION_KEY = 'reviewPromptShownThisSession';

let _reviewPromptTimer = null;

function daysSincePharmacyCreated() {
  const profile = APP_STATE.currentUser;
  if (!profile || !profile.createdAt || !profile.createdAt.toDate) return 0;
  return Math.floor((Date.now() - profile.createdAt.toDate().getTime()) / 86400000);
}

function maybeScheduleReviewPrompt() {
  if (APP_STATE.isStaffMember) return; // শুধু owner-কে জিজ্ঞেস করা হবে
  if (APP_STATE.reviewPromptDismissed) return;
  if (sessionStorage.getItem(REVIEW_PROMPT_SESSION_KEY)) return;
  if (_reviewPromptTimer) return;

  const info = APP_STATE.subscriptionStatusInfo;
  if (info && ['revoked', 'trial-expired', 'subscription-expired'].includes(info.mode)) return;

  const salesCount = APP_STATE.sales.length;
  const daysUsed = daysSincePharmacyCreated();
  if (salesCount < 50 && daysUsed < 30) return; // শর্ত এখনো পূরণ হয়নি

  _reviewPromptTimer = setTimeout(() => {
    if (document.getElementById('review-prompt-modal')) return;
    if (APP_STATE.modalStack && APP_STATE.modalStack.length) return; // অন্য মডাল খোলা থাকলে এই সেশনে স্কিপ
    sessionStorage.setItem(REVIEW_PROMPT_SESSION_KEY, '1');
    openReviewPromptModal();
  }, REVIEW_PROMPT_DELAY_MS);
}

function dismissReviewPromptPermanently() {
  APP_STATE.reviewPromptDismissed = true;
  apiSaveSettings({ reviewPromptDismissed: true }).catch(() => {});
}

function openReviewPromptModal() {
  document.getElementById('review-prompt-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'review-prompt-modal';
  modal.className = 'fixed inset-0 z-[9996] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
      <div class="text-4xl mb-3">🙏</div>
      <h3 class="text-lg font-extrabold text-slate-800 dark:text-white mb-1">অ্যাপটা কেমন লাগছে?</h3>
      <p class="text-xs text-slate-400 mb-5">আপনার মতামত আমাদের আরও ভালো করতে সাহায্য করবে।</p>
      <div class="flex flex-col gap-2">
        <button id="review-good-btn" class="btn btn-success">😊 ভালো লাগছে</button>
        <button id="review-bad-btn" class="btn btn-secondary">😕 উন্নতির জায়গা আছে</button>
        <button id="review-skip-btn" class="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline mt-2">পরে জিজ্ঞেস করবেন না</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  openAppModal('review-prompt-modal', () => document.getElementById('review-prompt-modal')?.remove());

  document.getElementById('review-good-btn').addEventListener('click', () => {
    dismissReviewPromptPermanently();
    closeAppModal();
    toast('ধন্যবাদ! পরিচিত কাউকে জানাতে চাইলে "আমাদের সম্পর্কে" পেজে যান।', 's');
    goTab('about');
  });

  document.getElementById('review-bad-btn').addEventListener('click', () => {
    dismissReviewPromptPermanently();
    closeAppModal();
    const phone = (APP_CONFIG.SUPPORT_PHONE || '').replace(/[^0-9]/g, '');
    const msg = encodeURIComponent('আসসালামু আলাইকুম, SohojTech Pharmacy ব্যবহার করে কিছু ফিডব্যাক দিতে চাই।');
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener');
  });

  document.getElementById('review-skip-btn').addEventListener('click', () => {
    dismissReviewPromptPermanently();
    closeAppModal();
  });
}
