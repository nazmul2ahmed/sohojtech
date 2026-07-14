'use strict';

// ════════════════════════════════════════════════════════════
// GLOBAL APP STATE
// লিগ্যাসি Code.gs-এর `G` অবজেক্টের আধুনিক, মডুলার সংস্করণ।
// সব ডেটা এখানে কেন্দ্রীভূত থাকবে — যেকোনো মডিউল এটা পড়বে/লিখবে।
// ════════════════════════════════════════════════════════════
const APP_STATE = {
  // UI state
  currentTab: 'dashboard',
  sidebarOpen: false,
  currentUser: null,
  isAdmin: false,

  // Business data (এখনো খালি — পরের ধাপে Mock Data দিয়ে পূরণ হবে)
  pharmacyName: 'ফার্মেসি',
  ownerName: '',
  phone: '',
  address: '',
  lowStockLevel: 10,
  historyCutoff: '',
  olderHistoryLoaded: false,

  medicines: [],
  customers: [],
  suppliers: [],
  inventory: [],
  sales: [],
  purchases: [],
  expenses: [],
  payments: [],   // T_Payments শিটের সমতুল্য — বাকি আদায়ের রেকর্ড
  supplierPayments: [], // সরবরাহকারী পাওনা পরিশোধের রেকর্ড

  // POS/Purchase draft cart (multi-item form state — পরে ব্যবহৃত হবে)
  posItems: [],
  purItems: [],
  returns: [],
  openingEntries: [],
  retMode: 'customer',

  // ════════════════════════════════════════════════════════════
  // B2B Ad/Affiliate — namespaced state
  // কোনো actual ফিচার এখনো নেই। এই অবজেক্টে অন্য কোনো মডিউল থেকে
  // সরাসরি APP_STATE.ads.xxx = ... লেখা নিষেধ — js/modules/ads.js-এর
  // পাবলিক হেল্পার ফাংশন (নিচে দেখুন) দিয়েই বদলাতে হবে।
  // ════════════════════════════════════════════════════════════
  ads: {
    enabled: false,     // ফিচার-ফ্ল্যাগ — true না করা পর্যন্ত nav-এ ট্যাব দেখাবে না
    campaigns: [],      // ভবিষ্যতে: [{ id, sponsorName, ... }]
    settings: {},        // ভবিষ্যতে: প্রদর্শন-সংক্রান্ত সেটিংস
  },
};


// ════════════════════════════════════════════════════════════
// SIDEBAR NAVIGATION CONFIG
// লিগ্যাসি sidebar-এর গ্রুপিং অনুযায়ী — প্রতিটি ট্যাব একটি মডিউল ফাইলের সাথে
// ম্যাপ হবে (js/modules/*.js), যেগুলো পরবর্তী ধাপে পূরণ হবে।
// ════════════════════════════════════════════════════════════
const NAV_CONFIG = [
  {
    section: 'মূল মেনু',
    items: [
      { id: 'dashboard', label: 'ড্যাশবোর্ড', icon: 'fa-gauge-high' },
      { id: 'pos',       label: 'বিক্রয় (POS)', icon: 'fa-cash-register' },
      { id: 'analytics', label: 'সেলস অ্যানালিটিক্স', icon: 'fa-chart-line' },
    ],
  },
  {
    section: 'ব্যবস্থাপনা',
    items: [
      { id: 'medicine',  label: 'ওষুধ মাস্টার', icon: 'fa-capsules' },
      { id: 'inventory', label: 'ইনভেন্টরি', icon: 'fa-boxes-stacked' },
      { id: 'purchase',  label: 'ক্রয়', icon: 'fa-truck-field' },
      { id: 'returns', label: 'রিটার্ন', icon: 'fa-rotate-left' },
      { id: 'opening',   label: 'পূর্বের হিসাব', icon: 'fa-clock-rotate-left' },
    ],
  },
  {
    section: 'হিসাব',
    items: [
      { id: 'customers', label: 'গ্রাহক', icon: 'fa-users' },
      { id: 'suppliers', label: 'সরবরাহকারী', icon: 'fa-building' },
      { id: 'accounts',  label: 'অ্যাকাউন্টস', icon: 'fa-book-open' },
    ],
  },
  {
    section: 'প্রশাসন',
    items: [
      { id: 'admin', label: 'ইউজার ম্যানেজমেন্ট', icon: 'fa-user-shield' },
    ],
  },
  {
    section: 'সেটিংস',
    items: [
      { id: 'settings', label: 'সেটিংস', icon: 'fa-gear' },
    ],
  },
  {
    section: 'B2B',
    items: [
      { id: 'ads', label: 'বিজ্ঞাপন/অ্যাফিলিয়েট', icon: 'fa-bullhorn' },
    ],
  },
];

// দ্রুত lookup-এর জন্য ফ্ল্যাট ম্যাপ (id → label), header title বসাতে ব্যবহৃত হবে
const TAB_TITLES = NAV_CONFIG
  .flatMap(section => section.items)
  .reduce((map, item) => { map[item.id] = item.label; return map; }, {});
