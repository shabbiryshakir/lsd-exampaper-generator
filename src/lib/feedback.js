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
import { collection, doc, setDoc, getDocs, query, where, limit, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore'
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

/** Live count of new messages (admin only), so a new report shows up while the app is open. */
export const watchNewFeedback = (onChange) => onSnapshot(
  query(collection(db, 'feedback'), where('status', '==', 'new'), limit(99)),
  (snap) => onChange(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
  () => {},
);

/** A system notification on this device (asks once for permission). */
export const notificationsOn = () => typeof Notification !== 'undefined' && Notification.permission === 'granted';
export const askForNotifications = async () => {
  if (typeof Notification === 'undefined') { alert('This browser cannot show notifications. Try Chrome, or install the app on your phone.'); return false; }
  return (await Notification.requestPermission()) === 'granted';
};
export const notify = async (title, body) => {
  if (!notificationsOn()) return;
  const opts = { body, icon: `${import.meta.env.BASE_URL}pwa-192.png`, badge: `${import.meta.env.BASE_URL}pwa-192.png`, tag: 'feedback' };
  // iPhones (installed app) and Android only show notifications through the service worker.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) { await reg.showNotification(title, opts); return; }
  } catch { /* fall back below */ }
  try { const n = new Notification(title, opts); n.onclick = () => { window.focus(); n.close(); }; } catch { /* not supported */ }
};

const KIND_WORDS = { problem: 'the problem you reported', idea: 'your idea', question: 'your question', praise: 'your kind words' };
const KIND_TITLE = { problem: 'Your problem report', idea: 'Your idea', question: 'Your question', praise: 'Your message' };
export const SIGNATURE = { name: 'M Shabbir Shakir', role: `${BRAND.name}` };

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const paras = (t) => esc(t).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');

/** The reply as a themed HTML email (inline styles only, so Gmail keeps them) plus a plain-text copy. */
export function replyEmail(x, reply) {
  const first = (x.name || '').trim().split(/\s+/)[0] || 'there';
  const when = x.createdAt ? new Date(x.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const subject = `Re: ${KIND_TITLE[x.kind] || 'Your message'} — ${BRAND.name}`;
  const app = 'https://shabbiryshakir.github.io/lsd-exampaper-generator/';
  const html = `<div style="background:#effaf8;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d6f2ed">
<tr><td style="background:#15403e;padding:20px 24px;color:#ffffff">
<div style="font-size:20px;font-weight:bold;letter-spacing:.2px">${esc(BRAND.name)}</div>
<div style="font-size:13px;color:#ade4da;margin-top:2px">${esc(BRAND.tagline)}</div>
</td></tr>
<tr><td style="padding:24px;font-size:15px;line-height:1.6">
<p style="margin:0 0 14px">Salaam ${esc(first)},</p>
<p style="margin:0 0 14px">Shukran for writing to us about ${esc(KIND_WORDS[x.kind] || 'your message')}.</p>
${paras(reply)}
<p style="margin:0 0 14px">If anything else comes up, just reply to this email or use <b>Menu → Send feedback</b> in the app.</p>
<p style="margin:20px 0 0">Shukran,<br><b>${esc(SIGNATURE.name)}</b><br><span style="color:#64748b;font-size:13px">${esc(SIGNATURE.role)}</span></p>
</td></tr>
<tr><td style="padding:0 24px 24px">
<div style="background:#f8fafc;border-left:4px solid #27968b;border-radius:8px;padding:12px 14px;font-size:13px;color:#475569">
<div style="font-weight:bold;color:#18625d;margin-bottom:4px">Your message${when ? ` · ${esc(when)}` : ''}</div>
<div dir="auto">${esc(x.message).replace(/\n/g, '<br>')}</div>
</div>
</td></tr>
<tr><td style="padding:14px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:12px;color:#64748b">
<a href="${app}" style="display:inline-block;background:#18625d;color:#ffffff;text-decoration:none;font-weight:bold;padding:9px 18px;border-radius:10px;margin-bottom:8px">Open ${esc(BRAND.name)}</a><br>
A free community tool for LSD teachers
</td></tr>
</table></div>`;
  const text = [`Salaam ${first},`, '', `Shukran for writing to us about ${KIND_WORDS[x.kind] || 'your message'}.`, '', reply, '',
    'If anything else comes up, just reply to this email or use Menu → Send feedback in the app.', '', 'Shukran,', SIGNATURE.name, SIGNATURE.role,
    '', '———', `Your message${when ? ` (${when})` : ''}:`, x.message || ''].join('\n');
  return { subject, html, text };
}

/** Gmail compose window (as the owner's account) with the address and subject filled in. */
export const gmailCompose = (to, subject) => `https://mail.google.com/mail/?${new URLSearchParams({ view: 'cm', fs: '1', authuser: FEEDBACK_EMAIL, to: to || '', su: subject }).toString()}`;

/** Puts the formatted email on the clipboard, so pasting into Gmail keeps the design. */
export async function copyEmail({ html, text }) {
  try {
    if (window.ClipboardItem && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
      return 'html';
    }
  } catch { /* fall through */ }
  try { await navigator.clipboard.writeText(text); return 'text'; } catch { return null; }
}
export const markReplied = (id) => updateDoc(doc(db, 'feedback', id), { status: 'done', repliedAt: new Date().toISOString() });
