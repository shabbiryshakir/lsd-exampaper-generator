import { createElement, Fragment } from 'react'
import { parseRich, splitToken, tokenWords, wordText, ruleClass, quranReady, tokenTitle, ayahNumber } from '../lib/quran'

// One ayah token drawn as Quran text. Words the token hides become blank lines on the paper
// (`reveal` shows them filled in, for the answer key). `onWord` + `marked` make the words tappable
// (used by the ayah picker to choose which words to hide).
export function QuranRun({ token, reveal = false, onWord, marked }) {
  if (!quranReady()) return <span className="q-pending" dir="ltr">﴾ Quran {token.s}:{token.from}{token.to > token.from ? `–${token.to}` : ''} …﴿</span>;
  const words = tokenWords(token);
  if (!words) return <span className="q-missing" dir="ltr">{`{{q ${token.s}:${token.from}}}`} — ayah not found</span>;
  const blanks = marked || token.blanks;
  const nodes = [];
  words.forEach(({ a, i, w, last }) => {
    const pieces = w.map((p, k) => (p.r.length ? <span key={k} className={ruleClass(p.r) ? `tj ${ruleClass(p.r)}` : undefined}>{p.t}</span> : p.t));
    const hidden = blanks.has(i);
    let node;
    if (onWord) {
      node = <span key={`w${a}-${i}`} role="button" tabIndex={0} onClick={() => onWord(i)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onWord(i); } }} className={`q-pick ${hidden ? 'q-pick-on' : ''}`}>{pieces}</span>;
    } else if (hidden) {
      node = <span key={`w${a}-${i}`} className={reveal ? 'q-blank q-revealed' : 'q-blank'}>{pieces}</span>;
    } else {
      node = <span key={`w${a}-${i}`} className="q-w">{pieces}</span>;
    }
    nodes.push(node, ' ');
    if (last && token.numbers) nodes.push(<span key={`n${a}`} className="q-end">{`۝${ayahNumber(a)}`}</span>, ' ');
  });
  return <span className="quran" dir="rtl" lang="ar" title={tokenTitle(token)}>{nodes}</span>;
}

// Turns a teacher's text into something drawable: plain text stays as it is, {{q …}} tokens become
// Quran text. `plainClass` styles only the plain pieces (headings are underlined, the Quran text is not).
export function rich(text, { reveal = false, plainClass } = {}) {
  if (typeof text !== 'string') return text;
  const wrap = (t, k) => (plainClass ? createElement('span', { key: k, className: plainClass }, t) : t);
  if (!text.includes('{{q')) return plainClass && text ? wrap(text, 0) : text;
  const parts = parseRich(text);
  if (!parts.some(p => p.token)) return plainClass && text ? wrap(text, 0) : text;
  return parts.map((p, i) => (p.token
    ? createElement(QuranRun, { key: i, token: p.token, reveal })
    : createElement(Fragment, { key: i }, wrap(p.text, i))));
}

export { wordText };

// Like rich(), but a text holding a multi-ayah passage comes back as a list of pieces (one per ayah, and the
// words around them), so each can sit on its own and flow across pages. Other texts come back as one piece.
export function richPieces(text, { reveal = false } = {}) {
  if (typeof text !== 'string' || !text.includes('{{q')) return [rich(text, { reveal })];
  const parts = parseRich(text);
  if (!parts.some(p => p.token && p.token.to > p.token.from)) return [rich(text, { reveal })];
  const out = [];
  parts.forEach((p, i) => {
    if (p.token) splitToken(p.token).forEach((t, j) => out.push(createElement(QuranRun, { key: `${i}-${j}`, token: t, reveal })));
    else if (p.text.trim()) out.push(p.text.trim());
  });
  return out;
}
