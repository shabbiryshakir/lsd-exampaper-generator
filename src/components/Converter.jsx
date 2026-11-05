// English → Lisan converter: type in English letters, get Lisan script, fix any word and teach it to everyone.
import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { draftWord } from '../lib/lisanDraft'
import { teachWord } from '../lib/dictionary'
import { logEvent } from '../lib/activity'

const SOURCE = {
  learned: { label: 'Checked by a teacher', cls: 'bg-brand-50 border-brand-200 text-brand-900' },
  dictionary: { label: 'From the dictionary', cls: 'bg-white border-slate-200 text-slate-900' },
  guess: { label: 'Guessed — please check', cls: 'bg-amber-50 border-amber-300 text-amber-950' },
};

export default function Converter({ user, onToast }) {
  const [english, setEnglish] = useState('');
  const [fixes, setFixes] = useState({});          // English word → spelling chosen for this text only
  const [editing, setEditing] = useState(null);    // { key, value }
  const [version, setVersion] = useState(0);       // bump after teaching a word
  const [saving, setSaving] = useState(false);
  useEffect(() => { logEvent('converter_open'); }, []);

  const lines = useMemo(() => english.split('\n').map((line) => line.split(/\s+/).filter(Boolean).map((raw) => {
    const d = draftWord(raw);
    if (!d.key) return { raw, key: '', lisan: raw, source: 'keep' };   // numbers, Lisan text, punctuation
    if (d.key === 'the') return null;
    return fixes[d.key] ? { raw, ...d, lisan: fixes[d.key], source: 'learned' } : { raw, ...d };
  }).filter(Boolean)), [english, fixes, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const result = lines.map((ws) => ws.map((w) => w.lisan).join(' ')).join('\n');
  const guesses = new Set(lines.flat().filter((w) => w.source === 'guess').map((w) => w.key)).size;

  const copy = async () => {
    logEvent('converter_copy', { from: english.slice(0, 300), to: result.slice(0, 300) });
    try { await navigator.clipboard.writeText(result); onToast('Copied — paste it into your paper'); }
    catch { window.prompt('Copy this:', result); }
  };
  const save = async (forEveryone) => {
    const value = editing.value.trim();
    if (!value) return;
    setFixes((f) => ({ ...f, [editing.key]: value }));
    if (forEveryone) {
      setSaving(true);
      const cloud = await teachWord(user, editing.key, value);
      setSaving(false);
      setVersion((v) => v + 1);
      onToast(cloud ? `“${editing.key}” saved for every teacher — shukran!` : `“${editing.key}” saved on this device`);
    }
    setEditing(null);
  };

  return (
    <main className="max-w-3xl mx-auto px-4 pt-5 pb-28">
      <h1 className="text-2xl font-extrabold text-slate-900">English → LSD converter</h1>
      <p className="text-slate-600 mt-1 mb-4">Type in English letters. The Lisan script appears below. Tap any word that is spelled wrong to fix it — the fix is saved for every teacher, so the app keeps getting better.</p>

      <label className="block text-sm font-bold text-slate-500 mb-1" htmlFor="conv-en">1. Type in English letters</label>
      <textarea id="conv-en" value={english} onChange={(e) => setEnglish(e.target.value)} rows={3} dir="ltr" autoFocus
        placeholder="e.g. Murtaza bhai ghana hushyaar che"
        className="w-full rounded-2xl border-2 border-slate-200 focus:border-brand-500 focus:outline-none p-3 text-lg bg-white" />

      <div className="flex items-center justify-between mt-4 mb-1">
        <span className="text-sm font-bold text-slate-500">2. Check the words — tap one to fix it</span>
        {guesses > 0 && <span className="text-xs font-bold text-amber-700">{guesses} guessed word{guesses === 1 ? '' : 's'}</span>}
      </div>
      <div className="min-h-[5rem] rounded-2xl border-2 border-dashed border-slate-200 bg-white p-3 space-y-2" dir="rtl">
        {!english.trim() && <p className="text-slate-400 text-center py-3" dir="ltr">The words appear here.</p>}
        {lines.map((ws, i) => (
          <div key={i} className="flex flex-wrap gap-2">
            {ws.map((w, j) => w.source === 'keep'
              ? <span key={j} className="font-arabic text-2xl px-1">{w.lisan}</span>
              : (
                <button key={j} type="button" onClick={() => setEditing({ key: w.key, raw: w.raw, value: w.lisan })} title={SOURCE[w.source].label}
                  className={`rounded-xl border px-2.5 pt-1 pb-0.5 text-center ${SOURCE[w.source].cls}`}>
                  <span className="block font-arabic text-2xl leading-tight">{w.lisan}</span>
                  <span className="block text-[11px] text-slate-500" dir="ltr">{w.raw}</span>
                </button>
              ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 mt-1.5" dir="ltr">
        {Object.entries(SOURCE).map(([k, s]) => <span key={k} className="inline-flex items-center gap-1"><span className={`w-3 h-3 rounded border ${s.cls}`} />{s.label}</span>)}
      </div>

      <label className="block text-sm font-bold text-slate-500 mt-4 mb-1">3. Copy it into your paper</label>
      <div className="relative">
        <textarea readOnly value={result} rows={Math.max(2, lines.length)} dir="rtl" className="w-full rounded-2xl border-2 border-slate-200 p-3 pe-3 font-arabic text-2xl bg-slate-50" />
      </div>
      <button type="button" onClick={copy} disabled={!result.trim()} className="mt-2 w-full sm:w-auto bg-brand-700 disabled:opacity-40 text-white font-bold px-6 py-3 rounded-2xl inline-flex items-center justify-center gap-2"><Icon name="Copy" size={18} />Copy Lisan text</button>
      <p className="text-sm text-slate-500 mt-4">Tip: inside a paper you don’t need this page — just type in English in any Lisan box and each word turns into Lisan when you press space.</p>

      {editing && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setEditing(null)}>
          <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl p-4 anim-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-slate-900">Fix the spelling of “{editing.raw}”</div>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close" className="w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center"><Icon name="X" size={18} /></button>
            </div>
            <input autoFocus value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} dir="rtl" aria-label="Correct Lisan spelling" placeholder="Type with your Arabic keyboard"
              className="w-full rounded-2xl border-2 border-brand-300 focus:border-brand-600 focus:outline-none p-3 font-arabic text-3xl text-center mb-1" />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button type="button" onClick={() => save(false)} className="py-3 rounded-2xl border border-slate-300 font-bold text-slate-700 text-sm">Use here only</button>
              <button type="button" disabled={saving} onClick={() => save(true)} className="py-3 rounded-2xl bg-brand-700 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5">{saving ? <Icon name="Loader2" size={16} /> : <Icon name="Check" size={16} />}Save for everyone</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
