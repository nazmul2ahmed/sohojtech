'use strict';

// ════════════════════════════════════════════════════════════
// MOCK DATA — শুধু Phase A ডেভেলপমেন্টের জন্য।
// প্রতিটি sale item-এ `costPrice` আছে (COGS হিসাবের জন্য)।
// `payments` array আলাদাভাবে বাকি-আদায় ট্র্যাক করে — এটা
// Revenue-তে যোগ হবে না, শুধু Cash Flow ও Receivables-এ দেখাবে।
// ════════════════════════════════════════════════════════════
function getMockData() {
  const today = todayStr();

  const medicines = [
    { id: 'MED-0001', brand: 'নাপা', generic: 'Paracetamol', doseForm: 'ট্যাবলেট', strength: '500mg', category: 'এনালজেসিক', reorderLevel: 20 },
    { id: 'MED-0002', brand: 'সেকলো', generic: 'Omeprazole', doseForm: 'ক্যাপসুল', strength: '20mg', category: 'এন্টাসিড', reorderLevel: 15 },
    { id: 'MED-0003', brand: 'এজিথ্রো', generic: 'Azithromycin', doseForm: 'ট্যাবলেট', strength: '500mg', category: 'এন্টিবায়োটিক', reorderLevel: 10 },
    { id: 'MED-0004', brand: 'ফেক্সো', generic: 'Fexofenadine', doseForm: 'ট্যাবলেট', strength: '120mg', category: 'অ্যান্টিহিস্টামিন', reorderLevel: 15 },
  ];

  const inventory = [
    { medId: 'MED-0001', brand: 'নাপা', doseForm: 'ট্যাবলেট', strength: '500mg', totalStock: 240, costValue: 1200, mrpValue: 1920, sellPrice: 8, nearestExpiry: '12/2026', status: 'ok',
      batches: [{ batchId: 'BAT-001', expiry: '12/2026', stock: 240, cost: 5, mrp: 8, sell: 8 }] },
    { medId: 'MED-0002', brand: 'সেকলো', doseForm: 'ক্যাপসুল', strength: '20mg', totalStock: 8, costValue: 80, mrpValue: 120, sellPrice: 15, nearestExpiry: '08/2026', status: 'low',
      batches: [{ batchId: 'BAT-002', expiry: '08/2026', stock: 8, cost: 10, mrp: 15, sell: 15 }] },
    { medId: 'MED-0003', brand: 'এজিথ্রো', doseForm: 'ট্যাবলেট', strength: '500mg', totalStock: 0, costValue: 0, mrpValue: 0, sellPrice: 65, nearestExpiry: '', status: 'out', batches: [] },
    { medId: 'MED-0004', brand: 'ফেক্সো', doseForm: 'ট্যাবলেট', strength: '120mg', totalStock: 60, costValue: 900, mrpValue: 1500, sellPrice: 25, nearestExpiry: '07/2026', status: 'ok',
      batches: [{ batchId: 'BAT-004', expiry: '07/2026', stock: 60, cost: 15, mrp: 25, sell: 25 }] },
  ];

  // C-0002-এর ৩০০ টাকা পুরনো বাকি ছিল (গতকালের বিক্রয় থেকে) — আজ পরিশোধ করেছে,
  // তাই due এখন 0, কিন্তু এটা আজকের নতুন বিক্রয় নয়।
  const customers = [
    { id: 'C-0001', name: 'রহিম মিয়া', phone: '01711111111', due: 850, totalPaid: 1200 },
    { id: 'C-0002', name: 'সুমাইয়া বেগম', phone: '01822222222', due: 0, totalPaid: 800 },
    { id: 'C-0003', name: 'করিম সাহেব', phone: '01933333333', due: 1250, totalPaid: 0 },
  ];

  const suppliers = [
    { id: 'S-0001', name: 'স্কয়ার ফার্মা', phone: '02111111111', totalPayable: 5000, totalPaid: 20000 },
    { id: 'S-0002', name: 'বেক্সিমকো ফার্মা', phone: '02222222222', totalPayable: 0, totalPaid: 8000 },
  ];

  // প্রতিটি sale-এ items array — প্রতি item-এ costPrice আছে (COGS-এর জন্য)
  const sales = [
    {
      invoiceNo: 'INV-1001', date: today, customerId: 'C-0001', customerName: 'রহিম মিয়া',
      items: [{ medId: 'MED-0001', name: 'নাপা', qty: 60, price: 8, costPrice: 5, discountPct: 0 }],
      totalBill: 480, cashPaid: 480, due: 0, type: 'নগদ',
    },
    {
      invoiceNo: 'INV-1002', date: today, customerId: 'C-0003', customerName: 'করিম সাহেব',
      items: [{ medId: 'MED-0002', name: 'সেকলো', qty: 18, price: 15, costPrice: 10, discountPct: 0 }],
      totalBill: 270, cashPaid: 0, due: 270, type: 'বাকি',   // ← আজকের নতুন বাকি (revenue হিসাবে ধরা হবে, কিন্তু cash-এ না)
    },
    {
      invoiceNo: 'INV-1003', date: today, customerId: 'WALK_IN', customerName: 'নগদ গ্রাহক',
      items: [
        { medId: 'MED-0001', name: 'নাপা', qty: 15, price: 8, costPrice: 5, discountPct: 0 },
        { medId: 'MED-0004', name: 'ফেক্সো', qty: 4, price: 25, costPrice: 15, discountPct: 5 },
      ],
      totalBill: 215, cashPaid: 215, due: 0, type: 'নগদ',
    },
  ];

  // paymentType যোগ হলো — Cash Flow হিসাবে কোন ক্রয় নগদে হয়েছে তা জানতে দরকার
  const purchases = [
    {
      purchaseId: 'PUR-9001', date: today, supplierId: 'S-0001', supplierName: 'স্কয়ার ফার্মা',
      items: [{ medId: 'MED-0001', brand: 'নাপা', doseForm: 'ট্যাবলেট', strength: '500mg', qty: 500, purchasePrice: 5, mrp: 8, sellPrice: 8, expiryDate: '12/2026' }],
      totalCost: 2500, paymentType: 'নগদ', medicineName: 'নাপা',
    },
  ];

  const expenses = [
    { id: 'EXP-001', date: today, description: 'বিদ্যুৎ বিল', amount: 1200, category: 'ইউটিলিটি' },
    { id: 'EXP-002', date: today, description: 'কর্মীর বেতন', amount: 8000, category: 'বেতন' },
  ];

  // ═══ নতুন: বাকি আদায়ের রেকর্ড (T_Payments) ═══
  // এটা আজকের Revenue-তে যোগ হবে না — শুধু Cash Flow ও Receivables-এ প্রভাব ফেলবে।
  const payments = [
    { paymentId: 'PAY-5001', date: today, customerId: 'C-0002', customerName: 'সুমাইয়া বেগম', amount: 300, note: 'পুরনো বাকি পরিশোধ (আগের তারিখের বিক্রয়)' },
  ];

return {
    pharmacyName: 'সহজটেক ফার্মেসি', ownerName: 'সজল আহমেদ', phone: '01700000000',
    address: 'ঢাকা, বাংলাদেশ', lowStockLevel: 10,
    medicines, inventory, customers, suppliers, sales, purchases, expenses, payments, supplierPayments: [],
  };
}