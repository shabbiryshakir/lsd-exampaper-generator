import { useLayoutEffect, useEffect, useRef, useState, forwardRef } from 'react'
import { toArabicNumerals, subjectTotal, grandTotal, subLabel, questionLabel, parseMarks } from '../lib/paper'

// Small safety margin (px) left empty at the bottom of each page.
const PAGE_SAFETY = 4;

// ---------------------------------------------------------------------------
// BLOCK BUILDING
// The paper is flattened into small "blocks" (a question heading, one answer
// line, one match row...). Each block is measured in the real font at real A4
// width, then packed into pages. Nothing is estimated.
// ---------------------------------------------------------------------------
const Marks = ({ value }) => <span className="font-bold whitespace-nowrap underline underline-offset-[6px]">({toArabicNumerals(parseMarks(value))})</span>;

const Lines = ({ n, keyPrefix, subject, out }) => {
  for (let j = 0; j < n; j++) out.push({ key: `${keyPrefix}-l${j}`, subject, node: <div className="answer-line" /> });
};

const optionRow = (options, layout) => {
  const opts = (options || []).filter(o => (o || '').trim() !== '');
  if (opts.length === 0) return null;
  return (
    <div className={`flex ${layout === 'column' ? 'flex-col' : 'flex-wrap'} gap-x-8 gap-y-1 pr-[2.2em]`}>
      {opts.map((o, k) => (
        <span key={k} className="whitespace-nowrap"><span className="inline-block w-[0.9em] h-[0.9em] border-2 border-black rounded-full ml-2 align-middle" />{o}</span>
      ))}
    </div>
  );
};

export function buildBlocks(subjects, layout) {
  const out = [];
  (subjects || []).forEach((sub, sIndex) => {
    const subject = sub.title;
    out.push({
      key: `s-${sub.id}`, subject, keepWithNext: true, breakBefore: !!sub.newPage && sIndex > 0,
      node: (
        <div className="flex justify-between items-center bg-gray-100 px-3 py-1 mb-3 font-bold border-y-2 border-black text-[1.1em]">
          <span>{sub.title}</span>
          <span>{toArabicNumerals(subjectTotal(sub))}</span>
        </div>
      ),
    });

    (sub.questions || []).forEach((q, qIndex) => {
      const k = `q-${q.id}`;
      const hasText = (q.text || '').trim() !== '';
      out.push({
        key: k, subject, keepWithNext: true, breakBefore: !!q.newPage,
        node: (
          <div className="flex justify-between items-start gap-4 pt-2 pb-2 font-bold">
            <p className="underline underline-offset-[6px] decoration-1 leading-relaxed">
              <span className="ml-2">{questionLabel(qIndex, layout.questionLabel)}</span>
              {hasText && q.text}
            </p>
            <Marks value={q.marks} />
          </div>
        ),
      });

      if (q.type === 'subjective') {
        (q.subQuestions || []).forEach((sq, i) => {
          const lines = Math.max(0, parseInt(sq.lines) || 0);
          if ((sq.text || '').trim() !== '') {
            out.push({
              key: `${k}-sq${sq.id}`, subject, keepWithNext: lines > 0,
              node: (
                <div className="flex gap-2 items-start px-3 pt-1 whitespace-pre-wrap">
                  <span className="font-bold whitespace-nowrap">{subLabel(i, layout.subNumbering)}</span>
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
        const bank = (q.blanks || []).map(b => (b.answer || '').trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));
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
                <span className="font-bold ml-2">{subLabel(i, 'numeric')}</span>
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
                  <div className="px-3 py-1 border-l border-black"><span className="font-bold ml-2">{toArabicNumerals(i + 1)}.</span>{pair.right}</div>
                  <div className="py-1 border-l border-black text-center text-gray-400 font-sans">[&nbsp;&nbsp;&nbsp;&nbsp;]</div>
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
                <p className="whitespace-pre-wrap"><span className="font-bold ml-2">{subLabel(i, layout.subNumbering)}</span>{it.text}</p>
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
                <p className="whitespace-pre-wrap"><span className="font-bold ml-2">{subLabel(i, 'numeric')}</span>{it.text}</p>
                {q.tfStyle === 'words'
                  ? <span className="whitespace-nowrap">( صحيح / غلط )</span>
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
                <p className="whitespace-pre-wrap"><span className="font-bold ml-2">{subLabel(i, 'numeric')}</span>« {it.text} »</p>
                {opts || (
                  <div className="flex gap-8 pr-[2.2em] mt-1">
                    <span className="flex-1 flex items-end">{labels.speaker || 'القائل'} :<span className="flex-1 border-b-2 border-dotted border-gray-600 mr-2" /></span>
                    <span className="flex-1 flex items-end">{labels.listener || 'المقول له'} :<span className="flex-1 border-b-2 border-dotted border-gray-600 mr-2" /></span>
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
                    <span className="whitespace-nowrap"><span className="font-bold ml-1">{subLabel(r + c, 'numeric')}</span> {it.text} -</span>
                    <span className="flex-1 border-b-2 border-black mr-2 mb-[0.3em] min-w-[2em]" />
                  </div>
                ))}
              </div>
            ),
          });
        }
        out.push({ key: `${k}-gap`, subject, node: <div className="h-2" /> });
      }

      else if (q.type === 'textBlock') {
        const paragraphs = (q.content || '').split('\n');
        paragraphs.forEach((para, i) => {
          out.push({ key: `${k}-t${i}`, subject, node: <p className="px-3 whitespace-pre-wrap min-h-[1.6em]">{para}</p> });
        });
        Lines({ n: Math.max(0, parseInt(q.lines) || 0), keyPrefix: k, subject, out });
        out.push({ key: `${k}-gap`, subject, node: <div className="h-2" /> });
      }
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
const yearText = (header) => `${toArabicNumerals(header?.hijriYear || '')}هـ`;

const RunningHeader = ({ header }) => (
  <div className="flex justify-between items-center border-b-2 border-black pb-1 mb-3 text-[0.85em] font-bold">
    <span>{header.className}</span>
    <span>{header.examName} {yearText(header)}</span>
    <span className="font-sans text-[0.7em]" dir="ltr">{header.paperNumber}</span>
  </div>
);

const Footer = ({ header, subjects, pageNo, pageCount }) => (
  <div className="flex justify-between items-center border-t-2 border-black pt-1 mt-2 text-[0.75em] font-bold shrink-0">
    <span className="w-1/3">{header.className}</span>
    <span className="w-1/3 text-center">{subjects.join(' / ')}</span>
    <span className="w-1/3 text-left font-sans text-[0.9em]" dir="ltr">{pageNo} / {pageCount}</span>
  </div>
);

const PageNumberOnly = ({ pageNo }) => (
  <div className="text-center text-gray-500 font-bold text-[0.85em] pt-1 shrink-0">{toArabicNumerals(pageNo)}</div>
);

const StudentRow = ({ cell }) => (
  <table className="w-full border-collapse border border-black">
    <tbody>
      <tr>
        <td className={`border border-black ${cell} w-[10%] font-bold`}>نام :</td>
        <td className={`border border-black ${cell} w-[40%]`}></td>
        <td className={`border border-black ${cell} w-[14%] font-sans font-bold text-left text-[0.6em]`} dir="ltr">ITS NO:</td>
        <td className={`border border-black ${cell} w-[20%]`}></td>
        <td className={`border border-black ${cell} w-[12%] font-sans font-bold text-left text-[0.6em]`} dir="ltr">ROLL:</td>
        <td className={`border border-black ${cell} w-[10%]`}></td>
      </tr>
    </tbody>
  </table>
);

const MarksTable = ({ subjects, cell }) => (
  <table className="w-full border-collapse border border-black text-center font-bold">
    <thead><tr className="bg-gray-100"><th className={`border border-black ${cell} w-16`}>رقم</th><th className={`border border-black ${cell}`}>المواضيع</th><th className={`border border-black ${cell} w-24`}>ماركس</th><th className={`border border-black ${cell} w-32`}>المحصول</th></tr></thead>
    <tbody>
      {subjects.map((sub, i) => (
        <tr key={sub.id}><td className={`border border-black ${cell}`}>{toArabicNumerals(i + 1)}</td><td className={`border border-black ${cell} text-right pr-4`}>{sub.title}</td><td className={`border border-black ${cell}`}>{toArabicNumerals(subjectTotal(sub))}</td><td className={`border border-black ${cell}`}></td></tr>
      ))}
      <tr className="bg-gray-50"><td className={`border border-black ${cell}`} colSpan="2">جملة</td><td className={`border border-black ${cell}`}>{toArabicNumerals(grandTotal(subjects))}</td><td className={`border border-black ${cell}`}></td></tr>
    </tbody>
  </table>
);

const CoverPage = ({ header, school, subjects }) => {
  const dense = subjects.length > 5;
  const cell = dense ? 'p-1' : 'p-2.5';
  return (
    <div className="flex-1 flex flex-col">
      <div className={`text-center flex flex-col items-center pt-6 ${dense ? 'mb-4' : 'mb-10'}`}>
        {school?.logo && <img src={school.logo} alt="" className={`${dense ? 'h-20' : 'h-28'} object-contain mb-3`} />}
        <h2 className="text-[1.9em] font-bold mb-3">{school?.nameAr}</h2>
        <h3 className="text-[1.5em] font-bold mb-3">{header.examName} {yearText(header)}</h3>
        <h3 className="text-[1.25em] font-bold">{header.className}</h3>
      </div>
      <div className="flex justify-between items-end mb-4 font-bold border-b-2 border-black pb-2">
        <span>{header.className}</span>
        <span className="font-sans text-[0.75em]">{header.paperNumber}</span>
        <span className="font-sans text-[0.75em] font-medium" dir="ltr">Time: {header.time}</span>
      </div>
      <div className={dense ? 'mb-4' : 'mb-10'}><StudentRow cell={cell} /></div>
      <MarksTable subjects={subjects} cell={cell} />
    </div>
  );
};

// Compact info strip used instead of a full cover page.
const CompactHeader = ({ header, school, subjects }) => (
  <div className="mb-3">
    <div className="flex items-center gap-3 border-b-2 border-black pb-1 mb-2">
      {school?.logo && <img src={school.logo} alt="" className="h-12 object-contain" />}
      <div className="flex-1 text-center">
        <div className="text-[1.15em] font-bold leading-snug">{school?.nameAr}</div>
        <div className="font-bold leading-snug">{header.examName} {yearText(header)} — {header.className}</div>
      </div>
    </div>
    <div className="flex justify-between font-bold text-[0.8em] mb-2">
      <span>{subjects.map(s => s.title).join(' ، ')}</span>
      <span className="font-sans whitespace-nowrap" dir="ltr">{header.paperNumber} · Time: {header.time} · Marks: {grandTotal(subjects)}</span>
    </div>
    <StudentRow cell="p-1" />
  </div>
);

const Sheet = forwardRef(({ layout, className = '', children }, ref) => (
  <div ref={ref} className={`a4-sheet size-${layout.textSize || 'normal'} ${className}`} dir="rtl">
    {layout.pageBorder && <div className="sheet-border" />}
    {children}
  </div>
));

// ---------------------------------------------------------------------------
// PREVIEW
// ---------------------------------------------------------------------------
export default function PaperPreview({ header, subjects, school, layout, pagesRef }) {
  const blocks = buildBlocks(subjects, layout);
  const measureRef = useRef(null);
  const firstTplRef = useRef(null);
  const restTplRef = useRef(null);
  const [measure, setMeasure] = useState(null);
  const [fontsReady, setFontsReady] = useState(false);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let alive = true;
    document.fonts?.load('20px "KanzAlMarjaan"').catch(() => {}).finally(() => document.fonts.ready.then(() => alive && setFontsReady(true)));
    if (!document.fonts) setFontsReady(true);
    return () => { alive = false; };
  }, []);

  // Fit the A4 pages to narrow phone screens (print always resets zoom to 1).
  useEffect(() => {
    const onResize = () => {
      const a4px = 210 * 96 / 25.4;
      setZoom(Math.min(1, (window.innerWidth - 16) / a4px));
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const signature = JSON.stringify([subjects, layout, header, !!school?.logo, school?.nameAr, fontsReady]);
  useLayoutEffect(() => {
    if (!measureRef.current) return;
    const heights = {};
    measureRef.current.querySelectorAll('[data-block]').forEach(el => { heights[el.dataset.block] = el.getBoundingClientRect().height; });
    const capFirst = firstTplRef.current.querySelector('.sheet-content').getBoundingClientRect().height;
    const capRest = restTplRef.current.querySelector('.sheet-content').getBoundingClientRect().height;
    setMeasure({ signature, heights, capFirst, capRest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const cover = layout.coverStyle === 'full';
  const compact = layout.coverStyle === 'compact';
  const pages = measure && measure.signature === signature ? paginate(blocks, measure.heights, measure.capFirst, measure.capRest) : null;
  const pageCount = (pages?.length || 0) + (cover ? 1 : 0);

  const chrome = (isFirst) => compact && isFirst
    ? <CompactHeader header={header} school={school} subjects={subjects} />
    : <RunningHeader header={header} />;
  const footer = (pageNo, pageBlocks) => layout.showFooter
    ? <Footer header={header} subjects={[...new Set(pageBlocks.map(b => b.subject).filter(Boolean))]} pageNo={pageNo} pageCount={pageCount} />
    : <PageNumberOnly pageNo={pageNo} />;
  const footerSample = layout.showFooter ? <Footer header={header} subjects={subjects.map(s => s.title)} pageNo={1} pageCount={1} /> : <PageNumberOnly pageNo={1} />;

  return (
    <>
      {/* Hidden measuring pass: same sheet, same width, same fonts. */}
      <div ref={measureRef} className="paper-measure" aria-hidden="true">
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
          ) : (
            <>
              {cover && (
                <Sheet layout={layout}>
                  <CoverPage header={header} school={school} subjects={subjects} />
                  {layout.showFooter ? <Footer header={header} subjects={[]} pageNo={1} pageCount={pageCount} /> : <PageNumberOnly pageNo={1} />}
                </Sheet>
              )}
              {pages.map((pageBlocks, i) => (
                <Sheet key={i} layout={layout}>
                  {chrome(i === 0)}
                  <div className="sheet-content">
                    {pageBlocks.map(b => <div key={b.key} className="paper-block">{b.node}</div>)}
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
