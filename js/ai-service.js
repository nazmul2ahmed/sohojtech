const AI_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwDsU7EaQP2J7F1vWaYuO5nOntu6CTv07xQfX9dFFXpWyFCOkjNkyw9M6XyKucAp4Ey/exec';

async function callAiTask(task, payload) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('লগইন করা নেই।');

  const idToken = await user.getIdToken();
  const ownerUid = APP_STATE.tenantUid || user.uid;

  const resp = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },  // ✅ preflight এড়াতে
    body: JSON.stringify({ idToken, ownerUid, task, payload }),
  });

  const result = await resp.json();
  if (!result.success) throw new Error(result.message || 'AI সার্ভিস ব্যর্থ হয়েছে।');
  return result;
}
