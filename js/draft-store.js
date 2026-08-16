'use strict';

// ════════════════════════════════════════════════════════════
// DRAFT/CART STORAGE — POS ও Purchase দুটোতেই ব্যবহৃত shared utility।
// localStorage-ভিত্তিক (Firestore না — এগুলো ephemeral in-progress
// কাজ, চূড়ান্ত ডেটা না, সেভ/লোডে write/read খরচ করার দরকার নেই)।
// ⚠️ শুধু এই ডিভাইসে থাকে, অন্য ডিভাইসে সিঙ্ক হয় না।
// uid দিয়ে namespaced — একই ডিভাইসে ভিন্ন ইউজার লগইন করলে একজনের
// ড্রাফট আরেকজন দেখবে না।
// ════════════════════════════════════════════════════════════

const DRAFT_STORAGE_PREFIX = 'pharmacy-drafts-v1';

function _draftStorageKey(type) {
  const uid = APP_STATE.currentUser?.uid || 'anon';
  return `${DRAFT_STORAGE_PREFIX}-${type}-${uid}`;
}

function getDrafts(type) {
  try {
    const raw = localStorage.getItem(_draftStorageKey(type));
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn('Draft তালিকা পড়তে সমস্যা:', err);
    return [];
  }
}

function _saveDraftsList(type, list) {
  try {
    localStorage.setItem(_draftStorageKey(type), JSON.stringify(list));
  } catch (err) {
    console.warn('Draft সংরক্ষণে সমস্যা (localStorage quota/disabled হতে পারে):', err);
    toast('ড্রাফট সংরক্ষণ ব্যর্থ হয়েছে — ব্রাউজারের স্টোরেজে সমস্যা থাকতে পারে।', 'w');
  }
}

function addDraft(type, label, stateObj) {
  const list = getDrafts(type);
  const draft = { id: 'DRAFT-' + Date.now(), label, savedAt: new Date().toISOString(), state: stateObj };
  list.unshift(draft); // নতুনটা সবার উপরে
  _saveDraftsList(type, list);
  return draft;
}

function removeDraft(type, draftId) {
  const list = getDrafts(type).filter(d => d.id !== draftId);
  _saveDraftsList(type, list);
}

function getDraftCount(type) {
  return getDrafts(type).length;
}
