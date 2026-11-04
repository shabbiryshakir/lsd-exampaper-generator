// The Quran inside the paper maker: offline text with tajweed rules, loaded once and shared.
//
// Teachers never type Quran text. They pick an ayah and the app writes a small token into any
// text box, for example   {{q 2:255}}   {{q 112:1-4 n=0}}   {{q 2:282 b=3,7-9}}
//   2:255     surah 2, ayah 255          112:1-4   ayat 1 to 4
//   b=3,7-9   hide words 3, 7, 8 and 9 (a fill-in-the-blanks inside the ayah)
//   n=0       don't print the ayah-number ornament
// The token is replaced by the real, correctly written text (in the Quran font) wherever the paper
// is drawn, so a heading, a table cell, an option or a blank can all hold an ayah.
import { useEffect, useState } from 'react'

const BASE = import.meta.env?.BASE_URL ?? '/';

let data = null;          // { rules, surahs }
let loading = null;
let failed = false;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());

export function loadQuran() {
  if (data) return Promise.resolve(data);
  if (!loading) {
    failed = false;
    loading = fetch(`${BASE}quran/quran.json`)
      .then(r => { if (!r.ok) throw new Error(`quran.json ${r.status}`); return r.json(); })
      .then(j => { data = j; notify(); return data; })
      .catch(e => { console.error('Could not load the Quran data', e); failed = true; loading = null; notify(); throw e; });
  }
  return loading;
}

// Re-renders the component when the Quran data finishes loading. Pass `wanted=false` to skip loading.
export function useQuran(wanted = true) {
  const [, tick] = useState(0);
  useEffect(() => {
    const fn = () => tick(t => t + 1);
    listeners.add(fn);
    if (wanted && !data) loadQuran().catch(() => {});
    return () => { listeners.delete(fn); };
  }, [wanted]);
  return { ready: !!data, failed, retry: () => loadQuran().catch(() => {}) };
}

export const quranReady = () => !!data;
export const surahList = () => (data ? data.surahs.map(({ n, ar, en, type, a }) => ({ n, ar, en, type, count: a.length })) : []);
export const surahInfo = (n) => { const s = data?.surahs[n - 1]; return s ? { n: s.n, ar: s.ar, en: s.en, type: s.type, count: s.a.length } : null; };

// ---------------------------------------------------------------------------
// Words and tajweed rules
// ---------------------------------------------------------------------------
const LETTER = /[ء-ؿف-يٱ-ۓ]/;
const cache = new Map();

// An ayah as a list of words; each word is a list of { t: text, r: [rule names] } pieces.
// Stop signs written on their own (ۖ ۗ ۚ) join the word before them, so "hide this word" never leaves a stray sign.
export function wordsOf(s, a) {
  const key = `${s}:${a}`;
  if (cache.has(key)) return cache.get(key);
  const raw = data?.surahs[s - 1]?.a[a - 1];
  if (raw == null) return null;
  const pieces = [];
  const re = /\u0001([A-Z]+)\u0002([^\u0003]*)\u0003|([^\u0001]+)/g;
  let m;
  while ((m = re.exec(raw))) {
    if (m[3] != null) pieces.push({ t: m[3], r: [] });
    else pieces.push({ t: m[2], r: [...m[1]].map(c => data.rules[c.charCodeAt(0) - 65]) });
  }
  // Split the pieces at spaces.
  const words = [[]];
  pieces.forEach(p => {
    p.t.split(/(\s+)/).forEach(part => {
      if (part === '') return;
      if (/^\s+$/.test(part)) { if (words[words.length - 1].length) words.push([]); return; }
      words[words.length - 1].push({ t: part, r: p.r });
    });
  });
  const out = [];
  words.filter(w => w.length).forEach(w => {
    const text = w.map(p => p.t).join('');
    if (!LETTER.test(text) && out.length) out[out.length - 1].push({ t: ' ', r: [] }, ...w);
    else out.push(w);
  });
  cache.set(key, out);
  return out;
}

export const wordText = (w) => w.map(p => p.t).join('');

// Colours follow the usual Madani-mushaf tajweed scheme; the strongest rule on a letter wins.
const PRIORITY = ['madda_necessary', 'madda_obligatory', 'madda_permissible', 'madda_normal', 'qalaqah', 'tafkhim', 'iqlab',
  'idgham_ghunnah', 'idgham_shafawi', 'idgham_wo_ghunnah', 'idgham_mutajanisayn', 'idgham_mutaqaribayn', 'ikhafa', 'ikhafa_shafawi',
  'ghunnah', 'ham_wasl', 'laam_shamsiyah', 'slnt'];
export const ruleClass = (rules) => {
  if (!rules || !rules.length) return '';
  const r = PRIORITY.find(x => rules.includes(x));
  return r ? `tj-${r}` : '';
};

// The key shown in the guide and the picker.
export const TAJWEED_LEGEND = [
  { cls: 'tj-madda_necessary', label: 'Long madd (6 counts)' },
  { cls: 'tj-madda_obligatory', label: 'Madd (4–5 counts)' },
  { cls: 'tj-madda_permissible', label: 'Madd (2, 4 or 6 counts)' },
  { cls: 'tj-madda_normal', label: 'Natural madd (2 counts)' },
  { cls: 'tj-qalaqah', label: 'Qalqalah' },
  { cls: 'tj-tafkhim', label: 'Heavy letters (tafkhim)' },
  { cls: 'tj-ghunnah', label: 'Ghunnah, ikhfa, idgham' },
  { cls: 'tj-iqlab', label: 'Iqlab' },
  { cls: 'tj-slnt', label: 'Silent letters' },
];

// ---------------------------------------------------------------------------
// Tokens:  {{q 2:255-257 b=3,7-9 n=0}}
// ---------------------------------------------------------------------------
const TOKEN = /\{\{\s*q\s+(\d{1,3}):(\d{1,3})(?:\s*-\s*(\d{1,3}))?((?:\s+[a-z]+=[\d,\-]*)*)\s*\}\}/g;

const parseSet = (v) => {
  const set = new Set();
  String(v || '').split(',').forEach(part => {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) return;
    const a = +m[1], b = m[2] ? +m[2] : a;
    for (let i = a; i <= Math.min(b, a + 400); i++) set.add(i);
  });
  return set;
};
const formatSet = (set) => {
  const nums = [...set].sort((x, y) => x - y);
  const out = [];
  for (let i = 0; i < nums.length; i++) {
    let j = i;
    while (nums[j + 1] === nums[j] + 1) j++;
    out.push(j > i ? `${nums[i]}-${nums[j]}` : `${nums[i]}`);
    i = j;
  }
  return out.join(',');
};

// Splits text into plain pieces and ayah tokens.
export function parseRich(text) {
  const str = text == null ? '' : String(text);
  const out = [];
  let last = 0;
  TOKEN.lastIndex = 0;
  let m;
  while ((m = TOKEN.exec(str))) {
    if (m.index > last) out.push({ text: str.slice(last, m.index) });
    const opts = {};
    (m[4] || '').trim().split(/\s+/).filter(Boolean).forEach(o => { const [k, v] = o.split('='); opts[k] = v; });
    const from = +m[2];
    const to = m[3] ? Math.max(from, +m[3]) : from;
    out.push({ token: { s: +m[1], from, to, blanks: parseSet(opts.b), numbers: opts.n !== '0' }, raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push({ text: str.slice(last) });
  return out;
}

export const formatToken = ({ s, from, to, blanks, numbers }) => {
  const range = to && to > from ? `${from}-${to}` : `${from}`;
  const b = blanks && blanks.size ? ` b=${formatSet(blanks)}` : '';
  return `{{q ${s}:${range}${b}${numbers === false ? ' n=0' : ''}}}`;
};

export const hasQuran = (text) => typeof text === 'string' && text.includes('{{q') && parseRich(text).some(p => p.token);
export const hasQuranBlanks = (text) => hasQuran(text) && parseRich(text).some(p => p.token && p.token.blanks.size > 0);

// Every word of a token's ayat in order: { s, a, i (1-based within the range), words }
export function tokenWords(token) {
  const out = [];
  let i = 0;
  for (let a = token.from; a <= token.to; a++) {
    const ws = wordsOf(token.s, a);
    if (!ws) return null;
    ws.forEach((w, k) => { out.push({ a, k, i: ++i, w, last: k === ws.length - 1 }); });
  }
  return out;
}

// One token per ayah, so a long passage can flow over several pages. Hidden-word numbers move with the words.
export function splitToken(t) {
  if (t.to <= t.from || !data) return [t];
  const out = [];
  let offset = 0;
  for (let a = t.from; a <= t.to; a++) {
    const ws = wordsOf(t.s, a);
    if (!ws) return [t];
    out.push({ s: t.s, from: a, to: a, numbers: t.numbers, blanks: new Set([...t.blanks].filter(i => i > offset && i <= offset + ws.length).map(i => i - offset)) });
    offset += ws.length;
  }
  return out;
}

// The words a token hides, in order (for the word bank and the answer key).
export function blankedWords(text) {
  if (!hasQuranBlanks(text)) return [];
  const words = [];
  parseRich(text).forEach(p => {
    if (!p.token || !p.token.blanks.size) return;
    (tokenWords(p.token) || []).forEach(x => { if (p.token.blanks.has(x.i)) words.push(wordText(x.w)); });
  });
  return words;
}

export const ayahCount = (s) => data?.surahs[s - 1]?.a.length || 0;
export const tokenTitle = (t) => {
  const info = surahInfo(t.s);
  const range = t.to > t.from ? `${t.from}–${t.to}` : `${t.from}`;
  return `${info ? info.en : `Surah ${t.s}`} ${t.s}:${range}`;
};
export const ayahNumber = (n) => String(n).replace(/[0-9]/g, d => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'[+d]);

// ---------------------------------------------------------------------------
// Search by Arabic words (ignores vowel marks and spelling variants)
// ---------------------------------------------------------------------------
export const normalizeArabic = (str) => String(str || '')
  .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ࣓-ࣿٓ-ٕ]/g, '')
  .replace(/[آأإٱٲٳٵ]/g, 'ا')
  .replace(/ى/g, 'ي').replace(/ی/g, 'ي').replace(/ک/g, 'ك')
  .replace(/ة/g, 'ه')
  .replace(/\s+/g, ' ').trim();

let index = null;
const plainOf = (raw) => raw.replace(/\u0001[A-Z]+\u0002/g, '').replace(/\u0003/g, '');
export const ayahPlain = (s, a) => { const raw = data?.surahs[s - 1]?.a[a - 1]; return raw == null ? '' : plainOf(raw).trim(); };

export function searchQuran(query, limit = 40) {
  const q = normalizeArabic(query);
  if (!data || q.length < 2) return [];
  if (!index) {
    index = [];
    data.surahs.forEach(s => s.a.forEach((raw, i) => index.push({ s: s.n, a: i + 1, norm: normalizeArabic(plainOf(raw)) })));
  }
  const out = [];
  for (const e of index) {
    if (e.norm.includes(q)) { out.push({ s: e.s, a: e.a }); if (out.length >= limit) break; }
  }
  return out;
}

// Short readable form of a text that holds ayah tokens, for lists and folded cards: "﴾2:255﴿".
export const describeTokens = (text) => String(text || '').replace(TOKEN, (_m, s, a, b) => `﴾${s}:${a}${b ? `-${b}` : ''}﴿`);
