'use strict';

// ════════════════════════════════════════════════════════════
// db-indexeddb.js — অফলাইন Write-Queue: স্টোরেজ লেয়ার
// এই ফাইল শুধু IndexedDB-তে read/write করে। কোনো Firestore call
// বা business logic এখানে নেই — সেটা sync-engine.js-এর কাজ (পরের ধাপ)।
// ════════════════════════════════════════════════════════════

const SYNC_DB_NAME = 'sohojtech-sync-db';
const SYNC_DB_VERSION = 2;
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
      let store;
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        store = db.createObjectStore(PENDING_STORE, { keyPath: 'tempId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('queuedAt', 'queuedAt', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      } else {
        // ✅ ধাপ ১৮: বিদ্যমান স্টোর (v1 থেকে upgrade) — শুধু নতুন ইনডেক্স যোগ
        store = e.target.transaction.objectStore(PENDING_STORE);
      }
      if (!store.indexNames.contains('uid')) {
        // ✅ ধাপ ১৮: cross-tenant leak ঠেকাতে — কোন এন্ট্রি কার, তা দিয়ে ফিল্টার করার জন্য
        store.createIndex('uid', 'uid', { unique: false });
      }
    };

    req.onsuccess = (e) => {
      _syncDbInstance = e.target.result;
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

  // ✅ ধাপ ১৮: uid ছাড়া queue করা মানে ভবিষ্যতে ভুল অ্যাকাউন্টে sync হওয়ার
  // ঝুঁকি — তাই uid না থাকলে queue করাই হবে না, বরং স্পষ্ট এরর দেবে।
  const uid = APP_STATE.currentUser?.uid;
  if (!uid) {
    throw new Error('ইউজার সনাক্ত করা যায়নি — অফলাইন এন্ট্রি নিরাপদে সংরক্ষণ করা সম্ভব হয়নি। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।');
  }

  const entry = {
    tempId: _genTempId(),
    uid, // ✅ ধাপ ১৮: এই queue-এন্ট্রি কোন Firestore অ্যাকাউন্টের, তা স্থায়ীভাবে বেঁধে রাখা হলো
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
  const uid = APP_STATE.currentUser?.uid;

  const all = await new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readonly');
    const req = tx.objectStore(PENDING_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });

  if (!uid) return []; // লগইন-পূর্ব অবস্থায় কোনো এন্ট্রি দেখানো নিরাপদ না

  // ✅ ধাপ ১৮ — মাইগ্রেশন: এই ফিক্সের আগে queue হওয়া পুরনো এন্ট্রিতে uid ফিল্ড
  // নেই। সেগুলোকে বর্তমানে লগইন করা ইউজারের বলে ধরে নিয়ে (best-effort,
  // একবারই) uid বসিয়ে persist করা হচ্ছে — যাতে এখন থেকে সঠিকভাবে ফিল্টার হয়।
  // এটা আগের অনির্ধারিত অবস্থার চেয়ে খারাপ কিছু করছে না, শুধু ভবিষ্যতের
  // জন্য ট্র্যাকিং নিশ্চিত করছে।
  const legacy = all.filter(e => !e.uid);
  if (legacy.length) {
    await Promise.all(legacy.map(e => _updateEntry(e.tempId, (entry) => { entry.uid = uid; })));
    legacy.forEach(e => { e.uid = uid; });
  }

  const list = all.filter(e => e.uid === uid);
  list.sort((a, b) => a.queuedAt - b.queuedAt);
  return list;
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

// ────────────────────────────────────────────────────────────
// RESET STUCK SYNCING ENTRIES — বুট-টাইমে কল হয়। গত সেশনে ট্যাব
// ক্র্যাশ/বন্ধ হয়ে গেলে কোনো এন্ট্রি 'syncing' অবস্থায় আটকে থেকে
// যেতে পারে (attemptSync() মাঝপথে থেমে গেছে, কখনো markFailed/
// removePendingWrite কল হয়নি)। সেগুলোকে আবার 'queued'-এ ফিরিয়ে
// দেওয়া হচ্ছে, নাহলে এই এন্ট্রি চিরকাল sync-এর যোগ্য বলে গণ্য
// হবে না (processPendingQueue()-এর ফিল্টার status !== 'syncing'
// এদের বাদ দিয়ে যাবে) — চিরতরে আটকে থাকবে।
// ────────────────────────────────────────────────────────────
async function resetStuckSyncingEntries() {
  const db = await initSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_STORE);
    const index = store.index('status');
    const req = index.openCursor(IDBKeyRange.only('syncing'));
    let resetCount = 0;

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        const entry = cursor.value;
        entry.status = 'queued';
        entry.lastError = null;
        cursor.update(entry);
        resetCount++;
        cursor.continue();
      }
    };
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => {
      if (resetCount > 0) console.log(`SyncDB: ${resetCount}টা আটকে থাকা 'syncing' এন্ট্রি 'queued'-এ ফিরিয়ে দেওয়া হলো।`);
      resolve(resetCount);
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ────────────────────────────────────────────────────────────
// CLEAR PENDING WRITES FOR CURRENT USER — ধাপ ১৯: "সম্পূর্ণ রিসেট"
// ফিচারের সাথে কল হয়। শুধু বর্তমান uid-এর এন্ট্রি মুছবে (ধাপ ১৮-এর
// uid-scoping ব্যবহার করে) — অন্য কোনো ইউজারের pending queue-তে হাত
// দেবে না, এমনকি একই ডিভাইসে থাকলেও।
// ────────────────────────────────────────────────────────────
async function clearPendingWritesForUser() {
  const uid = APP_STATE.currentUser?.uid;
  if (!uid) return 0;

  const db = await initSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING_STORE, 'readwrite');
    const store = tx.objectStore(PENDING_STORE);
    const index = store.index('uid');
    const req = index.openCursor(IDBKeyRange.only(uid));
    let deletedCount = 0;

    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        cursor.delete();
        deletedCount++;
        cursor.continue();
      }
    };
    req.onerror = () => reject(req.error);

    tx.oncomplete = () => {
      if (deletedCount > 0) console.log(`SyncDB: রিসেটের সময় ${deletedCount}টা pending sync এন্ট্রি মুছে ফেলা হলো।`);
      resolve(deletedCount);
    };
    tx.onerror = () => reject(tx.error);
  });
}
