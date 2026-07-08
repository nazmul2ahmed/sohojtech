'use strict';

const APP_CONFIG = {
  appName: 'SohojTech Pharmacy',
  version: '5.0.0-pwa',

  firebase: {
    apiKey: "AIzaSyA7XWSz2nM_24QSabkORPIuJQqRc3IaTFU",
    authDomain: "sohojtech-pharmacy.firebaseapp.com",
    projectId: "sohojtech-pharmacy",
    storageBucket: "sohojtech-pharmacy.firebasestorage.app",
    messagingSenderId: "405516727183",
    appId: "1:405516727183:web:044be2b31a7d09f98911fa",
  },

  ADMIN_EMAIL: 'nazmul2ahmed@gmail.com',
  TRIAL_DAYS: 15,

  features: {
    firebaseAuth: true,
    offlineSync: false,   // Phase E-তে সক্রিয় হবে
    firestoreDb: true,     // ← নতুন
  },
};

// ════════════════════════════════════════════════════════════
// FIRESTORE কালেকশন কাঠামো (ডকুমেন্টেশন হিসেবে — কোডে ব্যবহৃত হয় না,
// Firestore schema-less, কিন্তু এই কাঠামো সবসময় অনুসরণ করা হবে)
//
// users/{uid}                          → profile: email, status, role, createdAt
// users/{uid}/medicines/{medId}
// users/{uid}/customers/{custId}
// users/{uid}/suppliers/{supId}
// users/{uid}/inventory/{medId}        → batches[] সহ
// users/{uid}/sales/{saleId}
// users/{uid}/purchases/{purId}
// users/{uid}/returns/{retId}
// users/{uid}/expenses/{expId}
// users/{uid}/payments/{payId}
// users/{uid}/supplierPayments/{payId}
// users/{uid}/openingEntries/{obId}
// users/{uid}/config/settings          → pharmacyName, ownerName, phone, address, lowStockLevel
// ════════════════════════════════════════════════════════════