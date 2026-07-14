'use strict';

// ════════════════════════════════════════════════════════════
// ADS / AFFILIATE MODULE (boilerplate — ধাপ ৮)
// এখনো কোনো actual ফিচার লজিক নেই। এই ফাইলের উদ্দেশ্য শুধু কাঠামো
// প্রতিষ্ঠা করা — namespace আলাদা রাখা, mutation-এর একমাত্র পাবলিক
// পথ এই ফাইলের ভেতরে সীমাবদ্ধ রাখা। অন্য কোনো মডিউল (pos.js,
// customers.js ইত্যাদি) থেকে APP_STATE.ads সরাসরি স্পর্শ করা উচিত না।
// ════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────
// ✅ PUBLIC MUTATORS — APP_STATE.ads বদলানোর একমাত্র অনুমোদিত পথ
// (customers.js-এর applyCustomerDueChange() প্যাটার্ন অনুসরণ করে)
// ────────────────────────────────────────────────────────────
function setAdsEnabled(flag) {
  APP_STATE.ads.enabled = !!flag;
}

function addAdCampaign(campaign) {
  // TODO (ভবিষ্যত ধাপ): validation + apiXxx() Firestore কল
  APP_STATE.ads.campaigns.push(campaign);
}

function removeAdCampaign(campaignId) {
  APP_STATE.ads.campaigns = APP_STATE.ads.campaigns.filter(c => c.id !== campaignId);
}

function updateAdsSettings(partialSettings) {
  Object.assign(APP_STATE.ads.settings, partialSettings);
}

// ────────────────────────────────────────────────────────────
// RENDER — এখন শুধু placeholder। ভবিষ্যতে আসল UI এখানে বসবে।
// ────────────────────────────────────────────────────────────
function renderAdsModule() {
  const c = document.getElementById('ads-content');
  if (!c) return;

  c.innerHTML = `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                rounded-xl p-8 text-center text-slate-400 dark:text-slate-500">
      <i class="fa-solid fa-bullhorn text-2xl mb-3 opacity-40"></i>
      <p class="text-sm">B2B বিজ্ঞাপন/অ্যাফিলিয়েট ফিচার এখনো তৈরি হচ্ছে।</p>
    </div>
  `;
}