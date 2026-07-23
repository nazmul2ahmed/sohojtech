'use strict';

document.addEventListener('DOMContentLoaded', () => {
  console.log(`${APP_CONFIG.appName} v${APP_CONFIG.version} booting...`);
  applyStoredTheme();
  initSmartNavigation(); // ✅ নতুন — auth gate-এর আগে, যাতে boot থেকেই sentinel বসে
  initAuthGate();
});
window.addEventListener('online', () => {
  updateConnBadge(true);
  toast('ইন্টারনেট সংযোগ ফিরেছে।', 's');
  updateSettingsDbStatusCard(); // ✅ ধাপ ২২: Settings ট্যাব খোলা থাকলে কার্ডও লাইভ আপডেট
});
window.addEventListener('offline', () => {
  updateConnBadge(false);
  toast('অফলাইন — নতুন এন্ট্রি সাময়িক বন্ধ থাকবে।', 'w');
  updateSettingsDbStatusCard(); // ✅ ধাপ ২২
});

function updateConnBadge(isOnline) {
  const badge = document.getElementById('conn-status-badge');
  if (!badge) return;
  badge.innerHTML = isOnline
    ? '<i class="fa-solid fa-circle me-1"></i>সংযুক্ত'
    : '<i class="fa-solid fa-circle me-1"></i>অফলাইন';
  badge.className = isOnline
    ? 'hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1 text-xs font-semibold'
    : 'hidden sm:inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-full px-3 py-1 text-xs font-semibold';
}

async function initApp() {
  setLoadingMessage('ডেটা লোড হচ্ছে...');
  updateConnBadge(navigator.onLine);
  initSyncDB().catch(err => console.warn('SyncDB init ব্যর্থ:', err));
  initSyncEngine(); // ✅ ফিক্স (ধাপ ১২): আগে এই কলটাই ছিল না, তাই অফলাইন
                     // queue নেট ফিরলেও কখনো স্বয়ংক্রিয়ভাবে সিঙ্ক হতো না।
  try {
    const data = await apiGetCompleteData();
    if (!data.success) {
      showFatalError('ডেটা লোড করতে সমস্যা:\n' + data.message);
      return;
    }
    Object.assign(APP_STATE, data);
  } catch (err) {
    showFatalError('initApp() এ সমস্যা:\n' + err.message);
    return;
  }

  renderShell();
  setLoadingMessage('Ready.');
  hideLoadingScreen();
  showAppRoot();
}

// ════════════════════════════════════════════════════════════
// ✅ SMART NAVIGATION — Modal-aware back + Tab-aware back + double-back-to-exit
//
// তিনটা স্তর, তিনটা ভিন্ন mechanism দিয়ে সামলানো হয় যাতে একটা আরেকটার
// সাথে conflict না করে:
//   ১) মডাল স্ট্যাক (APP_STATE.modalStack)      → মডাল খোলা থাকলে back = মডাল বন্ধ
//   ২) ট্যাব হিস্ট্রি (APP_STATE.tabHistory)     → মডাল নেই কিন্তু আগে অন্য ট্যাব
//                                                  থেকে এসেছি → সেই ট্যাবে ফিরে যাও
//   ৩) Exit-guard (double-back-to-exit)          → মডাল নেই, tabHistory-ও খালি
//                                                  (মানে এই ট্যাবই যাত্রার শুরু)
//
// আসল browser History API stack-এ শুধু একটাই "sentinel" এন্ট্রি থাকে —
// tab-navigation পুরোপুরি APP_STATE.tabHistory (নিজস্ব in-memory array) দিয়ে
// ট্র্যাক হয়, তাই History API-এর সাথে এর কোনো সংঘর্ষ হয় না।
// ════════════════════════════════════════════════════════════
APP_STATE.modalStack = []; // [{ id, closeFn }]
APP_STATE.tabHistory = []; // ✅ নতুন — ভিজিট করা ট্যাবের ক্রম (browser History API না, নিজস্ব স্ট্যাক)
let _navBackGuard = false; // programmatic closeAppModal() থেকে আসা popstate-কে আলাদা করতে
let _lastExitPressAt = 0;
const EXIT_PRESS_WINDOW_MS = 2500;

function initSmartNavigation() {
  // pushState (replaceState না) — স্ট্যাকে সবসময় অন্তত ২টা এন্ট্রি থাকবে
  // ([root, sentinel]), তাই প্রথম back-এ সরাসরি অ্যাপ থেকে বের হয়ে যাবে না।
  history.pushState({ sentinel: true }, '');
  window.addEventListener('popstate', handleAppPopState);

  // ✅ শেষ ট্যাবে ফেরা (রিফ্রেশ-পারসিস্টেন্স)
  const savedTab = localStorage.getItem('pharmacy-last-tab');
  if (savedTab && TAB_TITLES[savedTab]) APP_STATE.currentTab = savedTab;
}

function handleAppPopState() {
  // ১) মডাল খোলা থাকলে — সবার আগে মডাল বন্ধ করো, বাকি কিছুই না
  if (APP_STATE.modalStack.length) {
    const top = APP_STATE.modalStack.pop();
    try { top.closeFn(); } catch (err) { console.warn('Modal close-এ সমস্যা:', err); }
    _navBackGuard = false;
    return;
  }
  if (_navBackGuard) { _navBackGuard = false; return; }

  // ২) ✅ নতুন — tab-stack-এ পেছনে যাওয়ার মতো এন্ট্রি থাকলে সেই ট্যাবে ফিরে যাও
  //    (এটা exit-guard trigger করে না, শুধু app-এর ভেতরেই এক ধাপ পেছনে যায়)
  if (APP_STATE.tabHistory.length) {
    const prevTab = APP_STATE.tabHistory.pop();
    goTab(prevTab, { fromBack: true }); // fromBack: true → আবার tabHistory-তে push হবে না
    history.pushState({ sentinel: true }, ''); // sentinel re-arm — future back-press-দের জন্য reserve রাখা
    return;
  }

  // ৩) মডাল নেই, tab-history-ও খালি — এটাই যাত্রার প্রথম ট্যাব, তাই এখন exit-intent
  const now = Date.now();
  if (now - _lastExitPressAt < EXIT_PRESS_WINDOW_MS) {
    return; // দ্বিতীয়বার — এবার সত্যিই বের হতে দিচ্ছি, sentinel আর re-arm হবে না
  }
  _lastExitPressAt = now;
  toast('আবার Back চাপুন বের হতে', 'w');
  history.pushState({ sentinel: true }, ''); // re-arm
}

// ✅ যেকোনো মডাল খোলার সময় এটা কল করুন (appendChild-এর ঠিক পরে)
function openAppModal(id, closeFn) {
  APP_STATE.modalStack.push({ id, closeFn });
  history.pushState({ modal: id }, '');
}

// ✅ মডাল বন্ধ করার একমাত্র পথ — Cancel বাটন এবং সফল-সাবমিট দুই জায়গাতেই
// এটা কল হবে, closeXxxForm() সরাসরি না। এটা history.back() কল করে,
// যেটা popstate ফায়ার করে, যেটা modalStack থেকে pop করে আসল closeFn চালায়।
function closeAppModal() {
  if (!APP_STATE.modalStack.length) return;
  _navBackGuard = true;
  history.back();
}
// ════════════════════════════════════════════════════════════
// SHELL RENDERING
// ════════════════════════════════════════════════════════════
function renderShell() {
  renderSidebarNav();
  renderTabPanels();
  wireShellEvents();
  updateDarkToggleIcon();
  if (APP_STATE.currentTab === 'admin' && !APP_STATE.isAdmin) APP_STATE.currentTab = 'dashboard';
  if (APP_STATE.currentTab === 'ads' && !APP_STATE.ads.enabled) APP_STATE.currentTab = 'dashboard';
  goTab(APP_STATE.currentTab);
  setText('sidebar-pharma-name', APP_STATE.pharmacyName);
}

function renderSidebarNav() {
  const nav = document.getElementById('sidebar-nav');
  const sections = NAV_CONFIG.filter(s =>
  (s.section !== 'প্রশাসন' || APP_STATE.isAdmin) &&
  (s.section !== 'B2B' || APP_STATE.ads.enabled)
);
  nav.innerHTML = sections.map(section => `
    <div>
      <div class="px-3 mb-1 text-[11px] font-semibold tracking-wider uppercase text-white/30">${esc(section.section)}</div>
      <ul class="space-y-0.5">
        ${section.items.map(item => `
          <li>
            <a href="#" data-tab="${item.id}"
              class="nav-link flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                     text-white/60 hover:bg-white/5 hover:text-white transition">
              <i class="fa-solid ${item.icon} w-4 text-center"></i>
              <span>${esc(item.label)}</span>
            </a>
          </li>`).join('')}
      </ul>
    </div>`).join('');
}

// Dashboard-এর জন্য বিশেষ container দেই (dashboard.js নিজে রেন্ডার করবে);
// বাকি সব ট্যাব এখনো placeholder।
function renderTabPanels() {
  const container = document.getElementById('tab-panels');
  if (!container) return; // কনটেইনার না থাকলে কোড এখানেই থেমে যাবে, এরর হবে না

  const allTabs = NAV_CONFIG.flatMap(s => s.items);

  container.innerHTML = allTabs.map(item => {
    // ১. ড্যাশবোর্ড ট্যাব
    if (item.id === 'dashboard') {
      return `<div id="tab-dashboard" class="tab-panel hidden tab-enter">
        <div class="mb-5">
          <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}
          </h2>
          <p id="dash-date" class="text-xs text-slate-400 mt-0.5"></p>
        </div>
        <div id="dashboard-content"></div>
      </div>`;
    }

    // ২. পিওএস (POS) ট্যাব
    if (item.id === 'pos') {
      return `<div id="tab-pos" class="tab-panel hidden tab-enter">
        <div class="mb-5">
          <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}
          </h2>
        </div>
        <div id="pos-content"></div>
      </div>`;
    }
    // ৩. অ্যানালিটিক্স (Analytics) ট্যাব
    if (item.id === 'analytics') {
      return `<div id="tab-analytics" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="analytics-content"></div>
      </div>`;
    }
    // ৪. পারচেজ (Purchase) ট্যাব
    if (item.id === 'purchase') {
      return `<div id="tab-purchase" class="tab-panel hidden tab-enter">
        <div class="mb-5">
          <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}
          </h2>
        </div>
        <div id="purchase-content"></div>
      </div>`;
    }
    // ৫. রিটার্নস (Returns) ট্যাব
    if (item.id === 'returns') {
      return `<div id="tab-returns" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="returns-content"></div>
      </div>`;
    }
    // ৬. ওপেনিং (Opening) ট্যাব
    if (item.id === 'opening') {
      return `<div id="tab-opening" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="opening-content"></div>
      </div>`;
    }
    // ৭. ইনভেন্টরি (Inventory) ট্যাব
    if (item.id === 'inventory') {
      return `<div id="tab-inventory" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="inventory-content"></div>
      </div>`;
    }
    // ৮. ওষুধ মাস্টার (Medicine) ট্যাব
    if (item.id === 'medicine') {
      return `<div id="tab-medicine" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="medicine-content"></div>
      </div>`;
    }
    // ৯. গ্রাহক (Customers) ট্যাব
    if (item.id === 'customers') {
      return `<div id="tab-customers" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="customers-content"></div>
      </div>`;
    }
    // ১০. সরবরাহকারী (Suppliers) ট্যাব
    if (item.id === 'suppliers') {
      return `<div id="tab-suppliers" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="suppliers-content"></div>
      </div>`;
    }
    // ১১. অ্যাকাউন্টস (Accounts) ট্যাব
    if (item.id === 'accounts') {
      return `<div id="tab-accounts" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="accounts-content"></div>
      </div>`;
    }
    // ১২. সেটিংস (Settings) ট্যাব
    if (item.id === 'settings') {
      return `<div id="tab-settings" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="settings-content"></div>
      </div>`;
    }
    // ১৩. ইউজার ম্যানেজমেন্ট (Admin) ট্যাব
    if (item.id === 'admin') {
      return `<div id="tab-admin" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="admin-content"></div>
      </div>`;
    }
    // ১৪. বিজ্ঞাপন/অ্যাফিলিয়েট (Ads) ট্যাব — ধাপ ৮ boilerplate
    if (item.id === 'ads') {
      return `<div id="tab-ads" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="ads-content"></div>
      </div>`;
    }
    // ১৫. যোগাযোগ ও সাবস্ক্রিপশন (Contact) ট্যাব
    if (item.id === 'contact') {
      return `<div id="tab-contact" class="tab-panel hidden tab-enter">
        <div class="mb-5"><h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}</h2></div>
        <div id="contact-content"></div>
      </div>`;
    }
    // . বাকি সব ডিফল্ট/প্লেসহোল্ডার ট্যাব
    return `<div id="tab-${item.id}" class="tab-panel hidden tab-enter">
      <div class="mb-5">
        <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <i class="fa-solid ${item.icon} text-brand"></i> ${esc(item.label)}
        </h2>
      </div>
      <div class="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700
                  rounded-xl p-8 text-center text-slate-400 dark:text-slate-500">
        <i class="fa-solid fa-hammer text-2xl mb-3 opacity-40"></i>
        <p class="text-sm">এই মডিউল পরের ধাপে তৈরি হবে।</p>
      </div>
    </div>`;
  }).join('');
}

function wireShellEvents() {
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    const link = e.target.closest('.nav-link');
    if (!link) return;
    e.preventDefault();
    goTab(link.dataset.tab);
  });
  document.getElementById('hamburger-btn').addEventListener('click', toggleSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);
  document.getElementById('dark-toggle-btn').addEventListener('click', () => {
    toggleTheme();
    updateDarkToggleIcon();
  });
}

// ════════════════════════════════════════════════════════════
// TAB ROUTER
// ════════════════════════════════════════════════════════════
// ✅ opts.fromBack: true হলে বোঝায় এই কলটা handleAppPopState() থেকে
// এসেছে (ইউজার Back চেপেছে) — তখন currentTab আবার tabHistory-তে push
// করা হবে না, নাহলে back চাপলেও stack বাড়তেই থাকবে (ping-pong bug)।
function goTab(tabId, opts = {}) {
  // ✅ নতুন — সাধারণ (forward) নেভিগেশনেই কেবল আগের ট্যাব stack-এ push হবে
  if (!opts.fromBack && APP_STATE.currentTab && APP_STATE.currentTab !== tabId) {
    APP_STATE.tabHistory.push(APP_STATE.currentTab);
  }

  APP_STATE.currentTab = tabId;
  localStorage.setItem('pharmacy-last-tab', tabId);
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById('tab-' + tabId);
  if (panel) panel.classList.remove('hidden');

  document.querySelectorAll('.nav-link').forEach(link => {
    const active = link.dataset.tab === tabId;
    link.classList.toggle('bg-brand/20', active);
    link.classList.toggle('text-white', active);
    link.classList.toggle('text-white/60', !active);
  });

  setText('header-title', TAB_TITLES[tabId] || tabId);
  closeSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // ট্যাব-নির্দিষ্ট রেন্ডার হুক — এখন শুধু dashboard ছিল , পরে বাকিগুলো যোগ হয়েছে 
  // ট্যাব-নির্দিষ্ট রেন্ডার হুক

  // ট্যাব-নির্দিষ্ট রেন্ডার হুক
  try {
    if (tabId === 'dashboard') { setText('dash-date', formatTodayBn()); renderDashboardModule(); }
    if (tabId === 'pos') { renderPOSModule(); }
    if (tabId === 'analytics') { renderAnalyticsModule(); }
    if (tabId === 'purchase') { renderPurchaseModule(); }
    if (tabId === 'returns') { renderReturnsModule(); }
    if (tabId === 'opening') { renderOpeningModule(); }
    if (tabId === 'inventory') { renderInventoryModule(); }
    if (tabId === 'medicine') { renderMedicineModule(); }
    if (tabId === 'customers') { renderCustomersModule(); }
    if (tabId === 'suppliers') { renderSuppliersModule(); }
    if (tabId === 'accounts') { renderAccountsModule(); }
    if (tabId === 'settings') { renderSettingsModule(); }
    if (tabId === 'admin') { renderAdminModule(); }
    if (tabId === 'ads') { renderAdsModule(); }
    if (tabId === 'contact') { renderContactModule(); }
  } catch (err) {
    showFatalError('goTab("' + tabId + '") এ সমস্যা:\n' + err.message);
  }
}

function formatTodayBn() {
  const d = new Date();
  const days = ['রবিবার','সোমবার','মঙ্গলবার','বুধবার','বৃহস্পতিবার','শুক্রবার','শনিবার'];
  const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ════════════════════════════════════════════════════════════
// SIDEBAR TOGGLE
// ════════════════════════════════════════════════════════════
function toggleSidebar() {
  APP_STATE.sidebarOpen = !APP_STATE.sidebarOpen;
  document.getElementById('sidebar').classList.toggle('-translate-x-full', !APP_STATE.sidebarOpen);
  document.getElementById('sidebar-overlay').classList.toggle('hidden', !APP_STATE.sidebarOpen);
}
function closeSidebar() {
  APP_STATE.sidebarOpen = false;
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}

// ════════════════════════════════════════════════════════════
// LOADING / VISIBILITY
// ════════════════════════════════════════════════════════════
function hideLoadingScreen() { document.getElementById('app-loading')?.classList.add('hide'); }
function showAppRoot() { document.getElementById('app-root')?.classList.remove('hidden'); }
function setLoadingMessage(msg) { setText('loading-message', msg); }

// ════════════════════════════════════════════════════════════
// DARK MODE
// ════════════════════════════════════════════════════════════
function applyStoredTheme() {
  const saved = localStorage.getItem('pharmacy-theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', saved ? saved === 'dark' : prefersDark);
}
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('pharmacy-theme', isDark ? 'dark' : 'light');
}
function updateDarkToggleIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('dark-toggle-icon');
  if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
