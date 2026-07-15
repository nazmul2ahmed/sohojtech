'use strict';

// ════════════════════════════════════════════════════════════
// db-indexeddb.js — অফলাইন Write-Queue: স্টোরেজ লেয়ার
// এই ফাইল শুধু IndexedDB-তে read/write করে। কোনো Firestore call
// বা business logic এখানে নেই — সেটা sync-engine.js-এর কাজ (পরের ধাপ)।
// ════════════════════════════════════════════════════════════

const SYNC_DB_NAME = 'sohojtech-sync-db';
const SYNC_DB_VERSION = 1;
const PENDING_STORE = 'pendingWrites';

let _syncDbInstance = null;

// ────────────────────────────────────────────────────────────
// INIT — একবার কল করলেই DB খোলা থাকে, বারবার কল করা নিরাপদ
// (ইতিমধ্যে খোলা থাকলে সেই instance-ই রিটার্ন করবে)
// ────────────────────────────────────────────────────────────
function initSyncDB() {
  if (_syncDbInstance) return Promise.resolve(_syncDbInstance);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        const store = db.createObjectStore(PENDING_STORE, { keyPath: 'tempId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _syncDbInstance = e.target.result;
      // ✅ ব্রাউজারকে অনুরোধ — এই সাইটের ডেটা যেন সহজে ইভিক্ট না করে
      // (storage-pressure হলেও pendingWrites যেন টিকে থাকে)
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
      resolve(_syncDbInstance);
    };

    req.onerror = (e) => {
      console.error('SyncDB খুলতে ব্যর্থ:', e.target.error);
      reject(e.target.error);
    };
  });
}

// ────────────────────────────────────────────────────────────
// tempId জেনারেটর — এটা শুধু queue-এন্ট্রি ট্র্যাক করার জন্য,
// Firestore document ID না (সেটা payload.invoiceNo/purchaseId থেকে আসবে)
// ────────────────────────────────────────────────────────────
function _genTempId() {
  return 'TEMP-' + Date.now() + '-' + Math.random().toString(36).substring(2, 8);
}

// ────────────────────────────────────────────────────────────
// QUEUE WRITE — নতুন এন্ট্রি যোগ করা
// type: 'sale' | 'purchase'  (এই ধাপে শুধু এই দুটো ব্যবহার হবে)
// payload: apiSubmitSale()/apiSubmitPurchase()-কে যা পাঠানো হতো, হুবহু তাই
// ────────────────────────────────────────────────────────────
async function queueWrite({ type, payload }) {
  const db = await initSyncDB();
  const entry = {
    tempId: _genTempId(),
    type,
    payload,
    status: 'queued',       // queued | syncing | failed
    queuedAt: Date.now(),
    attempts: 0,
    lastError: null,
    lastAttemptAt: null,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).add(entry);
    tx.oncomplete = () => resolve(entry.tempId);
    tx.onerror = () => reject(tx.error);
  });
}

// ────────────────────────────────────────────────────────────
// GET ALL PENDING — queuedAt অনুযায়ী sorted (FIFO অর্ডার)
// status ফিল্টার ছাড়া সব (queued + syncing + failed) রিটার্ন করে —
// UI-এর দরকার অনুযায়ী ফিল্টার করে নেবে
// ────────────────────────────────────────────────────────────
async function getPendingWrites() {
  const db = await initSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readonly');
    const req = tx.objectStore(PENDING_STORE).getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => a.queuedAt - b.queuedAt);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

// ────────────────────────────────────────────────────────────
// COUNT — header badge-এর জন্য দ্রুত সারাংশ
// { total, queued, syncing, failed }
// ────────────────────────────────────────────────────────────
async function getPendingWriteCount() {
  const list = await getPendingWrites();
  const counts = { total: list.length, queued: 0, syncing: 0, failed: 0 };
  list.forEach(e => { if (counts[e.status] !== undefined) counts[e.status]++; });
  return counts;
}

// ────────────────────────────────────────────────────────────
// STATUS UPDATE HELPERS — get → modify → put প্যাটার্ন
// (IndexedDB-তে partial update নেই, পুরো রেকর্ড আবার লিখতে হয়)
// ────────────────────────────────────────────────────────────
async function _updateEntry(tempId, mutateFn) {
  const db = await initSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_STORE);
    const getReq = store.get(tempId);
    getReq.onsuccess = () => {
      const entry = getReq.result;
      if (!entry) { resolve(null); return; }
      mutateFn(entry);
      store.put(entry);
    };
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function markSyncing(tempId) {
  return _updateEntry(tempId, (e) => {
    e.status = 'syncing';
    e.attempts += 1;
    e.lastAttemptAt = Date.now();
  });
}

async function markFailed(tempId, reason) {
  return _updateEntry(tempId, (e) => {
    e.status = 'failed';
    e.lastError = reason || 'অজানা সমস্যা';
    e.lastAttemptAt = Date.now();
  });
}

async function retryFailedWrite(tempId) {
  return _updateEntry(tempId, (e) => {
    e.status = 'queued';
    e.lastError = null;
  });
}

// ────────────────────────────────────────────────────────────
// REMOVE — সফল sync-এর পর, অথবা ইউজার ম্যানুয়ালি বাতিল করলে
// ────────────────────────────────────────────────────────────
async function removePendingWrite(tempId) {
  const db = await initSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    tx.objectStore(PENDING_STORE).delete(tempId);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

// discardFailedWrite — নামটা আলাদা রাখা হলো UI-স্পষ্টতার জন্য
// (removePendingWrite-এরই সমার্থক, কিন্তু "ইউজার ইচ্ছাকৃত বাতিল করেছে"
// বোঝাতে আলাদা ফাংশন নাম থাকা ভালো — ভবিষ্যতে audit-log যোগ করা সহজ হবে)
async function discardFailedWrite(tempId) {
  return removePendingWrite(tempId);
}
