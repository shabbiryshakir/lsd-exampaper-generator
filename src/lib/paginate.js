import { questionMarks, resolveBlanks, wordBankFor, wordCount } from './paperModel';

// Height estimates (px at the A4 preview scale). The engine packs "atoms" greedily
// onto pages; atoms flagged keepNext are never separated from the atom after them.
export const PAGE_CAPACITY = 900;       // usable content height of a continuation page
export const FIRST_PAGE_CAPACITY = 960; // first page has no running header
const TEXT_W = 620;                     // usable text width in px
const textLines = (text, perLine = 50) => (text && text.trim() ? Math.ceil(text.length / perLine) : 0);

const ayatLineHeight = (blank, ayat) => {
  const toks = resolveBlanks(blank);
  const w = toks.reduce((t, k) => t + (k.kind === 'word' ? k.text.length * 11 + 14 : k.size * 92 + 14), 0) + (ayat && blank.ayah ? 40 : 0);
  const lines = Math.max(1, Math.ceil(w / TEXT_W));
  return lines * (ayat ? 56 : 46) + 10;
};

export const coverHeightFor = (subjectCount) => 330 + 40 * (subjectCount + 2);

export const generatePages = (subjects, { coverHeight = 0 } = {}) => {
  const atoms = [];
  subjects.forEach((sub) => {
    atoms.push({ type: 'subjectHeader', sub, h: 55, keepNext: true });
    (sub.questions || []).forEach((q, qIndex) => {
      const parts = q.parts || [];
      const labelled = parts.length > 1;
      atoms.push({ type: 'questionHeader', q, qIndex, h: 30 + textLines(q.text) * 36, keepNext: parts.length > 0 });
      parts.forEach((p, pIndex) => {
        const ctx = { q, qIndex, p, pIndex, labelled };
        const showHead = labelled || (p.type === 'subjective' && p.text && p.text.trim()) || (p.type !== 'subjective' && p.text && p.text.trim());
        if (p.type === 'subjective') {
          const lines = parseInt(p.lines) || 0;
          if (showHead) atoms.push({ type: 'partHeader', ...ctx, h: 22 + Math.max(1, textLines(p.text)) * 36, keepNext: lines > 0 });
          for (let i = 0; i < lines; i++) atoms.push({ type: 'line', ...ctx, h: 35 });
        } else if (p.type === 'fillBlanks') {
          const bank = p.showWordBank ? wordBankFor(p) : [];
          const next = (p.blanks || []).length > 0;
          if (showHead) atoms.push({ type: 'partHeader', ...ctx, h: 22 + Math.max(1, textLines(p.text)) * 36, keepNext: bank.length > 0 || next });
          if (bank.length) atoms.push({ type: 'wordBank', ...ctx, h: 36 + Math.ceil(bank.reduce((t, w) => t + w.length * 11 + 40, 0) / TEXT_W) * 38, keepNext: next });
          (p.blanks || []).forEach((b, bIndex) => atoms.push({ type: 'blankItem', ...ctx, blank: b, bIndex, h: ayatLineHeight(b, p.ayat) }));
        } else if (p.type === 'match') {
          const pairs = p.pairs || [];
          if (showHead) atoms.push({ type: 'partHeader', ...ctx, h: 22 + Math.max(1, textLines(p.text)) * 36, keepNext: pairs.length > 0 });
          pairs.forEach((pair, pairIndex) => atoms.push({ type: 'pair', ...ctx, pairIndex, h: 40 + (Math.max(wordCount(pair.right), wordCount(pair.left)) > 4 ? 28 : 0) }));
        }
      });
    });
  });

  const pages = [];
  let cur = [];
  let used = 0;
  let cap = FIRST_PAGE_CAPACITY - coverHeight;
  const flush = () => { pages.push(cur); cur = []; used = 0; cap = PAGE_CAPACITY; };

  for (let i = 0; i < atoms.length; i++) {
    // atoms that must stay together: this one plus the chain it is glued to
    let need = atoms[i].h;
    for (let j = i; atoms[j].keepNext && atoms[j + 1]; j++) need += atoms[j + 1].h;
    if (cur.length > 0 && used + need > cap) flush();
    cur.push(atoms[i]);
    used += atoms[i].h;
  }
  if (cur.length > 0 || pages.length === 0) pages.push(cur);
  return pages;
};

// Merge runs of consecutive line / pair atoms of the same part into one block for rendering.
export const groupPageItems = (items) => {
  const out = [];
  items.forEach((it) => {
    const last = out[out.length - 1];
    if (it.type === 'line' && last && last.type === 'lines' && last.p === it.p) last.count += 1;
    else if (it.type === 'line') out.push({ ...it, type: 'lines', count: 1 });
    else if (it.type === 'pair' && last && last.type === 'pairs' && last.p === it.p) last.rows.push(it.pairIndex);
    else if (it.type === 'pair') out.push({ ...it, type: 'pairs', rows: [it.pairIndex] });
    else out.push(it);
  });
  return out;
};

export { questionMarks };
