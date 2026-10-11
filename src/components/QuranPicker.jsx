import { useEffect, useMemo, useState } from 'react'
import Icon from './Icon'
import { QuranRun } from './QuranText'
import { useQuran, surahList, ayahCount, tokenWords, wordText, formatToken, searchQuran, ayahPlain, surahInfo, normalizeArabic, TAJWEED_LEGEND } from '../lib/quran'

const MAX_AYAT = 60;
const sel = 'w-full border border-slate-300 rounded-xl h-12 px-3 bg-white text-base focus:border-brand-500 focus:outline-none';

const Tab = ({ on, onClick, children }) => (
  <button type="button" onClick={onClick} className={`flex-1 px-3 py-2 rounded-lg text-sm font-bold ${on ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{children}</button>
);

// The ayah picker: choose surah and ayat (or search by words), optionally hide words for a
// fill-in-the-blanks, and get a {{q …}} token to drop into any text box.
export default function QuranPicker({ initial, quranFont = 'mushaf', onDone, onClose, onHelp }) {
  const { ready, failed, retry } = useQuran();
  const [tab, setTab] = useState('pick');
  const [s, setS] = useState(initial?.s || 1);
  const [from, setFrom] = useState(initial?.from || 1);
  const [to, setTo] = useState(initial?.to || initial?.from || 1);
  const [numbers, setNumbers] = useState(initial ? initial.numbers !== false : true);
  const [hide, setHide] = useState(!!initial?.blanks?.size);
  const [blanks, setBlanks] = useState(() => new Set(initial?.blanks || []));
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const surahs = useMemo(() => (ready ? surahList() : []), [ready]);
  const count = ready ? ayahCount(s) : 0;
  const token = { s, from, to, blanks, numbers };
  const words = ready ? tokenWords({ s, from, to }) : null;
  const total = words ? words.length : 0;
  const hiddenCount = [...blanks].filter(i => i <= total).length;
  const results = useMemo(() => (ready && tab === 'search' ? searchQuran(query) : []), [ready, tab, query]);

  const pickSurah = (n) => { setS(n); setFrom(1); setTo(1); setBlanks(new Set()); };
  const pickFrom = (a) => { setFrom(a); if (to < a || to - a >= MAX_AYAT) setTo(a); setBlanks(new Set()); };
  const pickTo = (a) => { setTo(a); setBlanks(new Set()); };
  const toggle = (i) => setBlanks(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  // Short words (و، في، من) make poor blanks, so the quick tools prefer words with three or more letters.
  const longWords = (words || []).filter(x => normalizeArabic(wordText(x.w)).length >= 3);
  const quick = {
    every2: () => setBlanks(new Set((words || []).filter(x => x.i % 2 === 0).map(x => x.i))),
    every3: () => setBlanks(new Set((words || []).filter(x => x.i % 3 === 0).map(x => x.i))),
    last3: () => setBlanks(new Set((words || []).filter(x => x.i > total - 3).map(x => x.i))),
    half: () => setBlanks(new Set((words || []).filter(x => x.i > Math.ceil(total / 2)).map(x => x.i))),
    random: () => {
      const pool = [...longWords];
      const pick = new Set();
      for (let n = 0; n < Math.min(3, pool.length); n++) pick.add(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].i);
      setBlanks(pick);
    },
    clear: () => setBlanks(new Set()),
  };

  const done = () => onDone(formatToken({ s, from, to, blanks: hide ? new Set([...blanks].filter(i => i <= total)) : new Set(), numbers }));

  const fromOptions = Array.from({ length: count }, (_, i) => i + 1);
  const toOptions = Array.from({ length: Math.min(count, from + MAX_AYAT - 1) - from + 1 }, (_, i) => from + i);
  const info = ready ? surahInfo(s) : null;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 flex items-end sm:items-center justify-center print:hidden anim-fade" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[94vh] flex flex-col anim-sheet shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add ayat from the Quran">
        <div className="flex justify-between items-center px-5 pt-4 pb-2">
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2"><Icon name="BookOpenText" className="text-brand-700" />{initial ? 'Change ayat' : 'Add ayat'}</h2>
          <div className="flex items-center gap-1">
            {onHelp && <button type="button" onClick={onHelp} className="px-3 py-2 rounded-xl text-sm font-bold text-brand-700 hover:bg-brand-50 inline-flex items-center gap-1.5"><Icon name="CircleHelp" size={16} />How it works</button>}
            <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center"><Icon name="X" /></button>
          </div>
        </div>

        {!ready ? (
          <div className="px-5 pb-8 pt-4 text-center text-slate-500">
            {failed
              ? <><p className="mb-3">The Quran could not be loaded. Check your internet connection once; after that it works offline.</p><button type="button" onClick={retry} className="font-bold text-brand-700">Try again</button></>
              : <div className="flex items-center justify-center gap-2"><Icon name="Loader2" />Loading the Quran…</div>}
          </div>
        ) : (
          <>
            <div className="px-5 pb-2">
              <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
                <Tab on={tab === 'pick'} onClick={() => setTab('pick')}>Choose surah & ayat</Tab>
                <Tab on={tab === 'search'} onClick={() => setTab('search')}>Search by words</Tab>
              </div>
            </div>

            <div className="px-5 pb-3 overflow-y-auto flex-1 min-h-0">
              {tab === 'search' ? (
                <div>
                  <input type="text" dir="rtl" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus placeholder="اكتب كلمات من الآية…" className={`${sel} text-xl mb-3`} />
                  <p className="text-xs text-slate-500 mb-3">Type two or more letters of Arabic. Vowel marks don’t matter.</p>
                  {query.trim().length >= 2 && results.length === 0 && <p className="text-slate-500 text-center py-6">No ayah found.</p>}
                  <div className="space-y-1.5">
                    {results.map(r => (
                      <button key={`${r.s}:${r.a}`} type="button" onClick={() => { setS(r.s); setFrom(r.a); setTo(r.a); setBlanks(new Set()); setTab('pick'); }} className="w-full text-start border border-slate-200 rounded-xl px-3 py-2 hover:border-brand-400 hover:bg-brand-50">
                        <span className="block text-xs font-bold text-brand-700">{surahInfo(r.s).en} · {r.s}:{r.a}</span>
                        <span className="block quran-scope qf-mushaf text-xl truncate" dir="rtl" style={{ fontFamily: 'var(--quran-font)' }}>{ayahPlain(r.s, r.a)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-6 gap-2 mb-3">
                    <label className="col-span-6 block">
                      <span className="block text-sm font-bold text-slate-600 mb-1">Surah</span>
                      <select value={s} onChange={(e) => pickSurah(+e.target.value)} className={sel}>
                        {surahs.map(x => <option key={x.n} value={x.n}>{x.n}. {x.en} — {x.ar} ({x.count})</option>)}
                      </select>
                    </label>
                    <label className="col-span-3 block">
                      <span className="block text-sm font-bold text-slate-600 mb-1">From ayah</span>
                      <select value={from} onChange={(e) => pickFrom(+e.target.value)} className={sel}>{fromOptions.map(a => <option key={a} value={a}>{a}</option>)}</select>
                    </label>
                    <label className="col-span-3 block">
                      <span className="block text-sm font-bold text-slate-600 mb-1">To ayah</span>
                      <select value={to} onChange={(e) => pickTo(+e.target.value)} className={sel}>{toOptions.map(a => <option key={a} value={a}>{a}</option>)}</select>
                    </label>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-3">
                    <div className="inline-flex bg-slate-100 rounded-xl p-1 gap-1">
                      <button type="button" onClick={() => setHide(false)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${!hide ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>Show the ayat</button>
                      <button type="button" onClick={() => setHide(true)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${hide ? 'bg-white shadow text-amber-700' : 'text-slate-500'}`}>Hide words to fill in</button>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer select-none">
                      <input type="checkbox" checked={numbers} onChange={(e) => setNumbers(e.target.checked)} className="w-5 h-5 accent-brand-600" />Ayah numbers <span className="quran-scope text-xl leading-none" style={{ fontFamily: 'var(--quran-font)' }}>۝١</span>
                    </label>
                  </div>

                  {hide && (
                    <div className="mb-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <p className="text-sm text-amber-900 mb-2"><b>Tap the words</b> you want students to fill in. They print as lines; the answer key shows them.</p>
                      <div className="flex flex-wrap gap-1.5">
                        {[['every2', 'Every 2nd word'], ['every3', 'Every 3rd word'], ['last3', 'Last 3 words'], ['half', 'Second half'], ['random', '3 random words'], ['clear', 'Clear']].map(([k, l]) => (
                          <button key={k} type="button" onClick={quick[k]} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${k === 'clear' ? 'text-red-600 border-red-200 bg-white' : 'text-amber-800 border-amber-300 bg-white hover:bg-amber-100'}`}>{l}</button>
                        ))}
                      </div>
                      <p className="text-xs text-amber-800 mt-2 font-bold">{hiddenCount === 0 ? 'No words hidden yet' : `${hiddenCount} word${hiddenCount === 1 ? '' : 's'} hidden`} · {total} words in all</p>
                    </div>
                  )}

                  <div className={`quran-scope qf-${quranFont} border-2 ${hide ? 'border-amber-300' : 'border-brand-100'} rounded-2xl bg-white px-4 py-3 text-slate-900`} style={{ fontSize: 26 }}>
                    <div className="text-center text-xs font-bold text-slate-400 mb-1" style={{ fontFamily: 'Arial, sans-serif', fontSize: 12 }}>{info?.en} · {s}:{to > from ? `${from}–${to}` : from}</div>
                    <QuranRun token={token} onWord={hide ? toggle : undefined} marked={hide ? blanks : new Set()} />
                  </div>
                  <details className="mt-3 text-sm text-slate-500">
                    <summary className="cursor-pointer font-bold">What do the colours mean?</summary>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 quran-scope">
                      {TAJWEED_LEGEND.map(l => <span key={l.cls} className="flex items-center gap-2 text-xs"><span className={`tj ${l.cls} text-xl`} style={{ fontFamily: 'var(--quran-font)' }}>●</span>{l.label}</span>)}
                    </div>
                    <p className="text-xs mt-2">Colours show on the paper too. Switch them off for black-and-white printing in <b>Page style</b>.</p>
                  </details>
                </>
              )}
            </div>

            {tab === 'pick' && (
              <div className="px-5 pt-3 border-t border-slate-100 flex gap-3" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
                <button type="button" onClick={onClose} className="px-5 py-3 rounded-2xl border border-slate-200 font-bold text-slate-700">Cancel</button>
                <button type="button" onClick={done} className="flex-1 bg-brand-700 hover:bg-brand-800 text-white font-bold rounded-2xl py-3 inline-flex items-center justify-center gap-2"><Icon name="Check" size={18} />{initial ? 'Update' : 'Add to question'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
