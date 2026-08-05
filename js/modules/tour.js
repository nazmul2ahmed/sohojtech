'use strict';

// ════════════════════════════════════════════════════════════
// GUIDED TOUR MODULE — growth-polish.md টায়ার ২ আইটেম ৭
// সাইডবারের প্রতিটা (দৃশ্যমান) ট্যাবে স্পটলাইট + টুলটিপ, ধাপে-ধাপে।
// Smart Navigation-এর modalStack প্যাটার্নে ইন্টিগ্রেটেড — hardware
// back চাপলে ট্যুর বন্ধ হয়ে যায়, বাকি অ্যাপ-নেভিগেশন স্পর্শ করে না।
// ব্যাকড্রপ ক্লিক ব্লকড (লিনিয়ার ফ্লো) — শুধু Next/Prev/Skip/কীবোর্ড।
// ════════════════════════════════════════════════════════════

// ট্যাব-আইডি → { title, desc } — NAV_CONFIG-এর visibility-লজিক থেকেই
// আসল ধাপের তালিকা তৈরি হয় (getVisibleTourSteps()), তাই staff/admin/ads
// এর জন্য আলাদা কোনো if/else মেইনটেইন করতে হয় না — সিঙ্গেল সোর্স অফ ট্রুথ।
const TOUR_CONTENT = {
  dashboard: { title: 'ড্যাশবোর্ড', desc: 'প্রতিদিনের বিক্রয়, নিট মুনাফা, নগদ প্রবাহ, ও মেয়াদ-সতর্কতা এক নজরে — অ্যাপ খুললেই প্রথম যা দেখবেন।' },
  pos: { title: 'বিক্রয় (POS)', desc: 'কাউন্টারে দ্রুত বিক্রয় করার জায়গা — ওষুধ যোগ করুন, নগদ/বাকি হিসাব করুন, Ctrl+Enter দিয়ে দ্রুত চেকআউট করুন।' },
  analytics: { title: 'সেলস অ্যানালিটিক্স', desc: 'নির্দিষ্ট সময়ের বিক্রয় ট্রেন্ড, টপ-সেলিং ওষুধ, ও ফিসক্যাল-ইয়ার রিপোর্ট এখানে দেখতে পাবেন।' },
  medicine: { title: 'ওষুধ মাস্টার', desc: 'আপনার সব ওষুধের তালিকা — নতুন ওষুধ যোগ করুন, অথবা Global Master থেকে সরাসরি আমদানি করুন।' },
  inventory: { title: 'ইনভেন্টরি', desc: 'ব্যাচ-ভিত্তিক স্টক দেখুন — কোন ব্যাচের মেয়াদ কবে, কত স্টক বাকি, FEFO অনুযায়ী সাজানো।' },
  purchase: { title: 'ক্রয়', desc: 'সরবরাহকারীর থেকে নতুন স্টক কেনার এন্ট্রি — এখান থেকেই ইনভেন্টরিতে নতুন ব্যাচ যোগ হয়।' },
  returns: { title: 'রিটার্ন', desc: 'কাস্টমার রিটার্ন বা সরবরাহকারী রিটার্ন/মেয়াদোত্তীর্ণ রাইট-অফ — দুটোই এখান থেকে করা যায়।' },
  opening: { title: 'পূর্বের হিসাব', desc: 'ব্যবসা শুরুর আগের স্টক/নগদ/বাকি এন্ট্রি করতে — সাধারণত শুধু প্রথমবার সেটআপে দরকার হয়।' },
  customers: { title: 'গ্রাহক', desc: 'গ্রাহকের তালিকা, কার কত বাকি, এবং বাকি আদায়ের এন্ট্রি — এক জায়গায়।' },
  suppliers: { title: 'সরবরাহকারী', desc: 'সরবরাহকারীর তালিকা, কার কত পাওনা, এবং পাওনা পরিশোধের এন্ট্রি।' },
  accounts: { title: 'অ্যাকাউন্টস', desc: 'দৈনিক আয়-ব্যয়ের লেনদেন-লগ — নতুন খরচ যোগ করুন, দিনের হিসাব যাচাই করুন।' },
  contact: { title: 'যোগাযোগ ও সাবস্ক্রিপশন', desc: 'সহায়তার জন্য যোগাযোগ, পেমেন্ট নাম্বার, ও সাবস্ক্রিপশন প্ল্যান এখানে পাবেন।' },
  staff: { title: 'স্টাফ ম্যানেজমেন্ট', desc: 'দোকানের স্টাফদের ইনভাইট করুন, role (ম্যানেজার/ক্যাশিয়ার) সেট করুন।' },
  admin: { title: 'ইউজার ম্যানেজমেন্ট', desc: 'নতুন ট্রায়াল ইউজার Approve করা ও সাবস্ক্রিপশন পরিচালনার জায়গা — শুধু আপনার (মালিকের) জন্য।' },
  ads: { title: 'বিজ্ঞাপন/অ্যাফিলিয়েট', desc: 'ভবিষ্যতে B2B পার্টনার-বিজ্ঞাপন এখানে দেখানো হবে।' },
  settings: { title: 'সেটিংস', desc: 'ফার্মেসির তথ্য, নগদ ব্যালান্স, ডেটা এক্সপোর্ট, এবং এই ট্যুর আবার দেখার অপশনও এখানেই।' },
};

let _tourSteps = [];
let _tourIdx = 0;
let _tourEls = null; // { backdrop, box, tooltip }
let _tourSidebarWasOpen = false;
let _tourTabHistoryStartLen = 0;
let _tourKeyHandler = null;

// ✅ renderSidebarNav()-এর visibility শর্তের সাথে হুবহু সামঞ্জস্যপূর্ণ —
// আলাদাভাবে মেইনটেইন করলে দুটো জায়গা ড্রিফট করে যাওয়ার ঝুঁকি থাকত।
function getVisibleTourSteps() {
  // ✅ app.js-এর renderSidebarNav()-এর OWNER_ONLY_TABS-এর সাথে সিঙ্ক —
  // dashboard/analytics/accounts staff-এর সাইডবারেই নেই, তাই ট্যুরেও দেখানো উচিত না
  const OWNER_ONLY_TOUR_TABS = ['dashboard', 'analytics', 'accounts'];
  const sections = NAV_CONFIG.filter(s =>
    (s.section !== 'প্রশাসন' || APP_STATE.isAdmin) &&
    (s.section !== 'B2B' || APP_STATE.ads.enabled) &&
    (s.section !== 'টিম' || !APP_STATE.isStaffMember)
  );
  return sections.flatMap(s => s.items)
    .filter(item => TOUR_CONTENT[item.id])
    .filter(item => !(APP_STATE.isStaffMember && OWNER_ONLY_TOUR_TABS.includes(item.id)))
    .map(item => ({ tabId: item.id, ...TOUR_CONTENT[item.id] }));
}

function startGuidedTour() {
  if (document.getElementById('tour-overlay-backdrop')) return; // ডাবল-স্টার্ট গার্ড
  _tourSteps = getVisibleTourSteps();
  if (!_tourSteps.length) return;

  _tourIdx = 0;
  _tourSidebarWasOpen = APP_STATE.sidebarOpen;
  _tourTabHistoryStartLen = APP_STATE.tabHistory.length;

  buildTourDOM();
  openAppModal('tour-overlay', closeGuidedTour); // ✅ Smart Nav — back বাটনে ট্যুর বন্ধ হবে

  _tourKeyHandler = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); tourNext(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); tourPrev(); }
    else if (e.key === 'Escape') { e.preventDefault(); endGuidedTour(); }
  };
  document.addEventListener('keydown', _tourKeyHandler);

  renderTourStep();
}

function buildTourDOM() {
  const backdrop = document.createElement('div');
  backdrop.id = 'tour-overlay-backdrop';
  backdrop.style.cssText = 'position:fixed;inset:0;z-index:99990;background:transparent;';

  const box = document.createElement('div');
  box.id = 'tour-highlight-box';
  box.style.cssText = `
    position:fixed;z-index:99991;pointer-events:none;border-radius:10px;
    border:2px solid var(--brand);
    box-shadow:0 0 0 9999px rgba(0,0,0,.65);
    transition:top .3s ease,left .3s ease,width .3s ease,height .3s ease;
  `;

  const tooltip = document.createElement('div');
  tooltip.id = 'tour-tooltip';
  tooltip.style.cssText = `
    position:fixed;z-index:99992;max-width:300px;
    transition:top .3s ease,left .3s ease;
  `;
  tooltip.className = 'bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-4 border border-slate-200 dark:border-slate-700';

  document.body.appendChild(backdrop);
  document.body.appendChild(box);
  document.body.appendChild(tooltip);
  _tourEls = { backdrop, box, tooltip };

  forceSidebarOpen();
}

function forceSidebarOpen() {
  document.getElementById('sidebar')?.classList.remove('-translate-x-full');
  document.getElementById('sidebar-overlay')?.classList.add('hidden'); // নিজস্ব backdrop-ই যথেষ্ট, ডাবল-ওভারলে না
}

function renderTourStep() {
  const step = _tourSteps[_tourIdx];
  if (!step) return endGuidedTour();

  goTab(step.tabId);
  forceSidebarOpen(); // ✅ goTab()-এর ভেতরের closeSidebar() পাল্টে দেয় বলে আবার জোর করে খোলা হচ্ছে

  setTimeout(() => positionTourStep(step), 60); // sidebar/layout সেটল হওয়ার জন্য ছোট্ট বিরতি
}

function positionTourStep(step) {
  const link = document.querySelector(`.nav-link[data-tab="${step.tabId}"]`);
  if (!link) { tourNext(); return; } // এজ-কেস: লিংক না পেলে স্কিপ করে পরের ধাপে

  const rect = link.getBoundingClientRect();
  const pad = 6;
  const { box, tooltip } = _tourEls;

  box.style.top = (rect.top - pad) + 'px';
  box.style.left = (rect.left - pad) + 'px';
  box.style.width = (rect.width + pad * 2) + 'px';
  box.style.height = (rect.height + pad * 2) + 'px';

  const isMobile = window.innerWidth < 1024;
  tooltip.innerHTML = buildTourTooltipHTML(step);

  if (isMobile) {
    tooltip.style.left = '16px';
    tooltip.style.right = '16px';
    tooltip.style.maxWidth = 'none';
    tooltip.style.bottom = '16px';
    tooltip.style.top = 'auto';
  } else {
    tooltip.style.right = 'auto';
    tooltip.style.bottom = 'auto';
    tooltip.style.maxWidth = '300px';
    let top = rect.top;
    const maxTop = window.innerHeight - 220; // আনুমানিক tooltip-উচ্চতা
    top = Math.max(16, Math.min(top, maxTop));
    tooltip.style.top = top + 'px';
    tooltip.style.left = '272px'; // সাইডবার (256px) + সামান্য গ্যাপ
  }

  wireTourTooltipButtons();
}

function buildTourTooltipHTML(step) {
  const isFirst = _tourIdx === 0;
  const isLast = _tourIdx === _tourSteps.length - 1;
  return `
    <div class="flex justify-between items-center mb-2">
      <span class="text-[11px] font-semibold text-brand">${_tourIdx + 1} / ${_tourSteps.length}</span>
      <button id="tour-skip-btn" class="text-[11px] text-slate-400 hover:text-red-500 underline">বাদ দিন</button>
    </div>
    <h4 class="font-bold text-slate-800 dark:text-white text-sm mb-1">${esc(step.title)}</h4>
    <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">${esc(step.desc)}</p>
    <div class="flex gap-2">
      ${!isFirst ? `<button id="tour-prev-btn" class="btn btn-secondary btn-sm flex-1">আগের</button>` : ''}
      <button id="tour-next-btn" class="btn btn-primary btn-sm flex-1">${isLast ? 'শেষ করুন' : 'পরের'}</button>
    </div>`;
}

function wireTourTooltipButtons() {
  document.getElementById('tour-next-btn')?.addEventListener('click', tourNext);
  document.getElementById('tour-prev-btn')?.addEventListener('click', tourPrev);
  document.getElementById('tour-skip-btn')?.addEventListener('click', endGuidedTour);
}

function tourNext() {
  if (_tourIdx >= _tourSteps.length - 1) { endGuidedTour(); return; }
  _tourIdx++;
  renderTourStep();
}

function tourPrev() {
  if (_tourIdx <= 0) return;
  _tourIdx--;
  renderTourStep();
}

// ✅ Skip/শেষ ধাপ — closeAppModal() দিয়ে (history.back() → popstate →
// modalStack pop → closeGuidedTour() কল হবে) — বাকি সব মডালের মতোই একই পথ
function endGuidedTour() {
  closeAppModal();
}

// ✅ এটাই আসল ক্লিনআপ — openAppModal()-এ closeFn হিসেবে পাস করা হয়েছিল,
// তাই এটা ব্যাক-বাটন থেকেও, এবং endGuidedTour()->closeAppModal() থেকেও আসতে পারে
function closeGuidedTour() {
  _tourEls?.backdrop.remove();
  _tourEls?.box.remove();
  _tourEls?.tooltip.remove();
  _tourEls = null;

  if (_tourKeyHandler) { document.removeEventListener('keydown', _tourKeyHandler); _tourKeyHandler = null; }

  // ✅ ট্যুরের ভেতরের সব goTab() কল tabHistory-তে push হয়েছিল — সেগুলো
  // মুছে দেওয়া হচ্ছে, নাহলে ট্যুর-পরবর্তী Back-প্রেসে ইউজার বিভ্রান্তিকরভাবে
  // ট্যুরের ট্যাব-ক্রম দিয়ে পেছাতে থাকবে।
  APP_STATE.tabHistory = APP_STATE.tabHistory.slice(0, _tourTabHistoryStartLen);

  if (!_tourSidebarWasOpen && window.innerWidth < 1024) closeSidebar();
}
