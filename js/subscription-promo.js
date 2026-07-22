'use strict';

// ════════════════════════════════════════════════════════════
// SUBSCRIPTION PROMO MODULE (priority-fixes.md-এর বাইরে — আলাদা ট্র্যাকিং)
// ১) ট্রায়াল ইউজারদের প্রতি সেশনে একবার সাবস্ক্রিপশন প্ল্যান দেখানো
// ২) Approved ইউজার যাদের সাবস্ক্রিপশন ≤৩ দিনে শেষ হচ্ছে, তাদের রিনিউ অনুরোধ
// কোনো payment gateway এখনো নেই — CTA শুধু WhatsApp/Call-এ পাঠায়,
// অ্যাক্টিভেশন এখনো ম্যানুয়াল (admin.js-এর approveWithDuration())।
// ════════════════════════════════════════════════════════════

const SUBSCRIPTION_PLANS = [
  { id: '1m', label: '১ মাস',  months: 1,  price: 399,  badge: null },
  { id: '3m', label: '৩ মাস',  months: 3,  price: 1099, badge: null },
  { id: '6m', label: '৬ মাস',  months: 6,  price: 2099, badge: 'সবচেয়ে জনপ্রিয়' },
  { id: '1y', label: '১ বছর',  months: 12, price: 3999, badge: 'সর্বোচ্চ সাশ্রয়ী' },
];

const SUB_PROMO_DELAY_MS = 3 * 60 * 1000; // ✅ "কয়েক মিনিট পর" — 3 মিনিট, প্রয়োজনে বদলান
const SUB_PROMO_RENEWAL_THRESHOLD_DAYS = 3; // ✅ approved ইউজারের auto-popup এই দিন-সীমার মধ্যে ফায়ার করবে

let _subPromoTimer = null; // ডুপ্লিকেট শিডিউল ঠেকাতে (একাধিকবার onSnapshot ফায়ার হলেও)

// ────────────────────────────────────────────────────────────
// ইকোনমিক্স — মাসিক হার + বেসলাইন (১-মাস প্ল্যান) তুলনায় সাশ্রয়%
// ────────────────────────────────────────────────────────────
function computePlanEconomics(plan) {
  const perMonth = Math.round(plan.price / plan.months);
  const baseline = SUBSCRIPTION_PLANS[0].price * plan.months;
  const savePercent = plan.months === 1 ? 0 : Math.round((1 - plan.price / baseline) * 100);
  return { perMonth, savePercent };
}

// ────────────────────────────────────────────────────────────
// TRIGGER — auth.js-এর unlockApp() থেকে statusInfo সহ কল হয়
// ────────────────────────────────────────────────────────────
function maybeScheduleSubscriptionPromo(statusInfo) {
  if (sessionStorage.getItem('subPromoShownThisSession')) return;
  if (_subPromoTimer) return; // ইতিমধ্যে এই সেশনে শিডিউল হয়ে গেছে

  let context = null, daysLeft = null;
  if (statusInfo.mode === 'trial') {
    context = 'trial';
  } else if (statusInfo.mode === 'approved' && statusInfo.subDaysLeft != null && statusInfo.subDaysLeft <= SUB_PROMO_RENEWAL_THRESHOLD_DAYS) {
    context = 'renewal';
    daysLeft = statusInfo.subDaysLeft;
  }
  if (!context) return;

  _subPromoTimer = setTimeout(() => {
    if (document.getElementById('sub-promo-modal')) return; // অন্য কোনোভাবে ইতিমধ্যে খোলা থাকলে স্কিপ
    sessionStorage.setItem('subPromoShownThisSession', '1');
    openSubscriptionPromo(context, { daysLeft });
  }, SUB_PROMO_DELAY_MS);
}

// ────────────────────────────────────────────────────────────
// MODAL — trial banner CTA, renewal banner CTA, এবং auto-trigger — সবাই এটা কল করে
// ────────────────────────────────────────────────────────────
function openSubscriptionPromo(context = 'trial', opts = {}) {
  document.getElementById('sub-promo-modal')?.remove();

  const isRenewal = context === 'renewal';
  const title = isRenewal ? 'আপনার সাবস্ক্রিপশন শীঘ্রই শেষ হচ্ছে' : 'সীমাহীন ব্যবহারের জন্য সাবস্ক্রাইব করুন';
  const subtitle = isRenewal
    ? `আর ${opts.daysLeft ?? ''} দিনে মেয়াদ শেষ — এখনই রিনিউ করে নিরবচ্ছিন্ন সেবা নিশ্চিত করুন।`
    : 'ট্রায়াল শেষ হওয়ার আগেই একটা প্ল্যান বেছে নিন, কোনো বাধা ছাড়াই ব্যবহার চালিয়ে যান।';

  const modal = document.createElement('div');
  modal.id = 'sub-promo-modal';
  modal.className = 'fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4';
  modal.innerHTML = `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
      <div class="flex items-start justify-between mb-1">
        <div class="min-w-0 pr-3">
          <h3 class="text-lg font-extrabold text-slate-800 dark:text-white">${esc(title)}</h3>
          <p class="text-xs text-slate-400 mt-1">${esc(subtitle)}</p>
        </div>
        <button onclick="closeSubscriptionPromo()" class="text-slate-400 hover:text-red-500 flex-shrink-0">
          <i class="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        ${SUBSCRIPTION_PLANS.map(plan => renderPlanCard(plan, isRenewal)).join('')}
      </div>

      <p class="text-[11px] text-slate-400 text-center mt-4">
        <i class="fa-solid fa-circle-info mr-1"></i> এখনো অনলাইন পেমেন্ট সিস্টেম নেই — WhatsApp বা কলে যোগাযোগ করলে ম্যানুয়ালি অ্যাক্টিভেট করে দেওয়া হবে।
      </p>
      <button onclick="closeSubscriptionPromo()" class="w-full mt-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">পরে দেখব</button>
    </div>`;
    document.body.appendChild(modal);
    openAppModal('sub-promo-modal', () => document.getElementById('sub-promo-modal')?.remove());
}

function renderPlanCard(plan, isRenewal) {
  const { perMonth, savePercent } = computePlanEconomics(plan);
  const phone = (APP_CONFIG.SUPPORT_PHONE || '').replace(/[^0-9]/g, '');
  const waMsg = encodeURIComponent(
    `আসসালামু আলাইকুম, আমি SohojTech Pharmacy-এর "${plan.label}" প্ল্যান ${isRenewal ? 'রিনিউ' : 'সাবস্ক্রাইব'} করতে চাই।`
  );
  const waLink = `https://wa.me/${phone}?text=${waMsg}`;
  const telLink = `tel:${APP_CONFIG.SUPPORT_PHONE || ''}`;

  return `
    <div class="relative rounded-xl border-2 ${plan.badge ? 'border-brand shadow-lg shadow-brand/10' : 'border-slate-200 dark:border-slate-600'}
                p-4 pt-5 transition-transform duration-200 hover:-translate-y-1 hover:shadow-xl bg-white dark:bg-slate-900/40">
      ${plan.badge ? `
        <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-brand to-blue-500 text-white
                     text-[10px] font-bold px-3 py-1 rounded-full whitespace-nowrap shadow">
          ${esc(plan.badge)}
        </span>` : ''}
      <div class="text-center">
        <div class="text-sm font-semibold text-slate-500 dark:text-slate-400">${esc(plan.label)}</div>
        <div class="text-2xl font-extrabold text-slate-800 dark:text-white mt-1">৳${fmt(plan.price)}</div>
        <div class="text-[11px] text-slate-400 mt-0.5">
          ≈ ৳${fmt(perMonth)}/মাস
          ${savePercent > 0 ? `<span class="text-emerald-600 font-semibold">(${savePercent}% সাশ্রয়)</span>` : ''}
        </div>
      </div>
      <div class="flex gap-2 mt-4">
        <a href="${waLink}" target="_blank" rel="noopener"
           class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 rounded-lg text-center flex items-center justify-center gap-1">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
        <a href="${telLink}"
           class="flex-1 border border-brand text-brand hover:bg-brand/5 text-xs font-semibold py-2 rounded-lg text-center flex items-center justify-center gap-1">
          <i class="fa-solid fa-phone"></i> কল করুন
        </a>
      </div>
    </div>`;
}

function closeSubscriptionPromo() {
  document.getElementById('sub-promo-modal')?.remove();
}
