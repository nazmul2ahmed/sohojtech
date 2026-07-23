'use strict';

// ════════════════════════════════════════════════════════════
// SHARED FORMATTING & HELPER UTILITIES
// সব মডিউল এখান থেকে ব্যবহার করবে — একবার লেখা, সবখানে reuse
// ════════════════════════════════════════════════════════════

function fmt(n) {
  return parseFloat(n || 0).toLocaleString('bn-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(n) {
  n = parseFloat(n || 0);
  if (n >= 100000) return (n / 100000).toFixed(1) + 'L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return fmt(n);
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// MM/YYYY ফরম্যাট থেকে Date object — Expiry alert-এর জন্য দরকার
function parseExpiryDate(exp) {
  if (!exp) return null;
  const parts = String(exp).split('/');
  if (parts.length === 2) return new Date(parseInt(parts[1]), parseInt(parts[0]), 0);
  const d = new Date(exp);
  return isNaN(d.getTime()) ? null : d;
}

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ৩১: ক্যালেন্ডার-সঠিক expiry comparator — parseExpiryDate()
// ব্যবহার করে প্রকৃত Date তুলনা করে, "MM/YYYY" স্ট্রিং-এর lexicographic
// (আভিধানিক) তুলনা না। আগে অনেক জায়গায় সরাসরি স্ট্রিং তুলনা হতো
// (যেমন `a.expiry < b.expiry`), যেটা বছরের বাউন্ডারিতে ভুল অর্ডার
// দিত — "01/2027" lexicographically "12/2026"-এর আগে পড়ে, যদিও
// ক্যালেন্ডারে ডিসেম্বর ২০২৬ আগে। এখন থেকে batches sort করার সব
// জায়গা এই একটাই হেল্পার ব্যবহার করবে।
//
// direction: 'asc' (soonest-expiry-first, FEFO deduction/nearestExpiry-এ
// ব্যবহৃত) বা 'desc' (furthest-expiry-first, সাপ্লায়ার রিটার্ন/রাইট-অফ
// legacy heuristic-এ ব্যবহৃত)। খালি/অপার্সেবল expiry সবসময় সবার শেষে
// যাবে — কোনো দিকেই প্রায়োরিটাইজড হবে না।
// ════════════════════════════════════════════════════════════
function compareBatchExpiry(a, b, direction = 'asc') {
  const da = parseExpiryDate(a.expiry), db = parseExpiryDate(b.expiry);
  if (!da && !db) return 0;
  if (!da) return 1;
  if (!db) return -1;
  return direction === 'asc' ? da - db : db - da;
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ════════════════════════════════════════════════════════════
// ✅ ধাপ ২৩: Inventory batch থেকে derived summary fields বের করার
// কেন্দ্রীয় হেল্পার — totalStock/costValue/mrpValue/nearestExpiry/status
// এই লজিক আগে inventory.js, pos.js, api-client.js — তিন জায়গায় আলাদাভাবে
// duplicate ছিল, এখন এখান থেকেই সবাই ব্যবহার করবে (api-client.js-এর ছয়টা
// ফাংশন এই ধাপে এটা ব্যবহার করছে; inventory.js/pos.js-এর নিজস্ব লোকাল
// কপি এই ধাপে অক্ষত রাখা হয়েছে — সেটা আলাদা ঐচ্ছিক রিফ্যাক্টর)।
//
// batches: raw batch array (filter/sort করা নাও থাকতে পারে)
// reorderLevel: এই ওষুধের নির্দিষ্ট বা global lowStockLevel
// রিটার্ন করে: { batches (stock>0, expiry অনুযায়ী sorted), totalStock,
//               costValue, mrpValue, nearestExpiry, status }
// ════════════════════════════════════════════════════════════
function computeInventoryDerivedFields(batches, reorderLevel) {
  const filtered = (batches || []).filter(b => (b.stock || 0) > 0);
  filtered.sort((a, b) => compareBatchExpiry(a, b, 'asc')); // ✅ ধাপ ৩১ ফিক্স

  const totalStock = filtered.reduce((a, b) => a + b.stock, 0);
  const costValue = round2(filtered.reduce((a, b) => a + (b.cost || 0) * b.stock, 0));
  const mrpValue = round2(filtered.reduce((a, b) => a + (b.mrp || 0) * b.stock, 0));
  const nearestExpiry = filtered[0]?.expiry || '';

  const rl = reorderLevel || 10;
  const status = totalStock === 0 ? 'out' : totalStock <= rl ? 'low' : 'ok';

  return { batches: filtered, totalStock, costValue, mrpValue, nearestExpiry, status };
}
// ════════════════════════════════════════════════════════════
// MEDICINE MATCH RESOLVER — ধাপ ২৫: pos.js ও purchase.js দুই জায়গা
// থেকেই কল হয়। exact match, single-unambiguous-partial-match হলে
// সরাসরি resolve করে; একাধিক partial match হলে ambiguous রিটার্ন
// করে — কলার তখন disambiguation UI দেখাবে, silent-select করবে না।
// ════════════════════════════════════════════════════════════
function resolveMedicineMatch(query, list, textFn) {
  const val = String(query || '').trim();
  if (!val) return { type: 'none' };
  const valLower = val.toLowerCase();

  // ১. Exact match (পুরো ডিসপ্লে-টেক্সট হুবহু মেলে, কেস-ইনসেনসিটিভ)
  const exactMatches = list.filter(item => textFn(item).trim().toLowerCase() === valLower);
  if (exactMatches.length === 1) return { type: 'exact', match: exactMatches[0] };
  if (exactMatches.length > 1) return { type: 'ambiguous', matches: exactMatches }; // ডুপ্লিকেট-নাম এজ-কেস

  // ২. Partial match
  const partial = list.filter(item => textFn(item).toLowerCase().includes(valLower));
  if (partial.length === 1) return { type: 'exact', match: partial[0] }; // একটাই মিলেছে — দ্ব্যর্থহীন
  if (partial.length > 1) return { type: 'ambiguous', matches: partial };

  return { type: 'none' };
}

// ════════════════════════════════════════════════════════════
// ✅ সাধারণ clamp হেল্পার — POS/Purchase-এর qty/price/discount
// ক্ল্যাম্প করতে ব্যবহৃত হয়, বিলিং-ইন্টিগ্রিটি রক্ষায়।
// ════════════════════════════════════════════════════════════
function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}
