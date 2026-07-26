'use strict';

// ════════════════════════════════════════════════════════════
// ABOUT MODULE — growth-polish.md টায়ার ৩ আইটেম ৯
// কোম্পানির গল্প + PRODUCTS ক্রস-প্রমোশন (status ব্যাজসহ) + রেফারেল CTA
// (contact.js-এর প্যাটার্নে — SUBSCRIPTION_PLANS/PRODUCTS দুটোই config-driven)
// ════════════════════════════════════════════════════════════

function renderAboutModule() {
  const c = document.getElementById('about-content');
  if (!c) return;

  c.innerHTML = `
    ${renderAboutStoryCard()}
    ${renderProductsCard()}
    ${renderReferralCard()}
  `;
}

function renderAboutStoryCard() {
  const links = APP_CONFIG.COMPANY_LINKS || {};
  const linkRow = (links.website || links.facebook) ? `
    <div class="flex gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
      ${links.website ? `<a href="${esc(links.website)}" target="_blank" rel="noopener" class="text-xs text-brand hover:underline flex items-center gap-1"><i class="fa-solid fa-globe"></i> ওয়েবসাইট</a>` : ''}
      ${links.facebook ? `<a href="${esc(links.facebook)}" target="_blank" rel="noopener" class="text-xs text-brand hover:underline flex items-center gap-1"><i class="fa-brands fa-facebook"></i> ফেসবুক পেজ</a>` : ''}
    </div>` : '';

  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
        <i class="fa-solid fa-store text-brand"></i> আমাদের সম্পর্কে
      </h5>
      <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        ${esc(APP_CONFIG.appName)} তৈরি হয়েছে বাংলাদেশের ছোট ও মাঝারি ফার্মেসি মালিকদের কথা মাথায় রেখে —
        যাতে খাতা-কলমের হিসাব ছেড়ে সহজে ডিজিটাল ব্যবস্থাপনায় আসা যায়, কোনো জটিল টেকনিক্যাল জ্ঞান ছাড়াই।
        আমরা বিশ্বাস করি ভালো সফটওয়্যার শুধু বড় ব্যবসার জন্য না — প্রতিটা এক-মালিকানার দোকানেরও এটা প্রাপ্য।
      </p>
      ${linkRow}
    </div>`;
}

function renderProductsCard() {
  const products = APP_CONFIG.PRODUCTS || [];
  if (!products.length) return '';

  const statusBadge = (status) => {
    if (status === 'current') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-brand/10 text-brand">আপনি এখানে আছেন</span>`;
    if (status === 'coming_soon') return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">শীঘ্রই আসছে</span>`;
    return `<span class="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">এখন ব্যবহার করুন</span>`;
  };

  return `
    <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 mb-4">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
        <i class="fa-solid fa-layer-group text-brand"></i> আমাদের প্রোডাক্ট
      </h5>
      <div class="space-y-3">
        ${products.map(p => `
          <div class="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-600">
            <div class="min-w-0">
              <div class="text-sm font-semibold text-slate-800 dark:text-white">${esc(p.name)}</div>
              <div class="text-xs text-slate-400 mt-0.5">${esc(p.description)}</div>
            </div>
            <div class="flex-shrink-0 flex flex-col items-end gap-1">
              ${statusBadge(p.status)}
              ${p.status === 'available' && p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener" class="text-[11px] text-brand hover:underline">দেখুন →</a>` : ''}
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderReferralCard() {
  return `
    <div class="bg-brand/5 border border-brand/20 rounded-xl p-5">
      <h5 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2">
        <i class="fa-solid fa-heart text-brand"></i> পরিচিত কোনো ফার্মেসি মালিককে জানান
      </h5>
      <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">
        আপনার পরিচিত কেউ যদি এখনো খাতা-কলমে হিসাব রাখেন, তাদের এই অ্যাপের কথা জানাতে পারেন।
      </p>
      <button onclick="goTab('contact')" class="btn btn-primary btn-sm">
        <i class="fa-solid fa-share-nodes mr-1"></i> যোগাযোগের তথ্য দেখুন
      </button>
    </div>`;
}
