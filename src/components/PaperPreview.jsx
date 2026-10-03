import { useLayoutEffect, useEffect, useRef, useState, forwardRef } from 'react'
import { subjectTotal, grandTotal, subLabel, questionLabel, parseMarks, questionNumbers, langOf, optionLetter, hasAnswers } from '../lib/paper'

// Small safety margin (px) left empty at the bottom of each page.
const PAGE_SAFETY = 4;

// ---------------------------------------------------------------------------
// BLOCK BUILDING
// The paper is flattened into small "blocks" (a question heading, one answer
// line, one match row...). Each block is measured in the real font at real A4
// width, then packed into pages. Nothing is estimated.
// Logical classes (me-, ps-, border-e, text-end) keep everything correct in both
// right-to-left (LSD) and left-to-right (English) papers.
// ---------------------------------------------------------------------------
const Lines = ({ n, keyPrefix, subject, out }) => {
  for (let j = 0; j < n; j++) out.push({ key: `${keyPrefix}-l${j}`, subject, node: <div className="answer-line" /> });
};

const optionRow = (options, optionLayout) => {
  const opts = (options || []).filter(o => (o || '').trim() !== '');
  if (opts.length === 0) return null;
  return (
    <div className={`flex ${optionLayout === 'column' ? 'flex-col' : 'flex-wrap'} gap-x-8 gap-y-1 ps-[2.2em]`}>
      {opts.map((o, k) => (
        <span key={k} className="whitespace-nowrap"><span className="inline-block w-[0.9em] h-[0.9em] border-2 border-black rounded-full me-2 align-middle" />{o}</span>
      ))}
    </div>
  );
};

const subjectHeader = (sub, L, keyPrefix, extra = {}) => ({
  key: `${keyPrefix}s-${sub.id}`, subject: sub.title, keepWithNext: true, ...extra,
  node: (
    <div className="flex justify-between items-center bg-gray-100 px-3 py-1 mb-3 font-bold border-y-2 border-black text-[1.1em]">
      <span>{sub.title}</span>
      <span>{L.num(subjectTotal(sub))}</span>
    </div>
  ),
});

const questionHeader = (q, num, layout, L, key, subject) => {
  const hasText = (q.text || '').trim() !== '';
  const showMarks = !q.hideMarks && parseMarks(q.marks) > 0;
  if (!hasText && num === null && !showMarks) return null;
  return {
    key, subject, keepWithNext: true,
    node: (
      <div className="flex justify-between items-start gap-4 pt-2 pb-2 font-bold">
        <p className="underline underline-offset-[6px] decoration-1 leading-relaxed whitespace-pre-wrap">
          {num !== null && <span className="me-2">{questionLabel(num, layout.questionLabel, layout.language)}</span>}
          {hasText && q.text}
        </p>
        {showMarks && <span className="font-bold whitespace-nowrap underline underline-offset-[6px]">({L.num(parseMarks(q.marks))})</span>}
      </div>
    ),
  };
};

export function buildBlocks(subjects, layout) {
  const L = langOf(layout);
  const lang = layout.language;
  const out = [];
  (subjects || []).forEach((sub, sIndex) => {
    const subject = sub.title;
    out.push(subjectHeader(sub, L, '', { breakBefore: !!sub.newPage && sIndex > 0 }));

    const numbers = questionNumbers(sub.questions);
    (sub.questions || []).forEach((q, qIndex) => {
      const k = `q-${q.id}`;
      const firstBlock = out.length;
      const head = questionHeader(q, numbers[qIndex], layout, L, k, subject);
      if (head) out.push(head);

      if (q.type === 'subjective') {
        (q.subQuestions || []).forEach((sq, i) => {
          const lines = Math.max(0, parseInt(sq.lines) || 0);
          if ((sq.text || '').trim() !== '') {
            out.push({
              key: `${k}-sq${sq.id}`, subject, keepWithNext: lines > 0,
              node: (
                <div className="flex gap-2 items-start px-3 pt-1 whitespace-pre-wrap">
                  <span className="font-bold whitespace-nowrap">{subLabel(i, layout.subNumbering, lang)}</span>
                  <p>{sq.text}</p>
                </div>
              ),
            });
          }
          Lines({ n: lines, keyPrefix: `${k}-sq${sq.id}`, subject, out });
          out.push({ key: `${k}-sq${sq.id}-gap`, subject, node: <div className="h-2" /> });
        });
      }

      else if (q.type === 'fillBlanks') {
        const bank = (q.blanks || []).map(b => (b.answer || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, lang === 'en' ? 'en' : 'ar'));
        if (q.showWordBank !== false && bank.length > 0) {
          out.push({
            key: `${k}-bank`, subject, keepWithNext: true,
            node: (
              <div className="px-3 pb-2">
                <div className="border-2 border-black px-3 py-1 flex flex-wrap gap-x-6 justify-center bg-gray-50">
                  {bank.map((w, i) => <span key={i}>{w}</span>)}
                </div>
              </div>
            ),
          });
        }
        (q.blanks || []).forEach((b, i) => {
          out.push({
            key: `${k}-b${b.id}`, subject,
            node: (
              <p className="px-3 py-1 leading-[2.4em] whitespace-pre-wrap">
                <span className="font-bold me-2">{subLabel(i, 'numeric', lang)}</span>
                {(b.text || '').split('*').map((part, j, arr) => (
                  <span key={j}>{part}{j !== arr.length - 1 && <span className="blank-gap" />}</span>
                ))}
              </p>
            ),
          });
        });
      }

      else if (q.type === 'match') {
        const pairs = q.pairs || [];
        const n = pairs.length;
        pairs.forEach((pair, i) => {
          const jumbled = n > 1 ? pairs[(i + 1) % n] : pair;
          out.push({
            key: `${k}-p${i}`, subject, keepWithNext: i === 0 && n > 1,
            node: (
              <div className="px-2">
                <div className={`grid grid-cols-[5fr_2fr_5fr] border-x border-b border-black ${i === 0 ? 'border-t' : ''}`}>
                  <div className="px-3 py-1 border-e border-black"><span className="font-bold me-2">{L.num(i + 1)}.</span>{pair.right}</div>
                  <div className="py-1 border-e border-black text-center text-gray-400 font-sans">[&nbsp;&nbsp;&nbsp;&nbsp;]</div>
                  <div className="px-3 py-1">{jumbled?.left}</div>
                </div>
                {i === n - 1 && <div className="h-3" />}
              </div>
            ),
          });
        });
      }

      else if (q.type === 'mcq') {
        (q.items || []).forEach((it, i) => {
          out.push({
            key: `${k}-i${it.id}`, subject,
            node: (
              <div className="px-3 py-1">
                <p className="whitespace-pre-wrap"><span className="font-bold me-2">{subLabel(i, layout.subNumbering, lang)}</span>{it.text}</p>
                {optionRow(it.options, q.optionLayout)}
              </div>
            ),
          });
        });
      }

      else if (q.type === 'trueFalse') {
        (q.items || []).forEach((it, i) => {
          out.push({
            key: `${k}-i${it.id}`, subject,
            node: (
              <div className="flex justify-between items-start gap-4 px-3 py-1">
                <p className="whitespace-pre-wrap"><span className="font-bold me-2">{subLabel(i, 'numeric', lang)}</span>{it.text}</p>
                {q.tfStyle === 'words'
                  ? <span className="whitespace-nowrap">( {L.t.true} / {L.t.false} )</span>
                  : <span className="inline-block w-[2.2em] h-[1.4em] border-2 border-black shrink-0 mt-1" />}
              </div>
            ),
          });
        });
      }

      else if (q.type === 'whoSaid') {
        const labels = q.saidLabels || {};
        (q.items || []).forEach((it, i) => {
          const opts = optionRow(it.options, 'row');
          out.push({
            key: `${k}-i${it.id}`, subject,
            node: (
              <div className="px-3 py-1">
                <p className="whitespace-pre-wrap"><span className="font-bold me-2">{subLabel(i, 'numeric', lang)}</span>{lang === 'en' ? `“${it.text}”` : `« ${it.text} »`}</p>
                {opts || (
                  <div className="flex gap-8 ps-[2.2em] mt-1">
                    <span className="flex-1 flex items-end">{labels.speaker || L.t.speaker} :<span className="flex-1 border-b-2 border-dotted border-gray-600 ms-2" /></span>
                    <span className="flex-1 flex items-end">{labels.listener || L.t.listener} :<span className="flex-1 border-b-2 border-dotted border-gray-600 ms-2" /></span>
                  </div>
                )}
              </div>
            ),
          });
        });
      }

      else if (q.type === 'wordList') {
        const cols = Math.min(4, Math.max(1, parseInt(q.columns) || 2));
        const items = q.items || [];
        for (let r = 0; r < items.length; r += cols) {
          const row = items.slice(r, r + cols);
          out.push({
            key: `${k}-r${r}`, subject,
            node: (
              <div className="grid gap-x-8 px-3 py-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {row.map((it, c) => (
                  <div key={it.id} className="flex items-end">
                    <span className="whitespace-nowrap"><span className="font-bold me-1">{subLabel(r + c, 'numeric', lang)}</span> {it.text} -</span>
                    <span className="flex-1 border-b-2 border-black ms-2 mb-[0.3em] min-w-[2em]" />
                  </div>
                ))}
              </div>
            ),
          });
        }
        out.push({ key: `${k}-gap`, subject, node: <div className="h-2" /> });
      }

      else if (q.type === 'textBlock') {
        (q.content || '').split('\n').forEach((para, i) => {
          out.push({ key: `${k}-t${i}`, subject, node: <p className="px-3 whitespace-pre-wrap min-h-[1.6em]">{para}</p> });
        });
        Lines({ n: Math.max(0, parseInt(q.lines) || 0), keyPrefix: k, subject, out });
        out.push({ key: `${k}-gap`, subject, node: <div className="h-2" /> });
      }

      else if (q.type === 'table') {
        const rows = q.rows || [];
        const cols = Math.max(1, ...rows.map(r => r.length));
        rows.forEach((row, r) => {
          const head = q.headerRow && r === 0;
          out.push({
            key: `${k}-r${r}`, subject, keepWithNext: head && rows.length > 1,
            node: (
              <div className="px-2">
                <div className={`grid border-x border-b border-black ${r === 0 ? 'border-t' : ''} ${head ? 'bg-gray-100 font-bold' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {Array.from({ length: cols }, (_, c) => (
                    <div key={c} className={`px-2 py-1 min-h-[2.2em] whitespace-pre-wrap text-center ${c < cols - 1 ? 'border-e border-black' : ''}`}>{row[c] || ''}</div>
                  ))}
                </div>
                {r === rows.length - 1 && <div className="h-3" />}
              </div>
            ),
          });
        });
      }

      else if (q.type === 'image') {
        if (q.src) {
          out.push({
            key: `${k}-img`, subject,
            node: (
              <figure className="px-3 py-2 flex flex-col items-center">
                <img src={q.src} alt="" style={{ width: `${Math.min(100, Math.max(15, parseInt(q.width) || 60))}%` }} className="object-contain max-h-[200mm]" />
                {(q.caption || '').trim() && <figcaption className="text-[0.85em] mt-1">{q.caption}</figcaption>}
              </figure>
            ),
          });
        }
        Lines({ n: Math.max(0, parseInt(q.lines) || 0), keyPrefix: k, subject, out });
        out.push({ key: `${k}-gap`, subject, node: <div className="h-2" /> });
      }

      for (let i = firstBlock; i < out.length; i++) out[i].qid = q.id;
      if (out[firstBlock]) out[firstBlock].breakBefore = out[firstBlock].breakBefore || !!q.newPage;
    });
  });
  return out;
}

// Answer key: one compact line per answer, only for questions that have answers.
export function buildKeyBlocks(subjects, layout) {
  const L = langOf(layout);
  const lang = layout.language;
  const out = [];
  const line = (key, subject, label, content) => out.push({
    key, subject,
    node: <div className="flex gap-2 px-3 py-0.5 whitespace-pre-wrap"><span className="font-bold whitespace-nowrap">{label}</span><span>{content}</span></div>,
  });
  (subjects || []).forEach((sub) => {
    const questions = sub.questions || [];
    if (!questions.some(hasAnswers)) return;
    out.push(subjectHeader(sub, L, 'k'));
    const numbers = questionNumbers(questions);
    questions.forEach((q, qIndex) => {
      if (!hasAnswers(q)) return;
      const k = `k-${q.id}`;
      const firstBlock = out.length;
      const head = questionHeader({ ...q, text: '' }, numbers[qIndex] ?? 0, layout, L, k, sub.title);
      if (head) out.push(head);
      if (q.type === 'subjective') (q.subQuestions || []).forEach((sq, i) => (sq.answer || '').trim() && line(`${k}-${sq.id}`, sub.title, subLabel(i, layout.subNumbering, lang), sq.answer));
      if (q.type === 'fillBlanks') (q.blanks || []).forEach((b, i) => (b.answer || '').trim() && line(`${k}-${b.id}`, sub.title, subLabel(i, 'numeric', lang), b.answer));
      if (q.type === 'match') (q.pairs || []).forEach((p, i) => line(`${k}-${i}`, sub.title, `${L.num(i + 1)}.`, `${p.right}  ←→  ${p.left}`));
      if (q.type === 'mcq') (q.items || []).forEach((it, i) => it.answer != null && line(`${k}-${it.id}`, sub.title, subLabel(i, layout.subNumbering, lang), `${optionLetter(it.answer, lang)} ${(it.options || [])[it.answer] || ''}`));
      if (q.type === 'trueFalse') (q.items || []).forEach((it, i) => it.answer != null && line(`${k}-${it.id}`, sub.title, subLabel(i, 'numeric', lang), it.answer ? `✓ ${L.t.true}` : `✗ ${L.t.false}`));
      if (q.type === 'whoSaid' || q.type === 'wordList') (q.items || []).forEach((it, i) => String(it.answer || '').trim() && line(`${k}-${it.id}`, sub.title, subLabel(i, 'numeric', lang), q.type === 'wordList' ? `${it.text} — ${it.answer}` : it.answer));
      out.push({ key: `${k}-gap`, subject: sub.title, node: <div className="h-2" /> });
      for (let i = firstBlock; i < out.length; i++) out[i].qid = q.id;
    });
  });
  return out;
}

// Greedy packing with "keep with next" chains so a heading is never left alone at the bottom of a page.
export function paginate(blocks, heights, capFirst, capRest) {
  const pages = [[]];
  let used = 0;
  const cap = () => (pages.length === 1 ? capFirst : capRest) - PAGE_SAFETY;
  const newPage = () => { pages.push([]); used = 0; };

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const h = heights[b.key] || 0;
    const current = pages[pages.length - 1];
    if (b.breakBefore && current.length > 0) newPage();

    let need = h;
    for (let j = i; blocks[j]?.keepWithNext && j + 1 < blocks.length; j++) need += heights[blocks[j + 1].key] || 0;
    if (need > cap()) need = h; // chain can never fit on one page: only require this block itself

    if (used + need > cap() && pages[pages.length - 1].length > 0) newPage();
    pages[pages.length - 1].push(b);
    used += h;
  }
  if (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();
  return pages;
}

// ---------------------------------------------------------------------------
// PAGE CHROME
// ---------------------------------------------------------------------------
const yearText = (header, L) => `${L.num(header?.hijriYear || '')}${L.yearSuffix}`;

const RunningHeader = ({ header, L, title }) => (
  <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-3 text-[0.85em] font-bold">
    <span>{header.className}</span>
    <span>{title || `${header.examName} ${yearText(header, L)}`}</span>
    <span className="font-sans text-[0.7em]" dir="ltr">{header.paperNumber}</span>
  </div>
);

const Footer = ({ header, subjects, pageNo, pageCount }) => (
  <div className="flex justify-between items-center border-t-2 border-black pt-1 mt-2 text-[0.75em] font-bold shrink-0">
    <span className="w-1/3">{header.className}</span>
    <span className="w-1/3 text-center">{subjects.join(' / ')}</span>
    <span className="w-1/3 text-end font-sans text-[0.9em]" dir="ltr">{pageNo} / {pageCount}</span>
  </div>
);

const PageNumberOnly = ({ pageNo, L }) => (
  <div className="text-center text-gray-500 font-bold text-[0.85em] pt-1 shrink-0">{L.num(pageNo)}</div>
);

const isLatin = (t) => /[A-Za-z]/.test(t);

// Student details boxes, two per row; an odd last field spans the full row.
const StudentRow = ({ cell, fields, L }) => {
  const list = (fields || []).filter(f => (f || '').trim() !== '');
  if (list.length === 0) return null;
  const rows = [];
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
  const smallLatin = L.dir === 'rtl';
  const label = (f) => (
    <td className={`border border-black ${cell} font-bold whitespace-nowrap w-[1%] ${smallLatin && isLatin(f) ? 'font-sans text-[0.65em]' : ''}`} dir={isLatin(f) ? 'ltr' : 'rtl'}>{f}{isLatin(f) ? ':' : ' :'}</td>
  );
  return (
    <table className="w-full border-collapse border border-black">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {label(r[0])}
            <td className={`border border-black ${cell}`} colSpan={r.length === 1 ? 3 : 1} style={{ width: r.length === 1 ? 'auto' : '50%' }}></td>
            {r[1] && <>{label(r[1])}<td className={`border border-black ${cell}`} style={{ width: '50%' }}></td></>}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const MarksTable = ({ subjects, cell, L }) => (
  <table className="w-full border-collapse border border-black text-center font-bold">
    <thead><tr className="bg-gray-100"><th className={`border border-black ${cell} w-16`}>{L.t.no}</th><th className={`border border-black ${cell}`}>{L.t.subjects}</th><th className={`border border-black ${cell} w-24`}>{L.t.marks}</th><th className={`border border-black ${cell} w-32`}>{L.t.obtained}</th></tr></thead>
    <tbody>
      {subjects.map((sub, i) => (
        <tr key={sub.id}><td className={`border border-black ${cell}`}>{L.num(i + 1)}</td><td className={`border border-black ${cell} text-start ps-4`}>{sub.title}</td><td className={`border border-black ${cell}`}>{L.num(subjectTotal(sub))}</td><td className={`border border-black ${cell}`}></td></tr>
      ))}
      <tr className="bg-gray-50"><td className={`border border-black ${cell}`} colSpan="2">{L.t.total}</td><td className={`border border-black ${cell}`}>{L.num(grandTotal(subjects))}</td><td className={`border border-black ${cell}`}></td></tr>
    </tbody>
  </table>
);

const CoverPage = ({ header, school, subjects, fields, L }) => {
  const dense = subjects.length > 5;
  const cell = dense ? 'p-1' : 'p-2.5';
  return (
    <div className="flex-1 flex flex-col">
      <div className={`text-center flex flex-col items-center pt-6 ${dense ? 'mb-4' : 'mb-10'}`}>
        {school?.logo && <img src={school.logo} alt="" className={`${dense ? 'h-20' : 'h-28'} object-contain mb-3`} />}
        <h2 className="text-[1.9em] font-bold mb-3 font-arabic" dir="rtl">{school?.nameAr}</h2>
        <h3 className="text-[1.5em] font-bold mb-3">{header.examName} {yearText(header, L)}</h3>
        <h3 className="text-[1.25em] font-bold">{header.className}</h3>
      </div>
      <div className="flex justify-between items-end mb-4 font-bold border-b-2 border-black pb-2">
        <span>{header.className}</span>
        <span className="font-sans text-[0.75em]">{header.paperNumber}</span>
        <span className="font-sans text-[0.75em] font-medium" dir="ltr">{L.t.time}: {header.time}</span>
      </div>
      <div className={dense ? 'mb-4' : 'mb-10'}><StudentRow cell={cell} fields={fields} L={L} /></div>
      <MarksTable subjects={subjects} cell={cell} L={L} />
    </div>
  );
};

// Compact info strip used instead of a full cover page.
const CompactHeader = ({ header, school, subjects, fields, L }) => (
  <div className="mb-3">
    <div className="flex items-center gap-3 border-b-2 border-black pb-1 mb-2">
      {school?.logo && <img src={school.logo} alt="" className="h-12 object-contain" />}
      <div className="flex-1 text-center">
        <div className="text-[1.15em] font-bold leading-snug font-arabic" dir="rtl">{school?.nameAr}</div>
        <div className="font-bold leading-snug">{header.examName} {yearText(header, L)} — {header.className}</div>
      </div>
    </div>
    <div className="flex justify-between font-bold text-[0.8em] mb-2">
      <span>{subjects.map(s => s.title).join(L.dir === 'rtl' ? ' ، ' : ', ')}</span>
      <span className="font-sans whitespace-nowrap" dir="ltr">{header.paperNumber} · {L.t.time}: {header.time} · {L.dir === 'rtl' ? 'Marks' : L.t.marks}: {grandTotal(subjects)}</span>
    </div>
    <StudentRow cell="p-1.5" fields={fields} L={L} />
  </div>
);

const Sheet = forwardRef(({ layout, className = '', children }, ref) => {
  const L = langOf(layout);
  return (
    <div ref={ref} className={`a4-sheet size-${layout.textSize || 'normal'} lang-${layout.language || 'lsd'} ${className}`} dir={L.dir}>
      {layout.pageBorder && <div className="sheet-border" />}
      {children}
    </div>
  );
});

// ---------------------------------------------------------------------------
// PREVIEW  (mode: 'paper' | 'key')
// ---------------------------------------------------------------------------
export default function PaperPreview({ header, subjects, school, layout, pagesRef, focusQuestionId, onEditQuestion, onPageCount, mode = 'paper' }) {
  const L = langOf(layout);
  const isKey = mode === 'key';
  const blocks = isKey ? buildKeyBlocks(subjects, layout) : buildBlocks(subjects, layout);
  const measureRef = useRef(null);
  const firstTplRef = useRef(null);
  const restTplRef = useRef(null);
  const [measure, setMeasure] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const fitZoom = () => Math.min(1, (window.innerWidth - 16) / (210 * 96 / 25.4));
  const [zoom, setZoom] = useState(fitZoom);
  const [imgTick, setImgTick] = useState(0); // re-measure once pictures finish loading
  const scrolledFor = useRef(null);

  useEffect(() => {
    let alive = true;
    if (!document.fonts) { setFontsReady(true); return; }
    Promise.all([document.fonts.load('20px "KanzAlMarjaan"'), document.fonts.load('20px "Noto Serif"'), document.fonts.load('bold 20px "Noto Serif"')])
      .catch(() => {}).finally(() => document.fonts.ready.then(() => alive && setFontsReady(true)));
    return () => { alive = false; };
  }, []);

  // Fit the A4 pages to narrow phone screens (print always resets zoom to 1).
  useEffect(() => {
    const onResize = () => setZoom(fitZoom());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const signature = JSON.stringify([mode, subjects, layout, header, !!school?.logo, school?.nameAr, fontsReady, imgTick]);
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const heights = {};
    measureRef.current.querySelectorAll('[data-block]').forEach(el => { heights[el.dataset.block] = el.getBoundingClientRect().height; });
    const capFirst = firstTplRef.current.querySelector('.sheet-content').getBoundingClientRect().height;
    const capRest = restTplRef.current.querySelector('.sheet-content').getBoundingClientRect().height;
    setMeasure({ signature, heights, capFirst, capRest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const cover = !isKey && layout.coverStyle === 'full';
  const compact = !isKey && layout.coverStyle === 'compact';
  // While a re-measure is pending, keep showing the last layout (it is replaced before the browser paints),
  // so the page never flashes empty and the scroll position is kept.
  const pages = measure ? paginate(blocks, measure.heights, measure.capFirst, measure.capRest) : null;
  const settled = !!measure && measure.signature === signature && fontsReady;
  const pageCount = (pages?.length || 0) + (cover ? 1 : 0);

  useEffect(() => { if (pages) onPageCount?.(pageCount); }, [pageCount, !!pages]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open the preview at the question the teacher was just editing.
  useEffect(() => {
    if (!settled || !focusQuestionId || scrolledFor.current === focusQuestionId) return;
    scrolledFor.current = focusQuestionId;
    const el = pagesRef?.current?.querySelector(`[data-qid="${focusQuestionId}"]`);
    // Manual scroll: scrollIntoView mis-computes positions inside CSS-zoomed pages on some browsers.
    if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 120) });
  }, [settled, focusQuestionId, pagesRef]); // eslint-disable-line react-hooks/exhaustive-deps

  const keyTitle = isKey ? `${L.t.answerKey} — ${header.examName} ${yearText(header, L)}` : null;
  const chrome = (isFirst) => compact && isFirst
    ? <CompactHeader header={header} school={school} subjects={subjects} fields={layout.studentFields} L={L} />
    : <RunningHeader header={header} L={L} title={keyTitle} />;
  const footer = (pageNo, pageBlocks) => layout.showFooter
    ? <Footer header={header} subjects={[...new Set(pageBlocks.map(b => b.subject).filter(Boolean))]} pageNo={pageNo} pageCount={pageCount} />
    : <PageNumberOnly pageNo={pageNo} L={L} />;
  const footerSample = layout.showFooter ? <Footer header={header} subjects={subjects.map(s => s.title)} pageNo={1} pageCount={1} /> : <PageNumberOnly pageNo={1} L={L} />;

  return (
    <>
      {/* Hidden measuring pass: same sheet, same width, same fonts. */}
      <div ref={measureRef} className="paper-measure" aria-hidden="true" onLoadCapture={() => setImgTick(t => t + 1)}>
        <Sheet layout={layout} ref={firstTplRef} className="template">{chrome(true)}<div className="sheet-content" />{footerSample}</Sheet>
        <Sheet layout={layout} ref={restTplRef} className="template">{chrome(false)}<div className="sheet-content" />{footerSample}</Sheet>
        <Sheet layout={layout}>
          {blocks.map(b => <div key={b.key} data-block={b.key} className="paper-block">{b.node}</div>)}
        </Sheet>
      </div>

      <div className="paper-zoom" style={{ zoom }}>
        <div className="paper-pages" ref={pagesRef}>
          {!pages ? (
            <div className="p-10 text-gray-500 font-sans">Laying out pages…</div>
          ) : isKey && blocks.length === 0 ? (
            <div className="max-w-md mx-4 p-6 bg-white rounded-2xl text-center text-gray-600 font-sans">No answers yet. In the editor, fill in the green <b>Answer</b> boxes (or tap the correct option) and the answer key appears here.</div>
          ) : (
            <>
              {cover && (
                <Sheet layout={layout}>
                  <CoverPage header={header} school={school} subjects={subjects} fields={layout.studentFields} L={L} />
                  {layout.showFooter ? <Footer header={header} subjects={[]} pageNo={1} pageCount={pageCount} /> : <PageNumberOnly pageNo={1} L={L} />}
                </Sheet>
              )}
              {pages.map((pageBlocks, i) => (
                <Sheet key={i} layout={layout}>
                  {chrome(i === 0)}
                  <div className="sheet-content">
                    {pageBlocks.map(b => (
                      <div key={b.key} className={`paper-block ${b.qid ? 'cursor-pointer hover:bg-yellow-50' : ''}`} data-qid={b.qid} onClick={b.qid && onEditQuestion ? () => onEditQuestion(b.qid) : undefined}>{b.node}</div>
                    ))}
                  </div>
                  {footer(i + 1 + (cover ? 1 : 0), pageBlocks)}
                </Sheet>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
