'use strict';

// ════════════════════════════════════════════════════════════
// CONTACT MODULE — growth-polish.md টায়ার ১ আইটেম ৩
// ফোন/WhatsApp/ইমেইল + বিকাশ-নগদ (copy-to-clipboard) + প্ল্যান প্রাইসিং
// ✅ SUBSCRIPTION_PLANS ও renderPlanCard() subscription-promo.js থেকে
// reuse করা হয়েছে — ডুপ্লিকেট করা হয়নি।
// স্ট্যাটাস ব্যানার APP_STATE.subscriptionStatusInfo থেকে আসে
// (auth.js-এর applyUserProfile()-এ সেট হয়)।
// ════════════════════════════════════════════════════════════

function renderContactModule() {
  const c = document.getElementById('contact-content');
  if (!c) return;

  c.innerHTML = `
    ${contactStatusBannerHTML()}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      ${renderContactInfoCard()}
      ${renderPaymentCard()}
    </div>
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
        <i class="fa-solid fa-tags text-brand"></i> সাবস্ক্রিপশন প্যাকেজ
      </h5>
      <p class="text-[11px] text-slate-400 mb-4">যেকোনো প্ল্যান নিতে নিচে WhatsApp বা কল বাটনে ক্লিক করুন — ম্যানুয়ালি অ্যাক্টিভেট করে দেওয়া হবে।</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        ${SUBSCRIPTION_PLANS.map(plan => renderPlanCard(plan, false)).join('')}
      </div>
    </div>
  `;
}

function contactStatusBannerHTML() {
  const info = APP_STATE.subscriptionStatusInfo;
  if (!info) return '';

  const renewBtn = `<button onclick="openSubscriptionPromo('trial')" class="ml-2 underline font-semibold whitespace-nowrap">প্ল্যান দেখুন</button>`;

  if (info.mode === 'trial') {
    return `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm rounded-xl px-4 py-3 mb-4 flex items-center flex-wrap gap-1">
      <i class="fa-solid fa-clock mr-1"></i> ট্রায়াল চলছে — আর <b>${info.daysLeft}</b> দিন বাকি।${renewBtn}
    </div>`;
  }
  if (info.mode === 'revoked' || info.mode === 'trial-expired' || info.mode === 'subscription-expired') {
    const reason = info.mode === 'revoked' ? 'অ্যাকাউন্ট বাতিল করা হয়েছে'
      : info.mode === 'subscription-expired' ? 'সাবস্ক্রিপশনের মেয়াদ শেষ' : 'ট্রায়ালের মেয়াদ শেষ';
    return `<div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl px-4 py-3 mb-4 font-medium flex items-center flex-wrap gap-1">
      <i class="fa-solid fa-lock mr-1"></i> ${reason} — এখন শুধু পুরনো তথ্য দেখা যাচ্ছে।${renewBtn}
    </div>`;
  }
  if (info.mode === 'approved' && info.subDaysLeft != null && info.subDaysLeft <= 7) {
    return `<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-sm rounded-xl px-4 py-3 mb-4 flex items-center flex-wrap gap-1">
      <i class="fa-solid fa-triangle-exclamation mr-1"></i> সাবস্ক্রিপশন আর <b>${info.subDaysLeft}</b> দিনে শেষ হবে।${renewBtn}
    </div>`;
  }
  return `<div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
    <i class="fa-solid fa-circle-check"></i> সাবস্ক্রিপশন সক্রিয় আছে${info.subDaysLeft == null ? ' (সীমাহীন)' : ''}।
  </div>`;
}

function renderContactInfoCard() {
  const phone = APP_CONFIG.SUPPORT_PHONE || '';
  const phoneDigits = phone.replace(/[^0-9]/g, '');
  const email = APP_CONFIG.ADMIN_EMAIL || '';
  const waMsg = encodeURIComponent('আসসালামু আলাইকুম, আমার SohojTech Pharmacy অ্যাকাউন্ট নিয়ে সহায়তা দরকার।');

  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
        <i class="fa-solid fa-headset text-brand"></i> সরাসরি যোগাযোগ
      </h5>
      <div class="space-y-2">
        <a href="tel:${esc(phone)}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
          <div class="w-9 h-9 rounded-lg bg-brand/10 text-brand flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-phone"></i></div>
          <div class="min-w-0"><div class="text-xs text-slate-400">কল করুন</div><div class="text-sm font-semibold text-slate-800 dark:text-white font-mono">${esc(phone)}</div></div>
        </a>
        <a href="https://wa.me/${phoneDigits}?text=${waMsg}" target="_blank" rel="noopener" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
          <div class="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center flex-shrink-0"><i class="fa-brands fa-whatsapp"></i></div>
          <div class="min-w-0"><div class="text-xs text-slate-400">WhatsApp</div><div class="text-sm font-semibold text-slate-800 dark:text-white font-mono">${esc(phone)}</div></div>
        </a>
        <a href="mailto:${esc(email)}" class="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition">
          <div class="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 flex items-center justify-center flex-shrink-0"><i class="fa-solid fa-envelope"></i></div>
          <div class="min-w-0"><div class="text-xs text-slate-400">ইমেইল</div><div class="text-sm font-semibold text-slate-800 dark:text-white truncate">${esc(email)}</div></div>
        </a>
      </div>
    </div>`;
}

function renderPaymentCard() {
  const pn = APP_CONFIG.PAYMENT_NUMBERS || {};
  const row = (label, number, colorClass, bgClass) => `
    <div class="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600">
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-lg ${bgClass} ${colorClass} flex items-center justify-center flex-shrink-0 text-xs font-extrabold">${esc(label[0])}</div>
        <div class="min-w-0"><div class="text-xs text-slate-400">${esc(label)} (Personal)</div><div class="text-sm font-semibold text-slate-800 dark:text-white font-mono">${esc(number)}</div></div>
      </div>
      <button type="button" onclick="copyToClipboardWithToast('${esc(number)}','${esc(label)} নাম্বার')" class="text-brand text-xs font-semibold hover:underline whitespace-nowrap flex-shrink-0"><i class="fa-solid fa-copy mr-1"></i>কপি</button>
    </div>`;

  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
        <i class="fa-solid fa-mobile-screen-button text-brand"></i> পেমেন্ট (বিকাশ/নগদ)
      </h5>
      <div class="space-y-2">
        ${pn.bkash ? row('বিকাশ', pn.bkash, 'text-pink-600', 'bg-pink-50 dark:bg-pink-900/20') : ''}
        ${pn.nagad ? row('নগদ', pn.nagad, 'text-orange-600', 'bg-orange-50 dark:bg-orange-900/20') : ''}
      </div>
      <p class="text-[11px] text-slate-400 mt-3"><i class="fa-solid fa-circle-info mr-1"></i>Send Money করে WhatsApp-এ ট্রানজেকশন আইডি পাঠালে দ্রুত অ্যাক্টিভেট হয়ে যাবে।</p>
    </div>`;
}

function copyToClipboardWithToast(text, label) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => toast(`${label} কপি হয়েছে!`, 's'))
      .catch(() => toast('কপি করা যায়নি — ম্যানুয়ালি সিলেক্ট করে কপি করুন।', 'w'));
  } else {
    toast('এই ব্রাউজারে অটো-কপি সাপোর্ট নেই — ম্যানুয়ালি সিলেক্ট করে কপি করুন।', 'w');
  }
}
