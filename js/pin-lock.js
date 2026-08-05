'use strict';

// ════════════════════════════════════════════════════════════
// ✅ PIN-LOCK — growth-polish.md আইটেম ২৩
// shared/counter ডিভাইসের জন্য — ৫ মিনিট idle বা ফ্রেশ বুটে PIN চাইবে।
// ⚠️ এটা UX-level protection, real security না — PIN hash Firestore-এ
// config/settings doc-এ থাকে যা tenant member (owner+staff) সবাই read
// করতে পারে (client-side compare করতে হয় বলে hidden রাখা সম্ভব না,
// client-side AES এনক্রিপশনের মতোই এটা documented trade-off)। উদ্দেশ্য
// device-level casual access ঠেকানো, cryptographic security না।
// ════════════════════════════════════════════════════════════

const PIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // ৫ মিনিট, ফিক্সড (Phase ১)
const PIN_ACTIVITY_EVENTS = ['click', 'keydown', 'touchstart', 'mousemove'];

let _pinLastActivityAt = Date.now();
let _pinHiddenAt = null;
let _pinLocked = false;
let _pinCheckInterval = null;

// ✅ app.js-এর initApp()-এর শেষে একবার কল হয় — ডেটা লোড হওয়ার পর
function initPinLock() {
  if (!APP_STATE.pinLockEnabled) return;
  startPinLockListeners();
  showPinLockScreen(); // ✅ ফ্রেশ বুটেও লক — নাহলে ট্যাব বন্ধ/রিলোড করে
                        // idle-timer বাইপাস করা যেত (Firebase session persist করে)
}

function startPinLockListeners() {
  if (_pinCheckInterval) return; // ইতিমধ্যে চালু আছে
  _pinLastActivityAt = Date.now();
  PIN_ACTIVITY_EVENTS.forEach(evt => document.addEventListener(evt, markPinActivity, { passive: true }));
  document.addEventListener('visibilitychange', handlePinVisibilityChange);
  _pinCheckInterval = setInterval(() => {
    if (!APP_STATE.pinLockEnabled || _pinLocked) return;
    if (Date.now() - _pinLastActivityAt >= PIN_IDLE_TIMEOUT_MS) showPinLockScreen();
  }, 15000); // ১৫ সেকেন্ড পরপর চেক — ব্যাটারি-বান্ধব, যথেষ্ট নিরাপদ মার্জিন
}

function stopPinLockListeners() {
  if (_pinCheckInterval) { clearInterval(_pinCheckInterval); _pinCheckInterval = null; }
  document.removeEventListener('visibilitychange', handlePinVisibilityChange);
  PIN_ACTIVITY_EVENTS.forEach(evt => document.removeEventListener(evt, markPinActivity));
}

function handlePinVisibilityChange() {
  if (!APP_STATE.pinLockEnabled) return;
  if (document.visibilityState === 'hidden') {
    _pinHiddenAt = Date.now();
  } else if (document.visibilityState === 'visible') {
    if (_pinHiddenAt && (Date.now() - _pinHiddenAt) >= PIN_IDLE_TIMEOUT_MS) showPinLockScreen();
    _pinHiddenAt = null;
    markPinActivity();
  }
}

function markPinActivity() {
  _pinLastActivityAt = Date.now();
}

function hashPin(pin) {
  const enc = new TextEncoder().encode(pin);
  return crypto.subtle.digest('SHA-256', enc).then(buf =>
    Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
  );
}

function showPinLockScreen() {
  if (_pinLocked || document.getElementById('pin-lock-overlay')) return;
  _pinLocked = true;

  const overlay = document.createElement('div');
  overlay.id = 'pin-lock-overlay';
  overlay.className = 'fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-blue-800 p-6';
  overlay.innerHTML = `
    <div class="w-16 h-16 rounded-2xl bg-white/10 border-2 border-white/20 flex items-center justify-center mb-5">
      <i class="fa-solid fa-lock text-2xl text-white"></i>
    </div>
    <h2 class="text-lg font-bold text-white mb-1">PIN দিয়ে আনলক করুন</h2>
    <p class="text-xs text-white/50 mb-6">এই ডিভাইস নিষ্ক্রিয় ছিল — নিরাপত্তার জন্য লক করা হয়েছে</p>
    <div id="pin-lock-error" class="hidden text-red-300 text-xs mb-3"></div>
    <input type="password" id="pin-lock-input" inputmode="numeric" maxlength="4" placeholder="●●●●"
      oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,4)"
      class="w-40 text-center text-2xl tracking-[0.5em] px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 outline-none focus:ring-2 focus:ring-white/40 mb-4"/>
    <button id="pin-lock-submit-btn" class="bg-white text-slate-800 font-semibold px-6 py-2.5 rounded-xl mb-6">আনলক করুন</button>
    <button id="pin-lock-logout-btn" class="text-white/40 hover:text-white/70 text-xs underline">PIN ভুলে গেছেন? লগআউট করুন</button>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById('pin-lock-input');
  const errEl = document.getElementById('pin-lock-error');
  input.focus();

  const attemptUnlock = async () => {
    const val = input.value.trim();
    if (val.length !== 4) { errEl.textContent = '৪ ডিজিটের PIN দিন।'; errEl.classList.remove('hidden'); return; }
    const hash = await hashPin(val);
    if (hash === APP_STATE.pinHash) {
      overlay.remove();
      _pinLocked = false;
      markPinActivity();
    } else {
      errEl.textContent = 'ভুল PIN — আবার চেষ্টা করুন।';
      errEl.classList.remove('hidden');
      input.value = '';
      input.focus();
    }
  };

  document.getElementById('pin-lock-submit-btn').addEventListener('click', attemptUnlock);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptUnlock(); });
  document.getElementById('pin-lock-logout-btn').addEventListener('click', () => {
    if (confirm('লগআউট করবেন? আবার Google দিয়ে লগইন করে নতুন PIN সেট করতে হবে।')) {
      overlay.remove();
      _pinLocked = false;
      signOutUser();
    }
  });
}

// ✅ Settings থেকে enable/disable/change হলে runtime state সাথে সাথে sync —
// পেজ রিফ্রেশ ছাড়াই idle-timer চালু/বন্ধ হবে
function applyPinLockStateChange(enabled, hashHex) {
  APP_STATE.pinLockEnabled = enabled;
  if (hashHex !== undefined) APP_STATE.pinHash = hashHex;
  if (enabled) {
    startPinLockListeners();
    markPinActivity();
  } else {
    stopPinLockListeners();
    document.getElementById('pin-lock-overlay')?.remove();
    _pinLocked = false;
  }
}
