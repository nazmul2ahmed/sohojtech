'use strict';

function userCol(name) {
  return fbDb.collection('users').doc(APP_STATE.currentUser.uid).collection(name);
}
// ✅ সব internal read এখন cache থেকে — অফলাইনে হ্যাং হবে না, অনলাইনেও দ্রুত হবে
async function cget(ref) {
  try {
    return await ref.get({ source: 'cache' });
  } catch (e) {
    // ✅ নতুন ব্রাউজার/ডিভাইসে cache খালি থাকলে (প্রথম লগইন) ডকুমেন্ট cache-এ
    // এখনো sync না হওয়ায় এই read throw করে — তখন server থেকে fallback নেয়।
    return ref.get();
  }
}

// ────────────────────────────────────────────────────────────
// MEDICINE
// ────────────────────────────────────────────────────────────
async function apiAddMedicine(data) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const id = data.id || ('MED-' + Date.now());
    await userCol('medicines').doc(id).set({
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
    if (amount > currentDue + 0.01) return { success: false, message: `বাকির (৳${fmt(currentDue)}) চেয়ে বেশি নেওয়া যাবে না।` };
    const custRef = userCol('customers').doc(custId);
    const paymentId = 'PAY-' + Date.now();
    const batch = fbDb.batch();
    batch.set(custRef, { id: custId, name: custData.name, phone: custData.phone || '', address: custData.address || '', due: round2(currentDue - amount), totalPaid: round2(currentTotalPaid + amount) }, { merge: true });
    batch.set(userCol('payments').doc(paymentId), { paymentId, date: todayStr(), customerId: custId, customerName: custData.name, amount, note: note || 'বাকি আদায়' });
    await batch.commit();
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
    if (amount > currentPayable + 0.01) return { success: false, message: `পাওনার (৳${fmt(currentPayable)}) চেয়ে বেশি দেওয়া যাবে না।` };
    const supRef = userCol('suppliers').doc(supId);
    const paymentId = 'SPAY-' + Date.now();
    const batch = fbDb.batch();
    batch.set(supRef, { id: supId, name: supData.name, phone: supData.phone || '', address: supData.address || '', totalPayable: round2(currentPayable - amount), totalPaid: round2(currentTotalPaid + amount) }, { merge: true });
    batch.set(userCol('supplierPayments').doc(paymentId), { paymentId, date: todayStr(), supplierId: supId, supplierName: supData.name, amount, note: note || 'পাওনা পরিশোধ' });
    await batch.commit();
    return { success: true, message: `৳${fmt(amount)} পরিশোধ করা হয়েছে।` };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// SALE (POS)
// ────────────────────────────────────────────────────────────
function computeFEFODeduction(invData, qty) {
  const batches = (invData.batches || []).map(b => ({ ...b }));
  batches.sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1);
  let remaining = qty;
  for (const b of batches) { if (remaining <= 0) break; const take = Math.min(b.stock, remaining); b.stock -= take; remaining -= take; }
  if (remaining > 0) return null;
  const rb = batches.filter(b => b.stock > 0);
  return { batches: rb, totalStock: rb.reduce((a, b) => a + b.stock, 0), costValue: round2(rb.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(rb.reduce((a, b) => a + b.mrp * b.stock, 0)), nearestExpiry: rb[0]?.expiry || '' };
}

async function apiSubmitSale(sale) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const invRefs = sale.items.map(item => userCol('inventory').doc(item.medId));
    const hasCustomer = sale.customerId && sale.customerId !== 'WALK_IN';
    const custRef = hasCustomer ? userCol('customers').doc(sale.customerId) : null;

    await fbDb.runTransaction(async (tx) => {
      // ✅ transaction-এর সব read আগে (Firestore-এর নিয়ম — write শুরুর আগে সব read শেষ করতে হয়)
      const invDocs = await Promise.all(invRefs.map(r => tx.get(r)));
      const custDoc = custRef ? await tx.get(custRef) : null;

      const invUpdates = [];
      for (let i = 0; i < sale.items.length; i++) {
        const item = sale.items[i], invDoc = invDocs[i];
        if (!invDoc.exists) throw new Error(`"${item.name}" ইনভেন্টরিতে পাওয়া যায়নি।`);
        const result = computeFEFODeduction(invDoc.data(), item.qty);
        if (!result) throw new Error(`"${item.name}" স্টক অপর্যাপ্ত।`);
        invUpdates.push({ ref: invRefs[i], fields: result });
      }

      let custUpdate = null;
      if (custRef && custDoc && custDoc.exists) {
        const c = custDoc.data();
        custUpdate = {
          due: round2((c.due || 0) + (sale.due || 0)),
          totalPaid: round2((c.totalPaid || 0) + (sale.cashPaid || 0)),
        };
      }

      // ✅ সব write এখন — read-এর পরে
      tx.set(userCol('sales').doc(sale.invoiceNo), sale);
      invUpdates.forEach(u => tx.update(u.ref, u.fields));
      if (custRef && custUpdate) tx.update(custRef, custUpdate);
    });

    return { success: true, message: `বিক্রয় সফল! Invoice: ${sale.invoiceNo}` };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

async function apiDeleteSale(sale) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(sale.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));
    const invDocs = await Promise.all(invRefs.map(r => cget(r)));
    const invMap = {};
    uniqueMedIds.forEach((id, i) => { invMap[id] = { ref: invRefs[i], data: invDocs[i].exists ? { ...invDocs[i].data() } : null }; });
    sale.items.forEach(item => {
      const e = invMap[item.medId]; if (!e.data) return;
      const batches = [...(e.data.batches || [])];
      if (batches.length) batches[0] = { ...batches[0], stock: batches[0].stock + item.qty };
      else batches.push({ batchId: 'BAT-VOID-' + Date.now(), expiry: '', stock: item.qty, cost: item.costPrice || 0, mrp: 0, sell: e.data.sellPrice || 0 });
      e.data.batches = batches;
    });
    let custRef = null, custFields = null;
    if (sale.customerId && sale.customerId !== 'WALK_IN') {
      custRef = userCol('customers').doc(sale.customerId);
      const cd = await cget(custRef);
      if (cd.exists) custFields = { due: Math.max(0, round2((cd.data().due || 0) - (sale.due || 0))), totalPaid: Math.max(0, round2((cd.data().totalPaid || 0) - (sale.cashPaid || 0))) };
    }
    const batch = fbDb.batch();
    batch.delete(userCol('sales').doc(sale.invoiceNo));
    Object.values(invMap).forEach(e => { if (!e.data) return; const ts = e.data.batches.reduce((a, b) => a + b.stock, 0); batch.set(e.ref, { ...e.data, totalStock: ts, costValue: round2(e.data.batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(e.data.batches.reduce((a, b) => a + b.mrp * b.stock, 0)) }, { merge: true }); });
    if (custRef && custFields) batch.update(custRef, custFields);
    await batch.commit();
    return { success: true, message: 'বিক্রয় মুছে ফেলা হয়েছে, স্টক/বাকি ফেরত হয়েছে।' };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// PURCHASE
// ────────────────────────────────────────────────────────────
async function apiSubmitPurchase(purchase) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const invRefs = purchase.items.map(item => userCol('inventory').doc(item.medId));
    const supRef = userCol('suppliers').doc(purchase.supplierId);
    const [invDocs, supDoc] = await Promise.all([Promise.all(invRefs.map(r => cget(r))), cget(supRef)]);

    const invUpdates = purchase.items.map((item, idx) => {
      const invDoc = invDocs[idx];
      const newBatch = { batchId: 'BAT-' + Date.now() + '-' + idx + '-' + Math.floor(Math.random() * 1000), expiry: item.expiryDate || '', stock: item.qty, cost: item.purchasePrice, mrp: item.mrp, sell: item.sellPrice || 0 };
      item.batchId = newBatch.batchId; // ✅ delete-এর সময় সঠিক ব্যাচ খুঁজতে
      const existing = invDoc.exists ? invDoc.data() : null;
      const batches = [...(existing?.batches || []), newBatch].sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1);
      const totalStock = batches.reduce((a, b) => a + b.stock, 0);
      const reorderLevel = item.reorderLevel || 10;
      const fields = { medId: item.medId, brand: item.brand, doseForm: item.doseForm || '', strength: item.strength || '', batches, totalStock, costValue: round2(batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(batches.reduce((a, b) => a + b.mrp * b.stock, 0)), nearestExpiry: batches[0]?.expiry || '', sellPrice: item.sellPrice > 0 ? item.sellPrice : (existing?.sellPrice || 0), status: totalStock === 0 ? 'out' : totalStock <= reorderLevel ? 'low' : 'ok' };
      return { ref: invRefs[idx], fields, exists: invDoc.exists };
    });

    let supUpdate = null;
    if (supDoc.exists) {
      const sup = supDoc.data();
      supUpdate = purchase.paymentType === 'বাকি' ? { totalPayable: round2((sup.totalPayable || 0) + purchase.totalCost) } : { totalPaid: round2((sup.totalPaid || 0) + purchase.totalCost) };
    }
    const batch = fbDb.batch();
    batch.set(userCol('purchases').doc(purchase.purchaseId), purchase);
    invUpdates.forEach(u => { if (u.exists) batch.update(u.ref, u.fields); else batch.set(u.ref, u.fields); });
    if (supUpdate) batch.update(supRef, supUpdate);
    await batch.commit();
    return { success: true, message: `ক্রয় রেকর্ড হয়েছে! Invoice: ${purchase.purchaseId}` };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeletePurchase(purchase) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const invRefs = purchase.items.map(i => userCol('inventory').doc(i.medId));
    const invDocs = await Promise.all(invRefs.map(r => cget(r)));
    const invUpdates = purchase.items.map((item, idx) => {
      const invDoc = invDocs[idx]; if (!invDoc.exists) return null;
      const inv = invDoc.data();
      const batches = (inv.batches || []).filter(b => b.batchId !== item.batchId);
      const totalStock = batches.reduce((a, b) => a + b.stock, 0);
      return { ref: invRefs[idx], fields: { batches, totalStock, costValue: round2(batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(batches.reduce((a, b) => a + b.mrp * b.stock, 0)) } };
    }).filter(Boolean);
    let supRef = null, supFields = null;
    const supDoc = await cget(userCol('suppliers').doc(purchase.supplierId));
    if (supDoc.exists) {
      const sup = supDoc.data();
      supRef = userCol('suppliers').doc(purchase.supplierId);
      supFields = purchase.paymentType === 'বাকি' ? { totalPayable: Math.max(0, round2((sup.totalPayable || 0) - purchase.totalCost)) } : { totalPaid: Math.max(0, round2((sup.totalPaid || 0) - purchase.totalCost)) };
    }
    const batch = fbDb.batch();
    batch.delete(userCol('purchases').doc(purchase.purchaseId));
    invUpdates.forEach(u => batch.update(u.ref, u.fields));
    if (supRef && supFields) batch.update(supRef, supFields);
    await batch.commit();
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
    const invDocs = await Promise.all(invRefs.map(r => cget(r)));
    const invMap = {};
    uniqueMedIds.forEach((id, idx) => { invMap[id] = { ref: invRefs[idx], data: invDocs[idx].exists ? { ...invDocs[idx].data() } : null }; });
    returnDoc.items.forEach(item => {
      const e = invMap[item.medId]; if (!e.data) return;
      const batches = [...(e.data.batches || [])];
      if (batches.length) batches[0] = { ...batches[0], stock: batches[0].stock + item.qty };
      else batches.push({ batchId: 'BAT-RET-' + Date.now(), expiry: '', stock: item.qty, cost: item.costPrice || 0, mrp: 0, sell: e.data.sellPrice || 0 });
      e.data.batches = batches;
    });
    let custRef = null, custFields = null;
    if (custDueReduction > 0) {
      custRef = userCol('customers').doc(custId);
      const cd = await cget(custRef);
      if (cd.exists) custFields = { due: round2((cd.data().due || 0) - custDueReduction) };
    }
    const batch = fbDb.batch();
    batch.set(userCol('returns').doc(returnDoc.returnId), returnDoc);
    Object.values(invMap).forEach(e => { if (!e.data) return; const ts = e.data.batches.reduce((a, b) => a + b.stock, 0); batch.set(e.ref, { ...e.data, totalStock: ts, costValue: round2(e.data.batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(e.data.batches.reduce((a, b) => a + b.mrp * b.stock, 0)) }, { merge: true }); });
    if (custRef && custFields) batch.update(custRef, custFields);
    await batch.commit();
    return { success: true, message: 'রিটার্ন সফল হয়েছে!' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiSubmitSupplierReturn(returnDoc, supId, supPayableReduction) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(returnDoc.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));
    const invDocs = await Promise.all(invRefs.map(r => cget(r)));
    const invMap = {};
    uniqueMedIds.forEach((id, idx) => { invMap[id] = { ref: invRefs[idx], data: invDocs[idx].exists ? { ...invDocs[idx].data() } : null }; });
    returnDoc.items.forEach(item => {
      const e = invMap[item.medId]; if (!e.data) return;
      let batches = [...(e.data.batches || [])];
      batches.sort((a, b) => (b.expiry || '0000') > (a.expiry || '0000') ? 1 : -1);
      let remaining = item.qty;
      batches = batches.map(b => { if (remaining <= 0) return b; const take = Math.min(b.stock, remaining); remaining -= take; return { ...b, stock: b.stock - take }; }).filter(b => b.stock > 0);
      e.data.batches = batches;
    });
    let supRef = null, supFields = null;
    if (supPayableReduction > 0) {
      supRef = userCol('suppliers').doc(supId);
      const sd = await cget(supRef);
      if (sd.exists) supFields = { totalPayable: Math.max(0, round2((sd.data().totalPayable || 0) - supPayableReduction)) };
    }
    const batch = fbDb.batch();
    batch.set(userCol('returns').doc(returnDoc.returnId), returnDoc);
    Object.values(invMap).forEach(e => { if (!e.data) return; const sorted = e.data.batches.slice().sort((a, b) => (a.expiry || '9999') < (b.expiry || '9999') ? -1 : 1); const ts = e.data.batches.reduce((a, b) => a + b.stock, 0); batch.set(e.ref, { ...e.data, totalStock: ts, costValue: round2(e.data.batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(e.data.batches.reduce((a, b) => a + b.mrp * b.stock, 0)), nearestExpiry: sorted[0]?.expiry || '' }, { merge: true }); });
    if (supRef && supFields) batch.update(supRef, supFields);
    await batch.commit();
    return { success: true, message: returnDoc.reason === 'ধ্বংস' ? 'মেয়াদোত্তীর্ণ পণ্য রাইট-অফ হয়েছে!' : 'সাপ্লায়ার রিটার্ন সফল!' };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteReturn(ret) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const uniqueMedIds = [...new Set(ret.items.map(i => i.medId))];
    const invRefs = uniqueMedIds.map(id => userCol('inventory').doc(id));
    const invDocs = await Promise.all(invRefs.map(r => cget(r)));
    const invMap = {};
    uniqueMedIds.forEach((id, i) => { invMap[id] = { ref: invRefs[i], data: invDocs[i].exists ? { ...invDocs[i].data() } : null }; });

    if (ret.returnType === 'customer') {
      ret.items.forEach(item => { const e = invMap[item.medId]; if (!e.data) return; let batches = [...(e.data.batches || [])]; let remaining = item.qty; batches = batches.map(b => { if (remaining <= 0) return b; const take = Math.min(b.stock, remaining); remaining -= take; return { ...b, stock: b.stock - take }; }).filter(b => b.stock > 0); e.data.batches = batches; });
    } else {
      ret.items.forEach(item => { const e = invMap[item.medId]; if (!e.data) return; const batches = [...(e.data.batches || [])]; if (batches.length) batches[0] = { ...batches[0], stock: batches[0].stock + item.qty }; else batches.push({ batchId: 'BAT-VOID-' + Date.now(), expiry: '', stock: item.qty, cost: item.purchasePrice || 0, mrp: 0, sell: e.data.sellPrice || 0 }); e.data.batches = batches; });
    }
    let partyRef = null, partyFields = null;
    if (ret.returnType === 'customer' && ret.refundMethod === 'বাকি সমন্বয়') {
      partyRef = userCol('customers').doc(ret.partyId);
      const cd = await cget(partyRef);
      if (cd.exists) partyFields = { due: round2((cd.data().due || 0) + ret.amount) };
    } else if (ret.returnType === 'supplier' && ret.reason === 'ফেরত' && ret.refundMethod === 'পাওনা সমন্বয়') {
      partyRef = userCol('suppliers').doc(ret.partyId);
      const sd = await cget(partyRef);
      if (sd.exists) partyFields = { totalPayable: round2((sd.data().totalPayable || 0) + ret.amount) };
    }
    const batch = fbDb.batch();
    batch.delete(userCol('returns').doc(ret.returnId));
    Object.values(invMap).forEach(e => { if (!e.data) return; const ts = e.data.batches.reduce((a, b) => a + b.stock, 0); batch.set(e.ref, { ...e.data, totalStock: ts, costValue: round2(e.data.batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(e.data.batches.reduce((a, b) => a + b.mrp * b.stock, 0)) }, { merge: true }); });
    if (partyRef && partyFields) batch.update(partyRef, partyFields);
    await batch.commit();
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

async function apiSubmitOpeningEntry(entry) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const batch = fbDb.batch();
    batch.set(userCol('openingEntries').doc(entry.entryId), entry);
    if (entry.category === 'স্টক') {
      const invRef = userCol('inventory').doc(entry.medicineId);
      const invDoc = await cget(invRef);
      const existing = invDoc.exists ? invDoc.data() : null;
      const newBatch = { batchId: entry.batchId, expiry: entry.expiryDate || '', stock: entry.qty, cost: entry.costPrice, mrp: entry.mrp, sell: entry.sellPrice };
      const batches = [...(existing?.batches || []), newBatch];
      const fields = { medId: entry.medicineId, brand: entry.brand || existing?.brand || '', doseForm: existing?.doseForm || '', strength: existing?.strength || '', batches, totalStock: batches.reduce((a, b) => a + b.stock, 0), costValue: round2(batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(batches.reduce((a, b) => a + b.mrp * b.stock, 0)), nearestExpiry: existing?.nearestExpiry || entry.expiryDate || '', sellPrice: entry.sellPrice > 0 ? entry.sellPrice : (existing?.sellPrice || 0), status: existing?.status || 'ok' };
      if (invDoc.exists) batch.update(invRef, fields); else batch.set(invRef, fields);
    } else if (entry.category === 'গ্রাহক বাকি') {
      const custRef = userCol('customers').doc(entry.clientId);
      const custDoc = await cget(custRef);
      if (custDoc.exists) batch.update(custRef, { due: round2((custDoc.data().due || 0) + entry.amount) });
    } else if (entry.category === 'সরবরাহকারী বাকি') {
      const supRef = userCol('suppliers').doc(entry.supplierId);
      const supDoc = await cget(supRef);
      if (supDoc.exists) batch.update(supRef, { totalPayable: round2((supDoc.data().totalPayable || 0) + entry.amount) });
    }
    await batch.commit();
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
}

async function apiDeleteOpeningEntry(entry) {
  if (!navigator.onLine) return { success: false, message: OFFLINE_MSG };
  try {
    const batch = fbDb.batch();
    batch.delete(userCol('openingEntries').doc(entry.entryId));
    if (entry.category === 'স্টক' && entry.batchId) {
      const invRef = userCol('inventory').doc(entry.medicineId);
      const invDoc = await cget(invRef);
      if (invDoc.exists) {
        const inv = invDoc.data();
        const batches = (inv.batches || []).filter(b => b.batchId !== entry.batchId);
        batch.update(invRef, { batches, totalStock: batches.reduce((a, b) => a + b.stock, 0), costValue: round2(batches.reduce((a, b) => a + b.cost * b.stock, 0)), mrpValue: round2(batches.reduce((a, b) => a + b.mrp * b.stock, 0)) });
      }
    } else if (entry.category === 'গ্রাহক বাকি' && entry.clientId) {
      const custRef = userCol('customers').doc(entry.clientId);
      const custDoc = await cget(custRef);
      if (custDoc.exists) batch.update(custRef, { due: Math.max(0, round2((custDoc.data().due || 0) - entry.amount)) });
    } else if (entry.category === 'সরবরাহকারী বাকি' && entry.supplierId) {
      const supRef = userCol('suppliers').doc(entry.supplierId);
      const supDoc = await cget(supRef);
      if (supDoc.exists) batch.update(supRef, { totalPayable: Math.max(0, round2((supDoc.data().totalPayable || 0) - entry.amount)) });
    }
    await batch.commit();
    return { success: true };
  } catch (err) { return { success: false, message: err.message }; }
}

// ────────────────────────────────────────────────────────────
// getCompleteData — ✅ এটাও cache-first (অফলাইনে app বুট করতেও দ্রুত/নির্ভরযোগ্য হবে)
// ────────────────────────────────────────────────────────────
async function apiGetCompleteData() {
  try {
    const [medSnap, custSnap, supSnap, invSnap, saleSnap, purSnap, retSnap, expSnap, paySnap, supPaySnap, obSnap, settingsDoc] = await Promise.all([
      cget2(userCol('medicines')), cget2(userCol('customers')), cget2(userCol('suppliers')), cget2(userCol('inventory')),
      cget2(userCol('sales')), cget2(userCol('purchases')), cget2(userCol('returns')), cget2(userCol('expenses')),
      cget2(userCol('payments')), cget2(userCol('supplierPayments')), cget2(userCol('openingEntries')),
      cgetDoc(userCol('config').doc('settings')),
    ]);
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    return {
      success: true,
      medicines: medSnap.docs.map(d => d.data()), customers: custSnap.docs.map(d => d.data()),
      suppliers: supSnap.docs.map(d => d.data()), inventory: invSnap.docs.map(d => d.data()),
      sales: saleSnap.docs.map(d => d.data()), purchases: purSnap.docs.map(d => d.data()),
      returns: retSnap.docs.map(d => d.data()), expenses: expSnap.docs.map(d => d.data()),
      payments: paySnap.docs.map(d => d.data()), supplierPayments: supPaySnap.docs.map(d => d.data()),
      openingEntries: obSnap.docs.map(d => d.data()),
      pharmacyName: settings.pharmacyName || 'আমার ফার্মেসি', ownerName: settings.ownerName || '',
      phone: settings.phone || '', address: settings.address || '', lowStockLevel: settings.lowStockLevel || 10,
    };
  } catch (err) {
    return { success: false, message: err.message, medicines: [], customers: [], suppliers: [], inventory: [], sales: [], purchases: [], returns: [], expenses: [], payments: [], supplierPayments: [], openingEntries: [] };
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
  try {
    const snap = await colRef.get({ source: 'cache' });
    if (!snap.empty) return snap;
    return colRef.get();
  } catch (e) { return colRef.get(); }
}
async function cgetDoc(ref) {
  try { return await ref.get({ source: 'cache' }); }
  catch (e) { return ref.get(); }
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
