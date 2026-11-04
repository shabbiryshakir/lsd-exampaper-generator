// Feedback and problem reports from teachers.
//
// There is no server of our own, so a report goes two ways at once:
//   1. It is saved in the `feedback` collection in Firestore. The owner reads it, answers it and ticks
//      it off in the Admin panel (Menu -> Admin -> Feedback). Offline reports are kept on the device
//      and sent by Firestore when the internet is back.
//   2. It is emailed to FEEDBACK_EMAIL through FormSubmit (formsubmit.co, free, no account). The very
//      first report makes FormSubmit send ONE confirmation email to that address: open it and press
//      "Activate". After that every report arrives as an ordinary email.
import { db } from '../firebase'
import { collection, doc, setDoc, getDocs, query, where, limit, updateDoc, deleteDoc } from 'firebase/firestore'
import { BRAND, BUILD_TIME } from './brand'
import { LATEST_VERSION } from './whatsNew'

export const FEEDBACK_EMAIL = 'shabbiryshakir@gmail.com';

export const FEEDBACK_KINDS = [
  { id: 'problem', icon: 'Bug', label: 'Something is wrong', placeholder: 'What happened? What did you expect to happen?' },
  { id: 'idea', icon: 'Lightbulb', label: 'I have an idea', placeholder: 'What would make the app better for you and your colleagues?' },
  { id: 'question', icon: 'CircleHelp', label: 'I have a question', placeholder: 'What would you like to know?' },
  { id: 'praise', icon: 'Heart', label: 'Say thanks', placeholder: 'What do you like? It helps us know what to keep.' },
];

// Facts that help find a bug. Never includes any paper content.
export const diagnostics = (extra = {}) => ({
  app: `${BRAND.name} ${LATEST_VERSION}`,
  build: BUILD_TIME,
  browser: navigator.userAgent,
  screen: `${window.innerWidth}x${window.innerHeight}`,
  installed: !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true),
  online: navigator.onLine,
  page: extra.page || '',
  ...(extra.note ? { note: extra.note } : {}),
});

const withTimeout = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

// Returns { saved, queued, emailed }. `queued` = kept on the device until the internet returns.
export async function sendFeedback(user, { kind, message, diag }) {
  const now = new Date().toISOString();
  const entry = {
    kind, message: message.trim(), status: 'new', createdAt: now,
    userId: user?.uid || '', name: user?.displayName || '', email: user?.email || '',
    diag: diag || null,
  };
  const result = { saved: false, queued: false, emailed: false };

  const save = async () => {
    const write = setDoc(doc(collection(db, 'feedback')), entry);
    if (!navigator.onLine) { write.catch(() => {}); result.queued = true; return; }
    try { await withTimeout(write, 9000); result.saved = true; }
    catch (e) { if (e?.message === 'timeout') result.queued = true; else console.error('Feedback save failed', e); }
  };
  const email = async () => {
    if (!navigator.onLine) return;
    try {
      const r = await withTimeout(fetch(`https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          _subject: `[${BRAND.name}] ${kind}: ${entry.message.slice(0, 60)}`,
          _template: 'table', _captcha: 'false',
          name: entry.name || 'A teacher', email: entry.email || FEEDBACK_EMAIL,
          type: kind, message: entry.message, ...(diag || {}),
        }),
      }), 9000);
      result.emailed = r.ok;
    } catch { /* the Firestore copy is the one that counts */ }
  };
  await Promise.all([save(), email()]);
  return result;
}

// ---- for the owner (Admin panel) ----
export const countNewFeedback = async () => {
  const snap = await getDocs(query(collection(db, 'feedback'), where('status', '==', 'new'), limit(99)));
  return snap.size;
};
export const loadFeedback = async () => {
  const snap = await getDocs(collection(db, 'feedback'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
};
export const setFeedbackStatus = (id, status) => updateDoc(doc(db, 'feedback', id), { status });
export const removeFeedback = (id) => deleteDoc(doc(db, 'feedback', id));
