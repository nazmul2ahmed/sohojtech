'use strict';

// ════════════════════════════════════════════════════════════
// FIREBASE AUTH — Google Sign-In + ১৫-দিন Trial + Admin Approval
// ✅ ফিক্স: Revoked/Expired-Trial এখন সম্পূর্ণ ব্লক না — অ্যাপে ঢুকতে
// পারবে (Read-Only), শুধু একটা সতর্কতা ব্যানার দেখাবে। Write করার
// চেষ্টা করলে Firestore Security Rules নিজেই আটকাবে (server-side
// আসল নিরাপত্তা, ক্লায়েন্ট UI শুধু জানিয়ে দেয়)।
// ✅ [নতুন, priority-fixes.md-এর বাইরে] Subscription promo trigger —
// unlockApp()-এ statusInfo সহ maybeScheduleSubscriptionPromo() কল হয়,
// যা subscription-promo.js-এ ডিফাইন করা (ট্রায়াল/renewal-nearing
// ইউজারদের জন্য প্ল্যান-পপআপ শিডিউল করে)।
// ════════════════════════════════════════════════════════════

let fbAuth = null;
let fbDb = null;
let userDocUnsub = null;
let mainAppBooted = false;

function initAuthGate() {
  try {
    firebase.initializeApp(APP_CONFIG.firebase);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();

    // ✅ Offline Persistence — Firestore instance পাওয়ার সাথে সাথেই, অন্য কোনো
    // read/write শুরুর আগে কল করতে হয় (এটাই Firebase-এর নির্ধারিত প্যাটার্ন)।
    // synchronizeTabs:true দিলে একাধিক ট্যাব একসাথে খোলা থাকলেও কাজ করবে।
    fbDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistence: একাধিক ট্যাবে দ্বন্দ্ব — শুধু একটাতেই সক্রিয় থাকবে।');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistence: এই ব্রাউজার অফলাইন-ক্যাশ সাপোর্ট করে না।');
      }
    });
  } catch (err) {
    showFatalError('Firebase init সমস্যা:\n' + err.message);
    return;
  }

  fbAuth.onAuthStateChanged((user) => {
    if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
    mainAppBooted = false;

    if (!user) {
      showAuthScreen('login');
      return;
    }
    setLoadingMessage('প্রোফাইল যাচাই হচ্ছে...');
    watchUserProfile(user);
  }, (err) => {
    showFatalError('Auth স্টেট শোনার সময় সমস্যা:\n' + err.message);
  });
}

function watchUserProfile(user) {
  const ref = fbDb.collection('users').doc(user.uid);

  userDocUnsub = ref.onSnapshot(async (snap) => {
    if (!snap.exists) {
      const isOwner = user.email === APP_CONFIG.ADMIN_EMAIL;
      const newProfile = {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        status: 'trial',
        role: isOwner ? 'owner' : 'user',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      try {
        await ref.set(newProfile);
        if (isOwner) await ref.update({ status: 'approved' });
      } catch (err) {
        showFatalError('প্রোফাইল তৈরি করতে সমস্যা:\n' + err.message);
      }
      return;
    }
    applyUserProfile(user, { uid: user.uid, ...snap.data() });
  }, (err) => {
    showFatalError('প্রোফাইল শোনার সময় সমস্যা:\n' + err.message);
  });
}

function trialDaysLeft(profile) {
  if (!profile.createdAt || !profile.createdAt.toDate) return APP_CONFIG.TRIAL_DAYS;
  const createdMs = profile.createdAt.toDate().getTime();
  const elapsedDays = (Date.now() - createdMs) / (1000 * 60 * 60 * 24);
  return Math.ceil(APP_CONFIG.TRIAL_DAYS - elapsedDays);
}

// ✅ ফিক্স: Revoked ও Expired-Trial — দুটোই এখন unlockApp() কল করে,
// শুধু readOnly ফ্ল্যাগ ও ভিন্ন ব্যানার সহ। কোনো hard-lockout screen না।
function subscriptionDaysLeft(profile) {
  if (!profile.subscriptionExpiresAt || !profile.subscriptionExpiresAt.toDate) return Infinity;
  return Math.ceil((profile.subscriptionExpiresAt.toDate().getTime() - Date.now()) / 86400000);
}

function applyUserProfile(user, profile) {
  APP_STATE.currentUser = profile;
  APP_STATE.isAdmin = profile.email === APP_CONFIG.ADMIN_EMAIL;

  if (profile.status === 'approved') {
    const subDays = subscriptionDaysLeft(profile);
    if (subDays === Infinity || subDays > 0) {
      APP_STATE.readOnly = false;
      unlockApp(profile, { mode: 'approved', subDaysLeft: subDays === Infinity ? null : subDays });
    } else {
      APP_STATE.readOnly = true;
      unlockApp(profile, { mode: 'subscription-expired' });
    }
  } else if (profile.status === 'revoked') {
    APP_STATE.readOnly = true;
    unlockApp(profile, { mode: 'revoked' });
  } else {
    const daysLeft = trialDaysLeft(profile);
    if (daysLeft > 0) { APP_STATE.readOnly = false; unlockApp(profile, { mode: 'trial', daysLeft }); }
    else { APP_STATE.readOnly = true; unlockApp(profile, { mode: 'trial-expired' }); }
  }
}
function unlockApp(profile, statusInfo) {
  showAuthScreen(null);
  renderUserBadge(profile, statusInfo);
  // ✅ [নতুন] সাবস্ক্রিপশন প্রমো — ট্রায়াল/renewal-nearing অবস্থায় শিডিউল করে,
  // অন্য mode-এ (approved সীমাহীন, revoked, trial-expired) কিছু করে না।
  // ফাংশনটা নিজেই session-dedup ও duplicate-schedule গার্ড করে, তাই
  // unlockApp() একাধিকবার (প্রতি profile snapshot-এ) কল হলেও নিরাপদ।
  if (typeof maybeScheduleSubscriptionPromo === 'function') {
    maybeScheduleSubscriptionPromo(statusInfo);
  }
  if (mainAppBooted) return;
  mainAppBooted = true;
  initApp();
}

function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(provider).catch((err) => toast('লগইন ব্যর্থ: ' + err.message, 'e'));
}

function signOutUser() {
  if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
  mainAppBooted = false;
  fbAuth.signOut().then(() => location.reload());
}

// 'screen-revoked' ও 'screen-trial-expired' এখন আর ব্যবহৃত হয় না (dead markup,
// ক্ষতি নেই রেখে দিলে) — শুধু 'login' এখনো hard-gate হিসেবে থেকে যাচ্ছে
function showAuthScreen(name) {
  document.getElementById('app-loading')?.classList.add('hide');
  ['screen-login', 'screen-trial-expired', 'screen-revoked'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  if (name) document.getElementById('screen-' + name)?.classList.remove('hidden');
}

function renderUserBadge(profile, statusInfo) {
  const el = document.getElementById('user-badge');
  if (el) {
    el.innerHTML = `
      ${profile.photoURL ? `<img src="${esc(profile.photoURL)}" class="w-7 h-7 rounded-full"/>` : ''}
      <span class="hidden sm:inline text-xs font-medium text-slate-600 dark:text-slate-300">${esc(profile.displayName || profile.email)}</span>
    `;
  }
  const banner = document.getElementById('trial-banner');
  if (!banner) return;

  if (statusInfo.mode === 'trial') {
    banner.className = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs sm:text-sm px-4 py-2 text-center';
    banner.classList.remove('hidden');
    // ✅ [নতুন] CTA বাটন — ক্লিক করলে subscription-promo.js-এর মডাল খুলবে
    banner.innerHTML = `<i class="fa-solid fa-clock mr-1.5"></i> ট্রায়াল চলছে — আর <b>${statusInfo.daysLeft}</b> দিন বাকি। মেয়াদ শেষে চালিয়ে যেতে সাবস্ক্রিপশন লাগবে। <button onclick="openSubscriptionPromo('trial')" class="ml-2 underline font-semibold hover:text-amber-800 dark:hover:text-amber-300">প্ল্যান দেখুন</button>`;
  } else if (statusInfo.mode === 'revoked' || statusInfo.mode === 'trial-expired' || statusInfo.mode === 'subscription-expired') {
    banner.className = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs sm:text-sm px-4 py-2 text-center font-medium';
    banner.classList.remove('hidden');
    const reason = statusInfo.mode === 'revoked' ? 'অ্যাকাউন্ট বাতিল করা হয়েছে' : statusInfo.mode === 'subscription-expired' ? 'সাবস্ক্রিপশনের মেয়াদ শেষ' : 'ট্রায়ালের মেয়াদ শেষ';
    banner.innerHTML = `<i class="fa-solid fa-lock mr-1.5"></i> ${reason} — এখন শুধু <b>পুরনো তথ্য দেখতে</b> পারবেন। সক্রিয় করতে <button onclick="openSubscriptionPromo('trial')" class="underline font-semibold hover:text-red-800 dark:hover:text-red-300">প্ল্যান দেখুন</button> অথবা মালিকের সাথে যোগাযোগ করুন।`;
  } else if (statusInfo.mode === 'approved' && statusInfo.subDaysLeft != null && statusInfo.subDaysLeft <= 7) {
    banner.className = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs sm:text-sm px-4 py-2 text-center';
    banner.classList.remove('hidden');
    // ✅ [নতুন] CTA বাটন — renewal ফ্রেমিং-এ মডাল খুলবে
    banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation mr-1.5"></i> সাবস্ক্রিপশন আর <b>${statusInfo.subDaysLeft}</b> দিনে শেষ হবে — <button onclick="openSubscriptionPromo('renewal', {daysLeft: ${statusInfo.subDaysLeft}})" class="underline font-semibold hover:text-amber-800 dark:hover:text-amber-300">এখনই রিনিউ করুন</button>`;
  } else {
    banner.classList.add('hidden');
  }
}
