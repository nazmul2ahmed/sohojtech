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

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ════════════════════════════════════════════════════════════
// ইনভেন্টরি ডেরাইভড ফিল্ড — শেয়ার্ড হেল্পার
// batches array থেকে totalStock/costValue/mrpValue/nearestExpiry/status
// একসাথে ক্যালকুলেট করে। আগে এই লজিক inventory.js, pos.js, api-client.js —
// তিন জায়গায় আলাদাভাবে (এবং কোথাও অসম্পূর্ণভাবে, status/nearestExpiry
// বাদ দিয়ে) লেখা ছিল। stock<=0 ব্যাচ বাদ যায়, বাকিগুলো expiry অনুযায়ী
// sorted থাকে (nearestExpiry এই sorted[0] থেকেই আসে)।
// ════════════════════════════════════════════════════════════
function computeInventoryDerivedFields(batches, reorderLevel) {
  const validBatches = (batches || []).filter(b => (b.stock || 0) > 0);
  validBatches.sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1);

  const totalStock = validBatches.reduce((a, b) => a + b.stock, 0);
  const costValue = round2(validBatches.reduce((a, b) => a + b.cost * b.stock, 0));
  const mrpValue = round2(validBatches.reduce((a, b) => a + b.mrp * b.stock, 0));
  const nearestExpiry = validBatches[0]?.expiry || '';
  const rl = reorderLevel || 10;
  const status = totalStock === 0 ? 'out' : totalStock <= rl ? 'low' : 'ok';

  return { batches: validBatches, totalStock, costValue, mrpValue, nearestExpiry, status };
}
