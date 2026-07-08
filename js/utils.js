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