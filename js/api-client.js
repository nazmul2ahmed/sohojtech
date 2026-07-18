'use strict';

function userCol(name) {
  return fbDb.collection('users').doc(APP_STATE.currentUser.uid).collection(name);
}

async function cget(ref) {
  // ✅ ফিক্স: source:'cache' জোর করা বাদ দেওয়া হলো। enablePersistence() চালু
  // থাকায় .get() নিজে থেকেই: অনলাইনে server থেকে fresh ডেটা আনে, অফলাইনে
  // স্বয়ংক্রিয়ভাবে cache-এ fallback করে। এতে মাল্টি-ডিভাইস stale-read বাগ থাকে না।
  return ref.get();
}

// ────────────────────────────────────────────────────────────
// MEDICINE
// ────────────────────────────────────────────────────────────
async function apiAddMedicine(data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const id = data.id || ('MED-' + Date.now());
    const ref = userCol('medicines').doc(id);
    const existing = await cget(ref);
    if (existing.exists) return { success: false, message: '"' + id + '" ইতোমধ্যে আছে — পুনরায় চেষ্টা করুন।' };
    await ref.set({
      id, brand: data.brand || '', generic: data.generic || '', doseForm: data.doseForm || '',
      strength: data.strength || '', manufacturer: data.manufacturer || '', category: data.category || '',
      unit: data.unit || 'পাতা', reorderLevel: parseInt(data.reorderLevel) || 10,
    });
    return { success: true, medId: id, message: '"' + data.brand + '" যোগ হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiUpdateMedicine(medId, data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const f = {};
    if (data.brand !== undefined) f.brand = data.brand;
    if (data.generic !== undefined) f.generic = data.generic;
    if (data.doseForm !== undefined) f.doseForm = data.doseForm;
    if (data.strength !== undefined) f.strength = data.strength;
    if (data.manufacturer !== undefined) f.manufacturer = data.manufacturer;
    if (data.category !== undefined) f.category = data.category;
    if (data.unit !== undefined) f.unit = data.unit;
    if (data.reorderLevel !== undefined) f.reorderLevel = parseInt(data.reorderLevel) || 10;
    await userCol('medicines').doc(medId).update(f);
    return { success: true, message: 'ওষুধ আপডেট হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteMedicine(medId) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const invDoc = await cget(userCol('inventory').doc(medId));
    if (invDoc.exists && (invDoc.data().totalStock || 0) > 0) {
      return { success: false, message: 'স্টক আছে। মুছতে হলে আগে স্টক শূন্য করুন।' };
    }
    await userCol('medicines').doc(medId).delete();
    return { success: true, message: 'ওষুধ মুছে ফেলা হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiSetInventoryRow(medId, data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try { await userCol('inventory').doc(medId).set(data); return { success: true }; }
  catch (err) { return { success: false, message: err.message }; }
}
async function apiUpdateInventoryFields(medId, fields) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try { await userCol('inventory').doc(medId).update(fields); return { success: true }; }
  catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// CUSTOMER
// ────────────────────────────────────────────────────────────
async function apiAddCustomer(data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const ref = userCol('customers').doc(data.id);
    const existing = await cget(ref);
    if (existing.exists) return { success: false, message: '"' + data.id + '" ইতোমধ্যে আছে।' };
    await ref.set({ id: data.id, name: data.name || '', phone: data.phone || '', address: data.address || '', due: 0, totalPaid: 0 });
    return { success: true, message: '"' + data.name + '" নিবন্ধিত হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiUpdateCustomer(custId, data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const f = {};
    if (data.name !== undefined) f.name = data.name;
    if (data.phone !== undefined) f.phone = data.phone;
    if (data.address !== undefined) f.address = data.address;
    await userCol('customers').doc(custId).update(f);
    return { success: true, message: 'গ্রাহক আপডেট হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteCustomer(custId) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const doc = await cget(userCol('customers').doc(custId));
    if (!doc.exists) return { success: false, message: 'গ্রাহক পাওয়া যায়নি।' };
    if ((doc.data().due || 0) > 0) return { success: false, message: '৳' + doc.data().due + ' বাকি আছে। পরিশোধের পর মুছুন।' };
    await userCol('customers').doc(custId).delete();
    return { success: true, message: 'গ্রাহক মুছে ফেলা হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiCollectCustomerDue(custId, currentDue, currentTotalPaid, amount, note, custData) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const custRef = userCol('customers').doc(custId);
    const paymentId = 'PAY-' + Date.now();

    await fbDb.runTransaction(async (tx) => {
      // ✅ ফিক্স: currentDue প্যারামিটার (client-side stale ডেটা) আর ব্যবহার হচ্ছে না হিসাবে —
      // transaction-এর ভেতরে fresh read করে সেটা থেকেই ভ্যালিডেশন ও হিসাব হচ্ছে
      const custDoc = await tx.get(custRef);
      if (!custDoc.exists) throw new Error('গ্রাহক পাওয়া যায়নি।');
      const c = custDoc.data();
      const freshDue = c.due || 0;
      const freshTotalPaid = c.totalPaid || 0;

      if (amount > freshDue + 0.01) {
        throw new Error(`বাকির (৳${fmt(freshDue)}) চেয়ে বেশি নেওয়া যাবে না।`);
      }

      tx.set(custRef, { id: custId, name: custData.name, phone: custData.phone || '', address: custData.address || '', due: round2(freshDue - amount), totalPaid: round2(freshTotalPaid + amount) }, { merge: true });
      tx.set(userCol('payments').doc(paymentId), { paymentId, date: todayStr(), customerId: custId, customerName: custData.name, amount, note: note || 'বাকি আদায়' });
    });

    return { success: true, message: `৳${fmt(amount)} আদায় হয়েছে।` };
  } catch (err) { return { success: false, message: err.message }; }
}
const OFFLINE_MSG = 'ইন্টারনেট সংযোগ নেই — এই মুহূর্তে সংরক্ষণ করা যাবে না। সংযোগ ফিরলে আবার চেষ্টা করুন।';
// ────────────────────────────────────────────────────────────
// SUPPLIER
// ────────────────────────────────────────────────────────────
async function apiAddSupplier(data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const ref = userCol('suppliers').doc(data.id);
    const existing = await cget(ref);
    if (existing.exists) return { success: false, message: '"' + data.id + '" ইতোমধ্যে আছে।' };
    await ref.set({ id: data.id, name: data.name || '', phone: data.phone || '', address: data.address || '', totalPayable: 0, totalPaid: 0 });
    return { success: true, message: '"' + data.name + '" যোগ হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiUpdateSupplier(supId, data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const f = {};
    if (data.name !== undefined) f.name = data.name;
    if (data.phone !== undefined) f.phone = data.phone;
    if (data.address !== undefined) f.address = data.address;
    await userCol('suppliers').doc(supId).update(f);
    return { success: true, message: 'সরবরাহকারী আপডেট হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteSupplier(supId) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const doc = await cget(userCol('suppliers').doc(supId));
    if (doc.exists && (doc.data().totalPayable || 0) > 0) {
      return { success: false, message: '৳' + doc.data().totalPayable + ' পাওনা আছে। পরিশোধের পর মুছুন।' };
    }
    await userCol('suppliers').doc(supId).delete();
    return { success: true, message: 'সরবরাহকারী মুছে ফেলা হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiPaySupplierPayable(supId, currentPayable, currentTotalPaid, amount, note, supData) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const supRef = userCol('suppliers').doc(supId);
    const paymentId = 'SPAY-' + Date.now();

    await fbDb.runTransaction(async (tx) => {
      // ✅ ফিক্স: currentPayable প্যারামিটার (client-side stale ডেটা) আর ব্যবহার হচ্ছে না
      // হিসাবে — transaction-এর ভেতরে fresh read করে সেটা থেকেই ভ্যালিডেশন ও হিসাব হচ্ছে
      const supDoc = await tx.get(supRef);
      if (!supDoc.exists) throw new Error('সরবরাহকারী পাওয়া যায়নি।');
      const s = supDoc.data();
      const freshPayable = s.totalPayable || 0;
      const freshTotalPaid = s.totalPaid || 0;

      if (amount > freshPayable + 0.01) {
        throw new Error(`পাওনার (৳${fmt(freshPayable)}) চেয়ে বেশি দেওয়া যাবে না।`);
      }

      tx.set(supRef, { id: supId, name: supData.name, phone: supData.phone || '', address: supData.address || '', totalPayable: round2(freshPayable - amount), totalPaid: round2(freshTotalPaid + amount) }, { merge: true });
      tx.set(userCol('supplierPayments').doc(paymentId), { paymentId, date: todayStr(), supplierId: supId, supplierName: supData.name, amount, note: note || 'পাওনা পরিশোধ' });
    });

    return { success: true, message: `৳${fmt(amount)} পরিশোধ করা হয়েছে।` };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// Connectivity-resilience হেল্পার
// navigator.onLine === true হলেও প্রকৃত সংযোগ না থাকতে পারে (fake-online —
// এয়ারপ্লেন মোড, ব্যর্থ WiFi ইত্যাদি)। Firestore transaction অফলাইনে
// কাজ করে না (নরমাল write-এর মতো লোকাল queue হয় না), তাই client-side
// timeout race বাধ্যতামূলক — নাহলে UI চিরকাল "প্রক্রিয়াকরণ হচ্ছে..." দেখাবে
// এবং এন্ট্রি কোথাও সংরক্ষিত না হয়েই হারিয়ে যাবে।
// ────────────────────────────────────────────────────────────
const FIRESTORE_WRITE_TIMEOUT_MS = 10000;     // ১০ সেকেন্ড — এর বেশি অপেক্ষা করা হবে না

class FirestoreTimeoutError extends Error {
  constructor(msg) { super(msg); this.code = 'client-timeout'; }
}

function withTimeout(promise, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new FirestoreTimeoutError('নির্ধারিত সময়ে সার্ভার সাড়া দেয়নি।')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

// navigator.onLine সত্য বলছে, কিন্তু transaction আসলে network-জনিত কারণে
// ব্যর্থ হয়েছে কিনা তা শনাক্ত করে — যাতে এটাকে ব্যবসায়িক এরর (যেমন
// "স্টক অপর্যাপ্ত") এর সাথে গুলিয়ে না ফেলি।
function isConnectivityError(err) {
  if (!err) return false;
  const netCodes = ['unavailable', 'deadline-exceeded', 'cancelled', 'internal', 'unknown', 'aborted', 'resource-exhausted', 'client-timeout'];
  if (err.code && netCodes.includes(err.code)) return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('offline') || msg.includes('network') || msg.includes('backend didn') || msg.includes('failed to get document');
}

// অফলাইন-queue-এ পাঠানোর কমন লজিক — সরাসরি অফলাইন-ব্রাঞ্চ থেকেও,
// আর fake-online fallback থেকেও — দুই জায়গা থেকেই ব্যবহৃত হবে
async function queueSaleOffline(sale) {
  try {
    await queueWrite({ type: 'sale', payload: sale });
    APP_STATE.pendingSales = APP_STATE.pendingSales || [];
    APP_STATE.pendingSales.push(sale);
    return { success: true, queued: true, message: `অফলাইনে সংরক্ষিত হয়েছে — Invoice: ${sale.invoiceNo}। নেট ফিরলে স্বয়ংক্রিয় সিঙ্ক হবে।` };
  } catch (err) {
    return { success: false, message: 'অফলাইন সংরক্ষণেও ব্যর্থ: ' + err.message };
  }
}

async function queuePurchaseOffline(purchase) {
  try {
    await queueWrite({ type: 'purchase', payload: purchase });
    APP_STATE.pendingPurchases = APP_STATE.pendingPurchases || [];
    APP_STATE.pendingPurchases.push(purchase);
    return { success: true, queued: true, message: `অফলাইনে সংরক্ষিত হয়েছে — Purchase: ${purchase.purchaseId}। নেট ফিরলে স্বয়ংক্রিয় সিঙ্ক হবে।` };
  } catch (err) {
    return { success: false, message: 'অফলাইন সংরক্ষণেও ব্যর্থ: ' + err.message };
  }
}

// ────────────────────────────────────────────────────────────
// SALE (POS)
// ────────────────────────────────────────────────────────────
function computeFEFODeduction(invData, qty) {
  const batches = (invData.batches || []).map(b => ({ ...b }));
  batches.sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1);
  let remaining = qty;
  let totalCost = 0;
  const consumed = []; // ✅ কোন batchId থেকে কত ইউনিট + কী cost-এ কাটা হলো — restock/return-এর জন্য দরকার

  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(b.stock, remaining);
    if (take > 0) {
      totalCost += take * (b.cost || 0);
      consumed.push({ batchId: b.batchId, qty: take, cost: b.cost || 0 });
      b.stock -= take;
      remaining -= take;
    }
  }
  if (remaining > 0) return null;

  const rb = batches.filter(b => b.stock > 0);
  return {
    batches: rb,
    totalStock: rb.reduce((a, b) => a + b.stock, 0),
    costValue: round2(rb.reduce((a, b) => a + b.cost * b.stock, 0)),
    mrpValue: round2(rb.reduce((a, b) => a + b.mrp * b.stock, 0)),
    nearestExpiry: rb[0]?.expiry || '',
    weightedCost: round2(totalCost / qty), // ✅ একাধিক ব্যাচ থেকে কাটলে সঠিক গড় COGS
    consumedBatches: consumed,             // ✅ পরে ফেরত/রিটার্নে সঠিক ব্যাচে বসাতে
  };
}

// ✅ কমন হেল্পার: sale/return item-এর consumedBatches অনুযায়ী ঠিক সেই ব্যাচেই স্টক
// ফেরত দেয় যেখান থেকে আসলে কাটা হয়েছিল। consumedBatches না থাকলে (ফিক্সের আগের
// পুরনো রেকর্ড) fallback হিসেবে batches[0]-এ ঢালে — আগের আচরণের সাথে সামঞ্জস্যপূর্ণ।
function restockBatchesFromConsumed(batches, item, fallbackBatchIdPrefix, sellFallback) {
  if (item.consumedBatches && item.consumedBatches.length) {
    item.consumedBatches.forEach(cb => {
      const target = batches.find(b => b.batchId === cb.batchId);
      if (target) target.stock += cb.qty;
      else batches.push({ batchId: cb.batchId, expiry: '', stock: cb.qty, cost: cb.cost, mrp: 0, sell: sellFallback || 0 });
    });
  } else {
    if (batches.length) batches[0] = { ...batches[0], stock: batches[0].stock + item.qty };
    else batches.push({ batchId: fallbackBatchIdPrefix + '-' + Date.now(), expiry: '', stock: item.qty, cost: item.costPrice || 0, mrp: 0, sell: sellFallback || 0 });
  }
  return batches;
}

async function apiSubmitSale(sale, opts = {}) {
  const isRetry = !!opts.isRetry;

  if (!navigator.onLine) {
    if (isRetry) return { success: false, message: 'এখনো অফলাইন — পরের সাইকেলে আবার চেষ্টা হবে।' };
    return await queueSaleOffline(sale);
  }

  try {
    const invRefs = sale.items.map(item => userCol('inventory').doc(item.medId));
    const hasCustomer = sale.customerId && sale.customerId !== 'WALK_IN';
    const custRef = hasCustomer ? userCol('customers').doc(sale.customerId) : null;
    const saleRef = userCol('sales').doc(sale.invoiceNo);

    await withTimeout(fbDb.runTransaction(async (tx) => {
      const existingSaleDoc = await tx.get(saleRef);
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const custDoc = custRef ? await tx.get(custRef) : null;

      if (existingSaleDoc.exists) {
        // ইতিমধ্যে সফলভাবে সংরক্ষিত — নিরাপদে no-op, ডাবল-ডিডাকশন রোধ
        return;
      }

      const invUpdates = [];
      for (let i = 0; i < sale.items.length; i++) {
        const item = sale.items[i], invDoc = invDocs[i];
        if (!invDoc.exists) throw new Error(`"${item.name}" ইনভেন্টরিতে পাওয়া যায়নি।`);
        const result = computeFEFODeduction(invDoc.data(), item.qty);
        if (!result) throw new Error(`"${item.name}" স্টক অপর্যাপ্ত।`);

        // ✅ ফিক্স: প্রথম-ব্যাচের cost না — একাধিক ব্যাচ থেকে কাটা হলে সঠিক
        // weighted-average COGS এখন sale.items-এ বসানো হচ্ছে, commit হওয়ার আগেই।
        item.costPrice = result.weightedCost;
        item.consumedBatches = result.consumedBatches;

        // ✅ ফিক্স (ধাপ ২৩): computeInventoryDerivedFields() দিয়ে
        // status/nearestExpiry-সহ সব ফিল্ড ঠিকভাবে রিক্যালকুলেট
        const med = APP_STATE.medicines.find(m => m.id === item.medId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
        const derived = computeInventoryDerivedFields(result.batches, reorderLevel);

        invUpdates.push({
          ref: invRefs[i],
          fields: {
            batches: derived.batches,
            totalStock: derived.totalStock,
            costValue: derived.costValue,
            mrpValue: derived.mrpValue,
            nearestExpiry: derived.nearestExpiry,
            status: derived.status,
          },
        });
      }

      let custUpdate = null;
      if (custRef && custDoc && custDoc.exists) {
        const c = custDoc.data();
        custUpdate = {
          due: round2((c.due || 0) + (sale.due || 0)),
          totalPaid: round2((c.totalPaid || 0) + (sale.cashPaid || 0)),
        };
      }

      tx.set(saleRef, sale);
      invUpdates.forEach(u => tx.update(u.ref, u.fields));
      if (custRef && custUpdate) tx.update(custRef, custUpdate);
    }), FIRESTORE_WRITE_TIMEOUT_MS);

    return { success: true, message: `বিক্রয় সফল! Invoice: ${sale.invoiceNo}` };
  } catch (err) {
    if (isConnectivityError(err)) {
      if (isRetry) {
        return { success: false, message: 'নেট সংযোগ অস্থির — একটু পর আবার চেষ্টা হবে।' };
      }
      return await queueSaleOffline(sale);
    }
    return { success: false, message: err.message };
  }
}

async function apiDeleteSale(sale) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(sale.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));
    const hasCustomer = sale.customerId && sale.customerId !== 'WALK_IN';
    const custRef = hasCustomer ? userCol('customers').doc(sale.customerId) : null;

    await fbDb.runTransaction(async (tx) => {
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const custDoc = custRef ? await tx.get(custRef) : null;

      const invMap = {};
      uniqueMedIds.forEach((id, i) => { invMap[id] = { ref: invRefs[i], data: invDocs[i].exists ? { ...invDocs[i].data() } : null, medId: id }; });

      sale.items.forEach(item => {
        const e = invMap[item.medId]; if (!e.data) return;
        // ✅ ফিক্স: batches[0]-এ ঢালার বদলে item.consumedBatches অনুযায়ী
        // ঠিক সেই ব্যাচেই স্টক ফেরত — batch-wise expiry/cost integrity বজায় থাকে
        e.data.batches = restockBatchesFromConsumed([...(e.data.batches || [])], item, 'BAT-VOID', e.data.sellPrice);
      });

      let custFields = null;
      if (custRef && custDoc && custDoc.exists) {
        custFields = { due: Math.max(0, round2((custDoc.data().due || 0) - (sale.due || 0))), totalPaid: Math.max(0, round2((custDoc.data().totalPaid || 0) - (sale.cashPaid || 0))) };
      }

      tx.delete(userCol('sales').doc(sale.invoiceNo));
      Object.values(invMap).forEach(e => {
        if (!e.data) return;
        // ✅ ফিক্স (ধাপ ২৩): status/nearestExpiry এখন সঠিকভাবে রিক্যালকুলেট
        const med = APP_STATE.medicines.find(m => m.id === e.medId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
        const derived = computeInventoryDerivedFields(e.data.batches, reorderLevel);
        tx.set(e.ref, {
          ...e.data,
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          status: derived.status,
        }, { merge: true });
      });
      if (custRef && custFields) tx.update(custRef, custFields);
    });

    return { success: true, message: 'বিক্রয় মুছে ফেলা হয়েছে, স্টক/বাকি ফেরত হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}


// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// PURCHASE — apiSubmitPurchase (✅ computeInventoryDerivedFields ব্যবহার করছে)
// ────────────────────────────────────────────────────────────
async function apiSubmitPurchase(purchase, opts = {}) {
  const isRetry = !!opts.isRetry;

  if (!navigator.onLine) {
    if (isRetry) return { success: false, message: 'এখনো অফলাইন — পরের সাইকেলে আবার চেষ্টা হবে।' };
    return await queuePurchaseOffline(purchase);
  }

  try {
    const invRefs = purchase.items.map(item => userCol('inventory').doc(item.medId));
    const supRef = userCol('suppliers').doc(purchase.supplierId);
    const purRef = userCol('purchases').doc(purchase.purchaseId);

    await withTimeout(fbDb.runTransaction(async (tx) => {
      // ✅ সব read আগে
      const existingPurDoc = await tx.get(purRef);
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const supDoc = await tx.get(supRef);

      if (existingPurDoc.exists) {
        // ইতিমধ্যে সফলভাবে সংরক্ষিত — no-op
        return;
      }

      const invUpdates = purchase.items.map((item, idx) => {
        const invDoc = invDocs[idx];
        const newBatch = { batchId: 'BAT-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 1000), expiry: item.expiryDate || '', stock: item.qty, cost: item.purchasePrice, mrp: item.mrp, sell: item.sellPrice || 0 };
        item.batchId = newBatch.batchId; // delete-এর সময় সঠিক ব্যাচ খুঁজতে
        const existing = invDoc.exists ? invDoc.data() : null;
        const rawBatches = [...(existing?.batches || []), newBatch];
        const reorderLevel = item.reorderLevel || 10;

        // ✅ ফিক্স (ধাপ ২৩, রিফ্যাক্টর): shared হেল্পার — status/nearestExpiry সহ সব ফিল্ড
        const derived = computeInventoryDerivedFields(rawBatches, reorderLevel);

        const fields = {
          medId: item.medId, brand: item.brand, doseForm: item.doseForm || '', strength: item.strength || '',
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          sellPrice: item.sellPrice > 0 ? item.sellPrice : (existing?.sellPrice || 0),
          status: derived.status,
        };
        return { ref: invRefs[idx], fields, exists: invDoc.exists };
      });

      let supUpdate = null;
      if (supDoc.exists) {
        const sup = supDoc.data();
        supUpdate = purchase.paymentType === 'বাকি' ? { totalPayable: round2((sup.totalPayable || 0) + purchase.totalCost) } : { totalPaid: round2((sup.totalPaid || 0) + purchase.totalCost) };
      }

      // ✅ সব write পরে
      tx.set(purRef, purchase);
      invUpdates.forEach(u => { if (u.exists) tx.update(u.ref, u.fields); else tx.set(u.ref, u.fields); });
      if (supUpdate) tx.update(supRef, supUpdate);
    }), FIRESTORE_WRITE_TIMEOUT_MS);

    return { success: true, message: `ক্রয় রেকর্ড হয়েছে! Invoice: ${purchase.purchaseId}` };
  } catch (err) {
    if (isConnectivityError(err)) {
      if (isRetry) {
        return { success: false, message: 'নেট সংযোগ অস্থির — একটু পর আবার চেষ্টা হবে।' };
      }
      return await queuePurchaseOffline(purchase);
    }
    return { success: false, message: err.message };
  }
}

async function apiDeletePurchase(purchase) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const invRefs = purchase.items.map(i => userCol('inventory').doc(i.medId));
    const supRef = userCol('suppliers').doc(purchase.supplierId);

    await fbDb.runTransaction(async (tx) => {
      // ✅ সব read আগে
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const supDoc = await tx.get(supRef);

      const invUpdates = purchase.items.map((item, idx) => {
        const invDoc = invDocs[idx]; if (!invDoc.exists) return null;
        const inv = invDoc.data();
        const remainingBatches = (inv.batches || []).filter(b => b.batchId !== item.batchId);
        // ✅ ফিক্স (ধাপ ২৩): status/nearestExpiry এখন সঠিকভাবে রিক্যালকুলেট
        const med = APP_STATE.medicines.find(m => m.id === item.medId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
        const derived = computeInventoryDerivedFields(remainingBatches, reorderLevel);
        return {
          ref: invRefs[idx],
          fields: {
            batches: derived.batches,
            totalStock: derived.totalStock,
            costValue: derived.costValue,
            mrpValue: derived.mrpValue,
            nearestExpiry: derived.nearestExpiry,
            status: derived.status,
          },
        };
      }).filter(Boolean);

      let supFields = null;
      if (supDoc.exists) {
        const sup = supDoc.data();
        supFields = purchase.paymentType === 'বাকি' ? { totalPayable: Math.max(0, round2((sup.totalPayable || 0) - purchase.totalCost)) } : { totalPaid: Math.max(0, round2((sup.totalPaid || 0) - purchase.totalCost)) };
      }

      // ✅ সব write পরে
      tx.delete(userCol('purchases').doc(purchase.purchaseId));
      invUpdates.forEach(u => tx.update(u.ref, u.fields));
      if (supFields) tx.update(supRef, supFields);
    });

    return { success: true, message: 'ক্রয় মুছে ফেলা হয়েছে, স্টক/পাওনা ফেরত হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// RETURNS
// ────────────────────────────────────────────────────────────
async function apiSubmitCustomerReturn(returnDoc, custId, custDueReduction) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(returnDoc.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));
    const custRef = custDueReduction > 0 ? userCol('customers').doc(custId) : null;

    await fbDb.runTransaction(async (tx) => {
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const custDoc = custRef ? await tx.get(custRef) : null;

      const invMap = {};
      uniqueMedIds.forEach((id, idx) => { invMap[id] = { ref: invRefs[idx], data: invDocs[idx].exists ? { ...invDocs[idx].data() } : null, medId: id }; });

      returnDoc.items.forEach(item => {
        const e = invMap[item.medId]; if (!e.data) return;
        // ✅ ফিক্স: consumedBatches অনুযায়ী সঠিক ব্যাচে ফেরত
        e.data.batches = restockBatchesFromConsumed([...(e.data.batches || [])], item, 'BAT-RET', e.data.sellPrice);
      });

      let custFields = null;
      if (custRef && custDoc && custDoc.exists) {
        custFields = { due: round2((custDoc.data().due || 0) - custDueReduction) };
      }

      tx.set(userCol('returns').doc(returnDoc.returnId), returnDoc);
      Object.values(invMap).forEach(e => {
        if (!e.data) return;
        // ✅ ফিক্স (ধাপ ২৩): status/nearestExpiry এখন সঠিকভাবে রিক্যালকুলেট
        const med = APP_STATE.medicines.find(m => m.id === e.medId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
        const derived = computeInventoryDerivedFields(e.data.batches, reorderLevel);
        tx.set(e.ref, {
          ...e.data,
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          status: derived.status,
        }, { merge: true });
      });
      if (custRef && custFields) tx.update(custRef, custFields);
    });

    return { success: true, message: 'রিটার্ন সফল হয়েছে!' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiSubmitSupplierReturn(returnDoc, supId, supPayableReduction) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(returnDoc.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));
    const supRef = supPayableReduction > 0 ? userCol('suppliers').doc(supId) : null;

    await fbDb.runTransaction(async (tx) => {
      // ✅ সব read আগে
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const supDoc = supRef ? await tx.get(supRef) : null;

      const invMap = {};
      uniqueMedIds.forEach((id, idx) => { invMap[id] = { ref: invRefs[idx], data: invDocs[idx].exists ? { ...invDocs[idx].data() } : null, medId: id }; });

      returnDoc.items.forEach(item => {
        const e = invMap[item.medId]; if (!e.data) return;
        let batches = [...(e.data.batches || [])];
        batches.sort((a, b) => (b.expiry || '0000') > (a.expiry || '0000') ? 1 : -1);
        let remaining = item.qty;
        batches = batches.map(b => { if (remaining <= 0) return b; const take = Math.min(b.stock, remaining); remaining -= take; return { ...b, stock: b.stock - take }; }).filter(b => b.stock > 0);
        e.data.batches = batches;
      });

      let supFields = null;
      if (supRef && supDoc && supDoc.exists) {
        supFields = { totalPayable: Math.max(0, round2((supDoc.data().totalPayable || 0) - supPayableReduction)) };
      }

      // ✅ সব write পরে
      tx.set(userCol('returns').doc(returnDoc.returnId), returnDoc);
      Object.values(invMap).forEach(e => {
        if (!e.data) return;
        // ✅ ফিক্স (ধাপ ২৩): status/nearestExpiry এখন সঠিকভাবে রিক্যালকুলেট
        const med = APP_STATE.medicines.find(m => m.id === e.medId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
        const derived = computeInventoryDerivedFields(e.data.batches, reorderLevel);
        tx.set(e.ref, {
          ...e.data,
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          status: derived.status,
        }, { merge: true });
      });
      if (supRef && supFields) tx.update(supRef, supFields);
    });

    return { success: true, message: returnDoc.reason === 'ধ্বংস' ? 'মেয়াদোত্তীর্ণ পণ্য রাইট-অফ হয়েছে!' : 'সাপ্লায়ার রিটার্ন সফল!' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteReturn(ret) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(ret.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));

    let partyRef = null;
    if (ret.returnType === 'customer' && ret.refundMethod === 'বাকি সমন্বয়') {
      partyRef = userCol('customers').doc(ret.partyId);
    } else if (ret.returnType === 'supplier' && ret.reason === 'ফেরত' && ret.refundMethod === 'পাওনা সমন্বয়') {
      partyRef = userCol('suppliers').doc(ret.partyId);
    }

    await fbDb.runTransaction(async (tx) => {
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const partyDoc = partyRef ? await tx.get(partyRef) : null;

      const invMap = {};
      uniqueMedIds.forEach((id, i) => { invMap[id] = { ref: invRefs[i], data: invDocs[i].exists ? { ...invDocs[i].data() } : null, medId: id }; });

      if (ret.returnType === 'customer') {
        ret.items.forEach(item => {
          const e = invMap[item.medId]; if (!e.data) return;
          let batches = [...(e.data.batches || [])];
          if (item.consumedBatches && item.consumedBatches.length) {
            // ✅ ফিক্স: precise undo — ঠিক যে ব্যাচে return-এর সময় স্টক যোগ হয়েছিল, সেখান থেকেই বাদ
            item.consumedBatches.forEach(cb => {
              const target = batches.find(b => b.batchId === cb.batchId);
              if (target) target.stock = Math.max(0, target.stock - cb.qty);
            });
            batches = batches.filter(b => b.stock > 0);
          } else {
            // ফলব্যাক: পুরনো রেকর্ড — generic FEFO destock
            let remaining = item.qty;
            batches = batches.map(b => { if (remaining <= 0) return b; const take = Math.min(b.stock, remaining); remaining -= take; return { ...b, stock: b.stock - take }; }).filter(b => b.stock > 0);
          }
          e.data.batches = batches;
        });
      } else {
        ret.items.forEach(item => {
          const e = invMap[item.medId]; if (!e.data) return;
          const batches = [...(e.data.batches || [])];
          if (batches.length) batches[0] = { ...batches[0], stock: batches[0].stock + item.qty };
          else batches.push({ batchId: 'BAT-VOID-' + Date.now(), expiry: '', stock: item.qty, cost: item.purchasePrice || 0, mrp: 0, sell: e.data.sellPrice || 0 });
          e.data.batches = batches;
        });
      }

      let partyFields = null;
      if (partyRef && partyDoc && partyDoc.exists) {
        if (ret.returnType === 'customer') {
          partyFields = { due: round2((partyDoc.data().due || 0) + ret.amount) };
        } else {
          partyFields = { totalPayable: round2((partyDoc.data().totalPayable || 0) + ret.amount) };
        }
      }

      tx.delete(userCol('returns').doc(ret.returnId));
      Object.values(invMap).forEach(e => {
        if (!e.data) return;
        // ✅ ফিক্স (ধাপ ২৩): status/nearestExpiry এখন সঠিকভাবে রিক্যালকুলেট
        const med = APP_STATE.medicines.find(m => m.id === e.medId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;
        const derived = computeInventoryDerivedFields(e.data.batches, reorderLevel);
        tx.set(e.ref, {
          ...e.data,
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          status: derived.status,
        }, { merge: true });
      });
      if (partyRef && partyFields) tx.update(partyRef, partyFields);
    });

    return { success: true, message: 'রিটার্ন মুছে ফেলা হয়েছে, প্রভাব উল্টানো হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// EXPENSE / SETTINGS / OPENING BALANCE
// ────────────────────────────────────────────────────────────
async function apiAddExpense(exp) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try { await userCol('expenses').doc(exp.id).set(exp); return { success: true }; }
  catch (err) { return { success: false, message: err.message }; }
}
async function apiDeleteExpense(expId) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try { await userCol('expenses').doc(expId).delete(); return { success: true }; }
  catch (err) { return { success: false, message: err.message }; }
}
async function apiSaveSettings(data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try { await userCol('config').doc('settings').set(data, { merge: true }); return { success: true }; }
  catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// OPENING BALANCE — apiSubmitOpeningEntry (✅ computeInventoryDerivedFields ব্যবহার করছে)
// ────────────────────────────────────────────────────────────
async function apiSubmitOpeningEntry(entry) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const entryRef = userCol('openingEntries').doc(entry.entryId);
    const invRef = entry.category === 'স্টক' ? userCol('inventory').doc(entry.medicineId) : null;
    const custRef = entry.category === 'গ্রাহক বাকি' ? userCol('customers').doc(entry.clientId) : null;
    const supRef = entry.category === 'সরবরাহকারী বাকি' ? userCol('suppliers').doc(entry.supplierId) : null;

    await fbDb.runTransaction(async (tx) => {
      // ✅ সব read আগে
      const invDoc = invRef ? await tx.get(invRef) : null;
      const custDoc = custRef ? await tx.get(custRef) : null;
      const supDoc = supRef ? await tx.get(supRef) : null;

      // ✅ কম্পিউট (কোনো write এখনো হয়নি)
      let invFields = null, invExists = false;
      if (invRef) {
        const existing = invDoc.exists ? invDoc.data() : null;
        const newBatch = { batchId: entry.batchId, expiry: entry.expiryDate || '', stock: entry.qty, cost: entry.costPrice, mrp: entry.mrp, sell: entry.sellPrice };
        const rawBatches = [...(existing?.batches || []), newBatch];

        const med = APP_STATE.medicines.find(m => m.id === entry.medicineId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;

        // ✅ ফিক্স (ধাপ ২৩, রিফ্যাক্টর): shared হেল্পার — আগে nearestExpiry/status
        // এখানে existing ভ্যালু বা হার্ডকোড 'ok' থেকে যেত, নতুন ব্যাচ যোগ হওয়ার
        // পরও রিক্যালকুলেট হতো না। এখন সঠিকভাবে recalculate হচ্ছে।
        const derived = computeInventoryDerivedFields(rawBatches, reorderLevel);

        invFields = {
          medId: entry.medicineId, brand: entry.brand || existing?.brand || '',
          doseForm: existing?.doseForm || '', strength: existing?.strength || '',
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          sellPrice: entry.sellPrice > 0 ? entry.sellPrice : (existing?.sellPrice || 0),
          status: derived.status,
        };
        invExists = invDoc.exists;
      }

      let custFields = null;
      if (custRef && custDoc.exists) {
        custFields = { due: round2((custDoc.data().due || 0) + entry.amount) };
      }

      let supFields = null;
      if (supRef && supDoc.exists) {
        supFields = { totalPayable: round2((supDoc.data().totalPayable || 0) + entry.amount) };
      }

      // ✅ সব write পরে
      tx.set(entryRef, entry);
      if (invRef && invFields) { if (invExists) tx.update(invRef, invFields); else tx.set(invRef, invFields); }
      if (custRef && custFields) tx.update(custRef, custFields);
      if (supRef && supFields) tx.update(supRef, supFields);
    });

    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteOpeningEntry(entry) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const entryRef = userCol('openingEntries').doc(entry.entryId);
    const invRef = (entry.category === 'স্টক' && entry.batchId) ? userCol('inventory').doc(entry.medicineId) : null;
    const custRef = (entry.category === 'গ্রাহক বাকি' && entry.clientId) ? userCol('customers').doc(entry.clientId) : null;
    const supRef = (entry.category === 'সরবরাহকারী বাকি' && entry.supplierId) ? userCol('suppliers').doc(entry.supplierId) : null;

    await fbDb.runTransaction(async (tx) => {
      // ✅ সব read আগে
      const invDoc = invRef ? await tx.get(invRef) : null;
      const custDoc = custRef ? await tx.get(custRef) : null;
      const supDoc = supRef ? await tx.get(supRef) : null;

      // ✅ কম্পিউট
      let invFields = null;
      if (invRef && invDoc.exists) {
        const inv = invDoc.data();
        const rawBatches = (inv.batches || []).filter(b => b.batchId !== entry.batchId);

        const med = APP_STATE.medicines.find(m => m.id === entry.medicineId);
        const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;

        // ✅ ফিক্স (ধাপ ২৩, রিফ্যাক্টর): shared হেল্পার — আগে শুধু
        // totalStock/costValue/mrpValue লেখা হতো, status/nearestExpiry
        // Firestore-এ stale থেকে যেত ব্যাচ ডিলিটের পরও। এখন সব ফিল্ড
        // সঠিকভাবে রিক্যালকুলেট হচ্ছে।
        const derived = computeInventoryDerivedFields(rawBatches, reorderLevel);

        invFields = {
          batches: derived.batches,
          totalStock: derived.totalStock,
          costValue: derived.costValue,
          mrpValue: derived.mrpValue,
          nearestExpiry: derived.nearestExpiry,
          status: derived.status,
        };
      }

      let custFields = null;
      if (custRef && custDoc.exists) {
        custFields = { due: Math.max(0, round2((custDoc.data().due || 0) - entry.amount)) };
      }

      let supFields = null;
      if (supRef && supDoc.exists) {
        supFields = { totalPayable: Math.max(0, round2((supDoc.data().totalPayable || 0) - entry.amount)) };
      }

      // ✅ সব write পরে
      tx.delete(entryRef);
      if (invRef && invFields) tx.update(invRef, invFields);
      if (custRef && custFields) tx.update(custRef, custFields);
      if (supRef && supFields) tx.update(supRef, supFields);
    });

    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// getCompleteData — ✅ এটাও cache-first (অফলাইনে app বুট করতেও দ্রুত/নির্ভরযোগ্য হবে)
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// HISTORY CUTOFF HELPER — ১২ মাসের boundary
// ────────────────────────────────────────────────────────────
function getCutoffDateStr() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().split('T')[0];
}

// ────────────────────────────────────────────────────────────
// getCompleteData — ✅ ধাপ ২৭: sales/purchases/returns-এ
// orderBy('date','desc').limit(HISTORY_CAP) যোগ হলো — cutoff (১২ মাস)
// অক্ষত থাকছে, কিন্তু ভলিউম-ভারী দোকানে বুট-টাইমে সাম্প্রতিক ৮,০০০
// ডকুমেন্টের বেশি একসাথে লোড হবে না। expenses/payments/supplierPayments
// কম-ভলিউম বলে uncapped রাখা হলো (শুধু cutoff filter)।
//
// orderBy+limit-এর কারণে ডকুমেন্ট এখন নতুন→পুরনো অর্ডারে আসে, কিন্তু
// বাকি সব মডিউল (accounts.js, analytics.js, dashboard.js) chronological
// (পুরনো→নতুন) অর্ডার প্রত্যাশা করে — তাই .reverse() করে ফেরত দেওয়া
// হচ্ছে, বিদ্যমান বিহেভিয়ার অক্ষুণ্ণ রাখতে।
//
// cap ছুঁয়ে গেলে (docs.length === cap) capReached ফ্ল্যাগ true হবে —
// Returns dropdown ও Analytics ট্যাবে এটা ইউজারকে "পুরনো ডেটা এখনো
// লোড হয়নি" জানাতে ব্যবহৃত হয় (দেখুন returns.js/analytics.js)।
// ────────────────────────────────────────────────────────────
async function apiGetCompleteData() {
  try {
    const cutoff = getCutoffDateStr();
    const HISTORY_CAP = 8000;

    const salesQuery = userCol('sales').where('date', '>=', cutoff).orderBy('date', 'desc').limit(HISTORY_CAP);
    const purQuery = userCol('purchases').where('date', '>=', cutoff).orderBy('date', 'desc').limit(HISTORY_CAP);
    const retQuery = userCol('returns').where('date', '>=', cutoff).orderBy('date', 'desc').limit(HISTORY_CAP);

    const [medSnap, custSnap, supSnap, invSnap, saleSnap, purSnap, retSnap, expSnap, paySnap, supPaySnap, obSnap, settingsDoc] = await Promise.all([
      cget2(userCol('medicines')), cget2(userCol('customers')), cget2(userCol('suppliers')), cget2(userCol('inventory')),
      cget2(salesQuery),
      cget2(purQuery),
      cget2(retQuery),
      cget2(userCol('expenses').where('date', '>=', cutoff)),
      cget2(userCol('payments').where('date', '>=', cutoff)),
      cget2(userCol('supplierPayments').where('date', '>=', cutoff)),
      cget2(userCol('openingEntries')),
      cgetDoc(userCol('config').doc('settings')),
    ]);
    const settings = settingsDoc.exists ? settingsDoc.data() : {};

    // ✅ orderBy('date','desc') দিয়ে আনা হয়েছে বলে chronological অর্ডারে ফেরাতে reverse()
    const sales = saleSnap.docs.map(d => d.data()).reverse();
    const purchases = purSnap.docs.map(d => d.data()).reverse();
    const returns = retSnap.docs.map(d => d.data()).reverse();

    const capReached = {
      sales: saleSnap.docs.length >= HISTORY_CAP,
      purchases: purSnap.docs.length >= HISTORY_CAP,
      returns: retSnap.docs.length >= HISTORY_CAP,
    };

    return {
      success: true,
      medicines: medSnap.docs.map(d => d.data()), customers: custSnap.docs.map(d => d.data()),
      suppliers: supSnap.docs.map(d => d.data()), inventory: invSnap.docs.map(d => d.data()),
      sales, purchases, returns,
      expenses: expSnap.docs.map(d => d.data()),
      payments: paySnap.docs.map(d => d.data()), supplierPayments: supPaySnap.docs.map(d => d.data()),
      openingEntries: obSnap.docs.map(d => d.data()),
      pharmacyName: settings.pharmacyName || 'আমার ফার্মেসি', ownerName: settings.ownerName || '',
      phone: settings.phone || '', address: settings.address || '', lowStockLevel: settings.lowStockLevel || 10,
      historyCutoff: cutoff,
      capReached,
    };
  } catch (err) {
    return { success: false, message: err.message, medicines: [], customers: [], suppliers: [], inventory: [], sales: [], purchases: [], returns: [], expenses: [], payments: [], supplierPayments: [], openingEntries: [], capReached: { sales: false, purchases: false, returns: false } };
  }
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ২: পুরনো (cutoff-এর আগের) হিস্টোরি on-demand লোড
// ────────────────────────────────────────────────────────────
async function apiGetOlderHistory() {
  try {
    const cutoff = APP_STATE.historyCutoff || getCutoffDateStr();
    const [saleSnap, purSnap, retSnap, expSnap, paySnap, supPaySnap] = await Promise.all([
      cget2(userCol('sales').where('date', '<', cutoff)),
      cget2(userCol('purchases').where('date', '<', cutoff)),
      cget2(userCol('returns').where('date', '<', cutoff)),
      cget2(userCol('expenses').where('date', '<', cutoff)),
      cget2(userCol('payments').where('date', '<', cutoff)),
      cget2(userCol('supplierPayments').where('date', '<', cutoff)),
    ]);
    return {
      success: true,
      sales: saleSnap.docs.map(d => d.data()), purchases: purSnap.docs.map(d => d.data()),
      returns: retSnap.docs.map(d => d.data()), expenses: expSnap.docs.map(d => d.data()),
      payments: paySnap.docs.map(d => d.data()), supplierPayments: supPaySnap.docs.map(d => d.data()),
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ────────────────────────────────────────────────────────────
// ✅ ধাপ ২৮: নির্দিষ্ট date-range (ফিসক্যাল ইয়ার/মাস) অনুযায়ী
// টার্গেটেড হিস্টোরি ফেচ — apiGetOlderHistory()-এর মতো "সব পুরনো
// ডেটা" না, শুধু ইউজার-নির্বাচিত একটা নির্দিষ্ট মেয়াদ।
// date ফিল্ডে দুটো range filter (>=, <=) + orderBy('date') — একই
// ফিল্ডে হওয়ায় composite index লাগে না (single-field index যথেষ্ট)।
// ────────────────────────────────────────────────────────────
async function apiGetHistoryByPeriod(fromDate, toDate) {
  try {
    const [saleSnap, purSnap, retSnap, expSnap, paySnap, supPaySnap] = await Promise.all([
      cget2(userCol('sales').where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date', 'asc')),
      cget2(userCol('purchases').where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date', 'asc')),
      cget2(userCol('returns').where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date', 'asc')),
      cget2(userCol('expenses').where('date', '>=', fromDate).where('date', '<=', toDate)),
      cget2(userCol('payments').where('date', '>=', fromDate).where('date', '<=', toDate)),
      cget2(userCol('supplierPayments').where('date', '>=', fromDate).where('date', '<=', toDate)),
    ]);
    return {
      success: true,
      sales: saleSnap.docs.map(d => d.data()),
      purchases: purSnap.docs.map(d => d.data()),
      returns: retSnap.docs.map(d => d.data()),
      expenses: expSnap.docs.map(d => d.data()),
      payments: paySnap.docs.map(d => d.data()),
      supplierPayments: supPaySnap.docs.map(d => d.data()),
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ── FULL RESET — সব subcollection মুছে ফেলে, profile/subscription অক্ষুণ্ণ থাকে ──
async function apiResetAllData() {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const collections = ['medicines', 'inventory', 'customers', 'suppliers', 'sales', 'purchases', 'returns', 'expenses', 'payments', 'supplierPayments', 'openingEntries'];
    for (const colName of collections) {
      const snap = await userCol(colName).get();
      const docs = snap.docs;
      for (let i = 0; i < docs.length; i += 400) { // Firestore batch সীমা ৫০০, নিরাপদ থাকতে ৪০০
        const batch = fbDb.batch();
        docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
    return { success: true, message: 'সব ডেটা মুছে ফেলা হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}
// collection query cache-first, খালি cache হলে fallback default (প্রথমবার অনলাইন বুট দরকার)
async function cget2(colRef) {
  return colRef.get();
}
async function cgetDoc(ref) {
  return ref.get();
}

// ── GLOBAL MEDICINE MASTER (২১k তালিকা) ──
async function apiSearchGlobalMedicines(prefix) {
  try {
    const p = prefix.trim().toLowerCase();
    if (!p) return { success: true, results: [] };
    const snap = await fbDb.collection('globalMedicines')
      .orderBy('brandLower').startAt(p).endAt(p + '\uf8ff').limit(25).get();
    return { success: true, results: snap.docs.map(d => d.data()) };
  } catch (err) { return { success: false, message: err.message, results: [] }; }
}

async function apiImportGlobalMedicine(med) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const id = 'MED-' + med.brand.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8) + '-' + Date.now();
    const data = { id, brand: med.brand, generic: med.generic || '', doseForm: med.doseForm || '', strength: med.strength || '', manufacturer: med.manufacturer || '', category: med.category || '', unit: med.unit || 'পাতা', reorderLevel: 10 };
    await userCol('medicines').doc(id).set(data);
    await userCol('inventory').doc(id).set({ medId: id, brand: data.brand, doseForm: data.doseForm, strength: data.strength, totalStock: 0, costValue: 0, mrpValue: 0, sellPrice: 0, nearestExpiry: '', status: 'out', batches: [] });
    return { success: true, medId: id };
  } catch (err) { return { success: false, message: err.message }; }
}

// ── ADMIN: bulk upload globalMedicines ──
async function apiBulkUploadGlobalMedicines(rows, onProgress) {
  try {
    let done = 0;
    const total = rows.length;
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400);
      const batch = fbDb.batch();
      chunk.forEach((r) => {
        // ✅ ফিক্স: deterministic ID (নাম+ডোজ+শক্তি-ভিত্তিক) — Date.now() না।
        // একই সারি দ্বিতীয়বার আপলোড হলে ওভাররাইট হবে, ডুপ্লিকেট তৈরি হবে না।
        const slug = (r.brand + '-' + (r.doseForm||'') + '-' + (r.strength||''))
          .toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 60);
        const id = 'GM-' + slug;
        batch.set(fbDb.collection('globalMedicines').doc(id), {
          id, brand: r.brand, brandLower: r.brand.toLowerCase(),
          generic: r.generic || '', doseForm: r.doseForm || '', strength: r.strength || '',
          manufacturer: r.manufacturer || '', category: r.category || '',
        });
      });
      try {
        await batch.commit();
      } catch (err) {
        // ✅ Quota শেষ হলে স্পষ্ট বার্তা + এখান পর্যন্ত যা হয়েছে তা রিপোর্ট করা
        if (err.code === 'resource-exhausted') {
          return { success: false, quotaExceeded: true, count: done, message: `Firestore দৈনিক সীমা শেষ। ${done}/${total} টি আপলোড হয়েছে — বাকিটা quota রিসেট হলে (মধ্যরাত, Pacific Time) আবার এই একই CSV পেস্ট করলে বাকি অংশ থেকেই চলবে, ডুপ্লিকেট হবে না।` };
        }
        throw err;
      }
      done += chunk.length;
      if (onProgress) onProgress(done, total);
    }
    return { success: true, count: done };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ────────────────────────────────────────────────────────────
// INVENTORY BATCH EDIT — ✅ ধাপ ১৩: runTransaction() দিয়ে read-then-write,
// আগে এই API-ই ছিল না, শুধু local APP_STATE বদলাত।
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// INVENTORY BATCH EDIT — apiUpdateBatch (✅ computeInventoryDerivedFields ব্যবহার করছে)
// ────────────────────────────────────────────────────────────
async function apiUpdateBatch(medId, batchId, fields) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const invRef = userCol('inventory').doc(medId);

    await fbDb.runTransaction(async (tx) => {
      // ✅ read আগে
      const invDoc = await tx.get(invRef);
      if (!invDoc.exists) throw new Error('ইনভেন্টরি রেকর্ড পাওয়া যায়নি।');
      const inv = invDoc.data();

      let found = false;
      const rawBatches = (inv.batches || []).map(b => {
        if (b.batchId !== batchId) return b;
        found = true;
        return { ...b, ...fields };
      });
      if (!found) throw new Error('ব্যাচ খুঁজে পাওয়া যায়নি — সম্ভবত অন্য কোথাও থেকে ইতিমধ্যে মুছে ফেলা হয়েছে।');

      const med = APP_STATE.medicines.find(m => m.id === medId);
      const reorderLevel = med?.reorderLevel || APP_STATE.lowStockLevel || 10;

      // ✅ ফিক্স (ধাপ ২৩, রিফ্যাক্টর): shared হেল্পার ব্যবহার
      const derived = computeInventoryDerivedFields(rawBatches, reorderLevel);

      const updateFields = {
        batches: derived.batches,
        totalStock: derived.totalStock,
        costValue: derived.costValue,
        mrpValue: derived.mrpValue,
        nearestExpiry: derived.nearestExpiry,
        status: derived.status,
      };
      if (fields.sell > 0) updateFields.sellPrice = fields.sell; // ✅ purchase.js/opening.js-এর প্যাটার্নের মতো

      // ✅ write পরে
      tx.update(invRef, updateFields);
    });

    return { success: true, message: 'ব্যাচ আপডেট হয়েছে।' };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
