import { useState } from 'react'
import Icon from './Icon'
import { FEEDBACK_KINDS, sendFeedback, diagnostics } from '../lib/feedback'

const COOLDOWN_MS = 15000;
let lastSent = 0;

// Content of the "Send feedback" window. `context` = { page, note } says where the teacher was.
export default function FeedbackForm({ user, context, initialKind = 'problem', initialMessage = '', onClose }) {
  const [kind, setKind] = useState(initialKind);
  const [message, setMessage] = useState(initialMessage);
  const [withDetails, setWithDetails] = useState(true);
  const [state, setState] = useState('edit'); // edit | sending | done | error
  const [result, setResult] = useState(null);
  const current = FEEDBACK_KINDS.find(k => k.id === kind);
  const ready = message.trim().length >= 5;

  const submit = async () => {
    if (!ready || state === 'sending') return;
    if (Date.now() - lastSent < COOLDOWN_MS) { setState('error'); return; }
    setState('sending');
    const r = await sendFeedback(user, { kind, message, diag: withDetails ? diagnostics(context) : null });
    if (r.saved || r.queued || r.emailed) { lastSent = Date.now(); setResult(r); setState('done'); } else setState('error');
  };

  if (state === 'done') {
    return (
      <div className="text-center py-6">
        <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mx-auto mb-4"><Icon name="Check" size={32} strokeWidth={3} /></div>
        <h3 className="text-xl font-extrabold text-slate-900 mb-2">Thank you!</h3>
        <p className="text-slate-600 mb-1">{result?.queued && !result?.saved ? 'Your message is saved on this device and will be sent as soon as you are online.' : 'Your message has reached us. We read every one.'}</p>
        <p className="text-sm text-slate-500 mb-6">If we need to know more, we will write to {user?.email || 'you'}.</p>
        <button type="button" onClick={onClose} className="bg-brand-700 text-white font-bold rounded-2xl px-8 py-3">Done</button>
      </div>
    );
  }

  return (
    <div>
      <p className="text-slate-600 mb-4">Tell us what is wrong, what you wish the app could do, or just say hello. It goes straight to the person who makes this app.</p>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {FEEDBACK_KINDS.map(k => (
          <button key={k.id} type="button" onClick={() => setKind(k.id)} className={`flex items-center gap-2 rounded-2xl border-2 px-3 py-2.5 text-start text-sm font-bold ${kind === k.id ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200 text-slate-600 hover:border-brand-300'}`}>
            <Icon name={k.icon} size={18} />{k.label}
          </button>
        ))}
      </div>
      <label className="block text-sm font-bold text-slate-600 mb-1" htmlFor="fb-message">Your message</label>
      <textarea id="fb-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={5} maxLength={3000} dir="auto" placeholder={current.placeholder}
        className="w-full border border-slate-300 rounded-2xl px-4 py-3 text-base leading-relaxed focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none resize-y" />
      <label className="flex items-start gap-3 mt-3 text-sm text-slate-600 cursor-pointer select-none">
        <input type="checkbox" checked={withDetails} onChange={(e) => setWithDetails(e.target.checked)} className="w-5 h-5 mt-0.5 accent-brand-600 shrink-0" />
        <span><b>Include technical details</b> (app version, phone or browser, screen). It helps us fix problems faster. Your papers are never sent.</span>
      </label>
      <p className="text-xs text-slate-400 mt-3">Your name and email ({user?.email}) are sent with the message so we can reply.</p>
      {state === 'error' && <p className="mt-3 text-sm font-bold text-red-600 bg-red-50 rounded-xl px-3 py-2">Could not send just now. Please check your internet and try again in a moment.</p>}
      <button type="button" onClick={submit} disabled={!ready || state === 'sending'} className="mt-4 w-full bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-2xl py-3.5 inline-flex items-center justify-center gap-2 disabled:opacity-50">
        <Icon name={state === 'sending' ? 'Loader2' : 'Send'} size={18} />{state === 'sending' ? 'Sending…' : 'Send'}
      </button>
    </div>
  );
}
