'use strict';

let fbAuth = null;
let fbDb = null;
let userDocUnsub = null;
let mainAppBooted = false;
let tenantOwnerUnsub = null; // ✅ [Track A - A.3]

function initAuthGate() {
  try {
    firebase.initializeApp(APP_CONFIG.firebase);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') console.warn('Persistence: একাধিক ট্যাবে দ্বন্দ্ব।');
      else if (err.code === 'unimplemented') console.warn('Persistence: সাপোর্ট নেই।');
    });
  } catch (err) {
    showFatalError('Firebase init সমস্যা:\n' + err.message);
    return;
  }

  fbAuth.onAuthStateChanged((user) => {
    if (userDocUnsub) { userDocUnsub(); userDocUnsub = null; }
    if (tenantOwnerUnsub) { tenantOwnerUnsub(); tenantOwnerUnsub = null; } // ✅ নতুন
    mainAppBooted = false;

    if (!user) { showAuthScreen('login'); return; }
    setLoadingMessage('প্রোফাইল যাচাই হচ্ছে...');
    watchUserProfile(user);
  }, (err) => showFatalError('Auth স্টেট শোনার সময় সমস্যা:\n' + err.message));
}

function watchUserProfile(user) {
  const ref = fbDb.collection('users').doc(user.uid);
  userDocUnsub = ref.onSnapshot(async (snap) => {
    if (!snap.exists) { await handleFirstLogin(user, ref); return; }
    handleProfileSnapshot(user, { uid: user.uid, ...snap.data() });
  }, (err) => showFatalError('প্রোফাইল শোনার সময় সমস্যা:\n' + err.message));
}

// ✅ [Track A - A.3] প্রথম লগইন — pending staff invite থাকলে সেটা accept করে
// staff profile + roster এন্ট্রি তৈরি করে; না থাকলে আগের মতোই owner/trial।
async function handleFirstLogin(user, ref) {
  try {
    const emailLower = (user.email || '').toLowerCase();
    const inviteSnap = await fbDb.collectionGroup('staffInvites')
      .where('email', '==', emailLower).limit(5).get();
    const pendingInvite = inviteSnap.docs.find(d => d.data().status === 'pending');

    if (pendingInvite) {
      const ownerUid = pendingInvite.ref.parent.parent.id;
      const role = pendingInvite.data().role;

      const staffProfile = {
        email: user.email, displayName: user.displayName || '', photoURL: user.photoURL || '',
        status: 'staff', memberOfOwnerUid: ownerUid, memberRole: role,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      const rosterEntry = {
        uid: user.uid, email: user.email, displayName: user.displayName || '',
        role, status: 'active', joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      const batch = fbDb.batch();
      batch.set(ref, staffProfile);
      batch.set(fbDb.collection('users').doc(ownerUid).collection('staff').doc(user.uid), rosterEntry);
      await batch.commit();

      // invite consume — batch-এর পরে, আলাদা call (rules-এ roster-create-এর
      // সময় invite এখনো exist করা লাগে বলে delete আগে করা যাবে না)
      await pendingInvite.ref.delete().catch(() => {});
      return; // onSnapshot আবার ফায়ার হবে নতুন profile নিয়ে
    }

    const isOwner = user.email === APP_CONFIG.ADMIN_EMAIL;
    const newProfile = {
      email: user.email, displayName: user.displayName || '', photoURL: user.photoURL || '',
      status: 'trial', role: isOwner ? 'owner' : 'user',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(newProfile);
    if (isOwner) await ref.update({ status: 'approved' });
  } catch (err) {
    showFatalError('প্রোফাইল তৈরি করতে সমস্যা:\n' + err.message);
  }
}

// ✅ profile snapshot এলে — staff না owner অনুযায়ী দুই ভিন্ন পথে dispatch
function handleProfileSnapshot(user, profile) {
  if (profile.status === 'staff' && profile.memberOfOwnerUid) {
    APP_STATE.isStaffMember = true;
    APP_STATE.staffRole = profile.memberRole;
    APP_STATE.tenantUid = profile.memberOfOwnerUid;
    APP_STATE.isAdmin = false;

    if (tenantOwnerUnsub) tenantOwnerUnsub();
    tenantOwnerUnsub = fbDb.collection('users').doc(profile.memberOfOwnerUid).onSnapshot((ownerSnap) => {
      if (!ownerSnap.exists) return;
      applyTenantStatus(profile, ownerSnap.data());
    }, (err) => showFatalError('মালিকের প্রোফাইল শোনার সময় সমস্যা:\n' + err.message));
    return;
  }

  APP_STATE.isStaffMember = false;
  APP_STATE.staffRole = null;
  APP_STATE.tenantUid = user.uid;
  applyUserProfile(user, profile);
}

// ✅ staff-এর readOnly/statusInfo owner-এর trial/subscription থেকে গণনা হয়
function applyTenantStatus(staffProfile, ownerProfile) {
  APP_STATE.currentUser = staffProfile; // uid = staff-এর নিজের actual uid (audit trail-এর জন্য)

  let statusInfo;
  if (ownerProfile.status === 'approved') {
    const subDays = subscriptionDaysLeft(ownerProfile);
    if (subDays === Infinity || subDays > 0) { APP_STATE.readOnly = false; statusInfo = { mode: 'approved', subDaysLeft: subDays === Infinity ? null : subDays }; }
    else { APP_STATE.readOnly = true; statusInfo = { mode: 'subscription-expired' }; }
  } else if (ownerProfile.status === 'revoked') {
    APP_STATE.readOnly = true; statusInfo = { mode: 'revoked' };
  } else {
    const daysLeft = trialDaysLeft(ownerProfile);
    if (daysLeft > 0) { APP_STATE.readOnly = false; statusInfo = { mode: 'trial', daysLeft }; }
    else { APP_STATE.readOnly = true; statusInfo = { mode: 'trial-expired' }; }
  }
  APP_STATE.subscriptionStatusInfo = statusInfo;
  unlockApp(staffProfile, statusInfo);
}

function trialDaysLeft(profile) {
  if (!profile.createdAt || !profile.createdAt.toDate) return APP_CONFIG.TRIAL_DAYS;
  const elapsedDays = (Date.now() - profile.createdAt.toDate().getTime()) / 86400000;
  return Math.ceil(APP_CONFIG.TRIAL_DAYS - elapsedDays);
}
function subscriptionDaysLeft(profile) {
  if (!profile.subscriptionExpiresAt || !profile.subscriptionExpiresAt.toDate) return Infinity;
  return Math.ceil((profile.subscriptionExpiresAt.toDate().getTime() - Date.now()) / 86400000);
}

function applyUserProfile(user, profile) {
  APP_STATE.currentUser = profile;
  APP_STATE.isAdmin = profile.email === APP_CONFIG.ADMIN_EMAIL;

  let statusInfo;
  if (profile.status === 'approved') {
    const subDays = subscriptionDaysLeft(profile);
    if (subDays === Infinity || subDays > 0) { APP_STATE.readOnly = false; statusInfo = { mode: 'approved', subDaysLeft: subDays === Infinity ? null : subDays }; }
    else { APP_STATE.readOnly = true; statusInfo = { mode: 'subscription-expired' }; }
  } else if (profile.status === 'revoked') {
    APP_STATE.readOnly = true; statusInfo = { mode: 'revoked' };
  } else {
    const daysLeft = trialDaysLeft(profile);
    if (daysLeft > 0) { APP_STATE.readOnly = false; statusInfo = { mode: 'trial', daysLeft }; }
    else { APP_STATE.readOnly = true; statusInfo = { mode: 'trial-expired' }; }
  }
  APP_STATE.subscriptionStatusInfo = statusInfo;
  unlockApp(profile, statusInfo);
}

function unlockApp(profile, statusInfo) {
  showAuthScreen(null);
  renderUserBadge(profile, statusInfo);
  if (typeof maybeScheduleSubscriptionPromo === 'function') maybeScheduleSubscriptionPromo(statusInfo);
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
  if (tenantOwnerUnsub) { tenantOwnerUnsub(); tenantOwnerUnsub = null; } // ✅ নতুন
  mainAppBooted = false;
  fbAuth.signOut().then(() => location.reload());
}

function showAuthScreen(name) {
  document.getElementById('app-loading')?.classList.add('hide');
  ['screen-login', 'screen-trial-expired', 'screen-revoked'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  if (name) document.getElementById('screen-' + name)?.classList.remove('hidden');
}

function renderUserBadge(profile, statusInfo) {
  // ... অপরিবর্তিত (আগের কোডের হুবহু একই)

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
