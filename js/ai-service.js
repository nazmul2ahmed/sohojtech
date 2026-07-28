'use strict';

const AI_PROXY_URL = 'https://script.google.com/macros/s/আপনার-deployment-id/exec';

async function callAiTask(task, payload) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('লগইন করা নেই।');

  const idToken = await user.getIdToken();
  const ownerUid = APP_STATE.tenantUid || user.uid;

  const resp = await fetch(AI_PROXY_URL, {
    method: 'POST',
    body: JSON.stringify({ idToken, ownerUid, task, payload }),
  });

  const result = await resp.json();
  if (!result.success) throw new Error(result.message || 'AI সার্ভিস ব্যর্থ হয়েছে।');
  return result; // { success, provider, data }
}

// ব্যবহার উদাহরণ (Step 3-4-এ পুরোপুরি ইন্টিগ্রেট হবে):
// const res = await callAiTask('purchaseInvoiceReader', { imageBase64 });
// console.log(res.data.items); // [{brand, qty, purchasePrice, mrp, expiryDate}, ...]
