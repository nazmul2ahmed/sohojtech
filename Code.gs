'use strict';

// ════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════
const FS_BASE = 'https://firestore.googleapis.com/v1';
const OAUTH_SCOPE = 'https://www.googleapis.com/auth/datastore';
const TRIAL_DAYS = 15;
const REENGAGEMENT_AFTER_DAYS = 21; // ২.৩ সিদ্ধান্ত
const FROM_NAME = 'SohojTech Pharmacy';

// ════════════════════════════════════════════════════════════
// OAUTH2 — Service Account JWT → Access Token (cached ~58 মিনিট)
// ════════════════════════════════════════════════════════════
function getAccessToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('fs_access_token');
  if (cached) return cached;

  const props = PropertiesService.getScriptProperties();
  const serviceAccount = JSON.parse(props.getProperty('SERVICE_ACCOUNT_JSON'));
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: serviceAccount.client_email,
    scope: OAUTH_SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64url = (obj) => Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
  const toSign = base64url(header) + '.' + base64url(claimSet);
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, serviceAccount.private_key);
  const signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
  const jwt = toSign + '.' + signature;

  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
    muteHttpExceptions: true,
  });

  const result = JSON.parse(response.getContentText());
  if (!result.access_token) {
    throw new Error('Access token পাওয়া যায়নি: ' + response.getContentText());
  }

  cache.put('fs_access_token', result.access_token, 3400);
  return result.access_token;
}

// ════════════════════════════════════════════════════════════
// FIRESTORE REST HELPERS — value (de)serialization
// ════════════════════════════════════════════════════════════
function parseFirestoreValue(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue !== undefined) return new Date(v.timestampValue);
  if (v.nullValue !== undefined) return null;
  if (v.mapValue !== undefined) {
    const obj = {};
    const fields = v.mapValue.fields || {};
    Object.keys(fields).forEach((k) => { obj[k] = parseFirestoreValue(fields[k]); });
    return obj;
  }
  if (v.arrayValue !== undefined) {
    return (v.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

function toFirestoreValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: v } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === 'object') {
    const fields = {};
    Object.keys(v).forEach((k) => { fields[k] = toFirestoreValue(v[k]); });
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function parseFirestoreDoc(doc) {
  const id = doc.name.split('/').pop();
  const fields = {};
  const raw = doc.fields || {};
  Object.keys(raw).forEach((k) => { fields[k] = parseFirestoreValue(raw[k]); });
  fields.uid = id;
  return fields;
}

// ════════════════════════════════════════════════════════════
// FIRESTORE — fetch all users (pagination-aware)
// ════════════════════════════════════════════════════════════
function fetchAllUsers() {
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const token = getAccessToken();
  const users = [];
  let pageToken = null;

  do {
    let url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/users?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

    const resp = UrlFetchApp.fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    const data = JSON.parse(resp.getContentText());
    if (data.error) throw new Error('Firestore fetch ব্যর্থ: ' + JSON.stringify(data.error));

    (data.documents || []).forEach((doc) => users.push(parseFirestoreDoc(doc)));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return users;
}

// ════════════════════════════════════════════════════════════
// FIRESTORE — patch emailLog ফিল্ড (শুধু এই একটা ফিল্ড, বাকি ছোঁয় না)
// ════════════════════════════════════════════════════════════
function patchEmailLog(uid, emailLogObj) {
  const projectId = PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
  const token = getAccessToken();
  const url = `${FS_BASE}/projects/${projectId}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=emailLog`;

  const body = { fields: { emailLog: toFirestoreValue(emailLogObj) } };

  const resp = UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });

  if (resp.getResponseCode() >= 300) {
    console.error('emailLog patch ব্যর্থ (uid=' + uid + '): ' + resp.getContentText());
  }
}

// ════════════════════════════════════════════════════════════
// MAIN DAILY JOB
// ════════════════════════════════════════════════════════════
function dailyEmailJob() {
  const users = fetchAllUsers();
  const now = new Date();
  let sentCount = 0, errorCount = 0;

  users.forEach((user) => {
    try {
      const sent = processUserEmails(user, now);
      sentCount += sent;
    } catch (err) {
      errorCount++;
      console.error('ইউজার ' + user.uid + ' (' + user.email + ') প্রসেস করতে সমস্যা: ' + err.message);
    }
  });

  console.log(`দৈনিক ইমেইল জব শেষ — ${sentCount}টা ইমেইল পাঠানো হয়েছে, ${errorCount}টা এরর।`);
}

function processUserEmails(user, now) {
  if (!user.email) return 0;
  if (user.role === 'owner') return 0;               // অ্যাডমিন নিজেকে ইমেইল পাঠাবে না
  if (user.status === 'staff') return 0;              // স্টাফ প্রোফাইলে ট্রায়াল/সাবস্ক্রিপশন নেই
  if (user.emailPreferences && user.emailPreferences.unsubscribedAll) return 0;

  const emailLog = user.emailLog || {};
  const updates = {};
  let sentThisRun = 0;

  // ── ওয়েলকাম ──
  if (!emailLog.welcomeSent && user.createdAt) {
    sendWelcomeEmail(user);
    updates.welcomeSent = true;
    sentThisRun++;
  }

  // ── ট্রায়াল রিমাইন্ডার + re-engagement ──
  if (user.status === 'trial' && user.createdAt) {
    const daysSince = Math.floor((now - user.createdAt) / 86400000);

    [7, 12, 14].forEach((day) => {
      const key = 'trial' + day + 'Sent';
      if (daysSince >= day && !emailLog[key]) {
        sendTrialReminderEmail(user, TRIAL_DAYS - day);
        updates[key] = true;
        sentThisRun++;
      }
    });

    if (daysSince >= REENGAGEMENT_AFTER_DAYS && !emailLog.reengagementSent) {
      sendReengagementEmail(user);
      updates.reengagementSent = true;
      sentThisRun++;
    }
  }

  // ── সাবস্ক্রিপশন মেয়াদ সতর্কতা + renewal-রিসেট (২.১) ──
  if (user.status === 'approved' && user.subscriptionExpiresAt) {
    const currentExpiryISO = user.subscriptionExpiresAt.toISOString();
    if (emailLog.lastKnownExpiryISO && emailLog.lastKnownExpiryISO !== currentExpiryISO) {
      updates.sub7Sent = false;
      updates.sub3Sent = false;
    }
    updates.lastKnownExpiryISO = currentExpiryISO;

    const daysLeft = Math.ceil((user.subscriptionExpiresAt - now) / 86400000);
    [7, 3].forEach((day) => {
      const key = 'sub' + day + 'Sent';
      const alreadySent = updates[key] === false ? false : emailLog[key]; // রিসেট হলে false ধরেই চেক
      if (daysLeft <= day && daysLeft > 0 && !alreadySent) {
        sendSubscriptionReminderEmail(user, daysLeft);
        updates[key] = true;
        sentThisRun++;
      }
    });
  }

  // ── Payment-success — status-transition ডিটেকশন (২.২) ──
  const prevStatus = emailLog.lastKnownStatus;
  const becameApproved = user.status === 'approved' && prevStatus !== 'approved';
  const renewed = user.status === 'approved' && prevStatus === 'approved'
    && updates.sub7Sent === false; // মানে expiry বদলেছে এই রানেই (renewal signal)

  if ((becameApproved || renewed) && !emailLog.paymentSuccessSent) {
    sendPaymentSuccessEmail(user);
    updates.paymentSuccessSent = true;
    sentThisRun++;
  }
  if (user.status !== 'approved') {
    updates.paymentSuccessSent = false; // পরের বার approve হলে আবার পাঠানো উচিত
  }
  updates.lastKnownStatus = user.status;

  if (Object.keys(updates).length) {
    patchEmailLog(user.uid, Object.assign({}, emailLog, updates));
  }

  return sentThisRun;
}

// ════════════════════════════════════════════════════════════
// EMAIL SENDERS — HTML_TEMPLATES-এর ফাংশনগুলো নিজের টেমপ্লেট দিয়ে পূরণ করুন
// ════════════════════════════════════════════════════════════
function sendWelcomeEmail(user) {
  GmailApp.sendEmail(user.email, 'SohojTech Pharmacy-তে স্বাগতম!', '', {
    htmlBody: HTML_TEMPLATES.welcome(user),
    name: FROM_NAME,
  });
}
function sendTrialReminderEmail(user, daysLeft) {
  GmailApp.sendEmail(user.email, `আপনার ট্রায়াল আর ${daysLeft} দিন বাকি`, '', {
    htmlBody: HTML_TEMPLATES.trialReminder(user, daysLeft),
    name: FROM_NAME,
  });
}
function sendSubscriptionReminderEmail(user, daysLeft) {
  GmailApp.sendEmail(user.email, `সাবস্ক্রিপশন আর ${daysLeft} দিনে শেষ হবে`, '', {
    htmlBody: HTML_TEMPLATES.subscriptionReminder(user, daysLeft),
    name: FROM_NAME,
  });
}
function sendReengagementEmail(user) {
  GmailApp.sendEmail(user.email, 'আমরা আপনাকে মিস করছি — ফিরে আসুন', '', {
    htmlBody: HTML_TEMPLATES.reengagement(user),
    name: FROM_NAME,
  });
}
function sendPaymentSuccessEmail(user) {
  GmailApp.sendEmail(user.email, 'পেমেন্ট সফল হয়েছে — ধন্যবাদ!', '', {
    htmlBody: HTML_TEMPLATES.paymentSuccess(user),
    name: FROM_NAME,
  });
}

// ✅ এখানে আপনার নিজের বানানো HTML টেমপ্লেট বসান (স্ট্রিং রিটার্ন করবে)
const HTML_TEMPLATES = {
  welcome: (user) => `<p>প্রিয় ${user.displayName || user.email},</p><p>স্বাগতম! [আপনার টেমপ্লেট এখানে বসান]</p>`,
  trialReminder: (user, daysLeft) => `<p>প্রিয় ${user.displayName || user.email},</p><p>আপনার ট্রায়াল আর ${daysLeft} দিনে শেষ হবে। [আপনার টেমপ্লেট এখানে বসান]</p>`,
  subscriptionReminder: (user, daysLeft) => `<p>প্রিয় ${user.displayName || user.email},</p><p>সাবস্ক্রিপশন আর ${daysLeft} দিনে শেষ হবে। [আপনার টেমপ্লেট এখানে বসান]</p>`,
  reengagement: (user) => `<p>প্রিয় ${user.displayName || user.email},</p><p>[আপনার টেমপ্লেট এখানে বসান]</p>`,
  paymentSuccess: (user) => `<p>প্রিয় ${user.displayName || user.email},</p><p>ধন্যবাদ! [আপনার টেমপ্লেট এখানে বসান]</p>`,
};

// ════════════════════════════════════════════════════════════
// TRIGGER INSTALLER — একবারই ম্যানুয়ালি রান করুন
// ════════════════════════════════════════════════════════════
function createDailyTrigger() {
  // ডুপ্লিকেট ট্রিগার এড়াতে — আগে থাকলে প্রথমে মুছে দেওয়া হচ্ছে
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === 'dailyEmailJob') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyEmailJob')
    .timeBased()
    .everyDays(1)
    .atHour(9) // সকাল ৯টা, Project Settings-এর timezone (Asia/Dhaka) অনুযায়ী
    .create();
  console.log('দৈনিক ট্রিগার ইনস্টল হয়েছে — প্রতিদিন সকাল ৯টার আশেপাশে চলবে।');
}

// ✅ টেস্টের জন্য — ট্রিগার ছাড়াই ম্যানুয়ালি একবার চালিয়ে দেখতে পারবেন
function testRunNow() {
  dailyEmailJob();
}
