// Lightweight usage tracking for the admin "Activity" tab: who is online, what they did and when.
// Everything is best-effort — a failure never disturbs the teacher.
import { addDoc, collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const clip = (s, n = 300) => String(s ?? '').slice(0, n);

export function logEvent(type, data = {}) {
  const u = auth.currentUser;
  if (!u || u.uid === 'demo') return;
  addDoc(collection(db, 'events'), {
    userId: u.uid, name: clip(u.displayName, 80), email: clip(u.email, 120), type, data,
    installed: standalone(), at: new Date().toISOString(), ts: serverTimestamp(),
  }).catch(() => {});
}

let timer = null;
/** Marks the teacher as online now and refreshes every minute while the app is visible. */
export function startPresence(user) {
  stopPresence();
  if (!user || user.uid === 'demo') return;
  const beat = () => {
    if (document.visibilityState === 'hidden') return;
    setDoc(doc(db, 'presence', user.uid), {
      name: clip(user.displayName, 80), email: clip(user.email, 120), installed: standalone(),
      notifications: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
      lastSeen: new Date().toISOString(),
    }, { merge: true }).catch(() => {});
  };
  beat();
  timer = setInterval(beat, 60000);
  document.addEventListener('visibilitychange', beat);
}
export function stopPresence() { if (timer) clearInterval(timer); timer = null; }

// Words that turned into Lisan while typing in a paper: sent as one event every ~20 seconds (not one per word).
let words = [], wordTimer = null;
const flushWords = () => {
  clearTimeout(wordTimer); wordTimer = null;
  if (!words.length) return;
  const w = words; words = [];
  logEvent('lisan_typing', { words: w });
};
export function trackWord(en, lisan) {
  if (words.length < 40) words.push([clip(en, 40).toLowerCase(), clip(lisan, 60)]);
  if (!wordTimer) wordTimer = setTimeout(flushWords, 20000);
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushWords(); });
