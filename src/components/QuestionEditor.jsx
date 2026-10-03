import { useState, useRef, useLayoutEffect } from 'react'
import { uid, subLabel, toArabicNumerals } from '../lib/paper'
import { resizeImage } from '../lib/pdf'

export const inputCls = 'w-full border border-gray-300 px-3 py-2 rounded-lg font-arabic text-xl leading-relaxed bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none';

// Textarea that grows with its content, so long Arabic lines are never hidden.
export function AutoText({ value, onChange, placeholder, className = '', minRows = 1 }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir="rtl" spellCheck={false} autoComplete="off" className={`${inputCls} resize-none overflow-hidden ${className}`} />;
}

export const Stepper = ({ value, onChange, step = 1, min = 0, decimals = false, className = '' }) => {
  const parse = (v) => (decimals ? parseFloat(v) : parseInt(v)) || 0;
  const fix = (n) => Math.max(min, Math.round(n * 100) / 100);
  return (
    <div className={`flex border border-gray-300 rounded-lg overflow-hidden bg-white w-32 h-11 ${className}`}>
      <button type="button" onClick={() => onChange(fix(parse(value) - step))} className="w-10 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xl font-bold border-r border-gray-300">−</button>
      <input type="number" inputMode="decimal" step={decimals ? 0.5 : 1} min={min} value={value ?? 0} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(fix(parse(e.target.value)))} className="w-full min-w-0 text-center p-1.5 font-sans text-base outline-none" />
      <button type="button" onClick={() => onChange(fix(parse(value) + step))} className="w-10 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xl font-bold border-l border-gray-300">+</button>
    </div>
  );
};

const RemoveBtn = ({ onClick, title = 'Remove' }) => (
  <button type="button" onClick={onClick} title={title} className="shrink-0 w-10 h-10 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 font-bold text-lg">×</button>
);

const AddBtn = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="mt-3 text-sm bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-lg font-bold border border-indigo-200 hover:bg-indigo-100">{children}</button>
);

const Hint = ({ children }) => <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 mb-3">💡 {children}</p>;

const Toggle = ({ checked, onChange, children }) => (
  <label className="inline-flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer select-none">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-indigo-600" />{children}
  </label>
);

// Generic editor for a list of { id, text } items (used by MCQ, True/False, Who said, Word list).
function ItemList({ items, onChange, placeholder, numbering = 'numeric', renderExtra, newItem, addLabel, multiline }) {
  const update = (id, patch) => onChange(items.map(it => (it.id === id ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={it.id} className="bg-white p-2 border border-gray-200 rounded-md shadow-sm">
          <div className="flex gap-2 items-start">
            <span className="font-bold font-arabic text-gray-400 text-lg pt-1.5 w-10 text-center shrink-0">{subLabel(i, numbering)}</span>
            {multiline
              ? <AutoText value={it.text || ''} onChange={(v) => update(it.id, { text: v })} placeholder={placeholder} />
              : <input type="text" value={it.text || ''} onChange={(e) => update(it.id, { text: e.target.value })} placeholder={placeholder} className={inputCls} dir="rtl" autoComplete="off" spellCheck={false} />}
            <RemoveBtn onClick={() => onChange(items.filter(x => x.id !== it.id))} />
          </div>
          {renderExtra && <div className="mt-2 mr-12">{renderExtra(it, (patch) => update(it.id, patch))}</div>}
        </div>
      ))}
      <AddBtn onClick={() => onChange([...items, newItem ? newItem() : { id: uid(), text: '' }])}>{addLabel || '+ Add item'}</AddBtn>
    </div>
  );
}

function OptionsEditor({ options, onChange, optional }) {
  const opts = options || [];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {opts.map((o, k) => (
          <div key={k} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md pr-2">
            <span className="text-gray-400 text-xs">○</span>
            <input type="text" value={o} onChange={(e) => onChange(opts.map((x, j) => (j === k ? e.target.value : x)))} placeholder={`Option ${k + 1}`} className="w-32 bg-transparent p-2 font-arabic text-xl outline-none" dir="rtl" />
            <button type="button" onClick={() => onChange(opts.filter((_, j) => j !== k))} className="px-1.5 text-red-400 hover:text-red-600">×</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...opts, ''])} className="text-xs text-indigo-700 font-bold px-2 py-1 rounded-md border border-dashed border-indigo-300 hover:bg-indigo-50">+ Option</button>
      </div>
      {optional && opts.length === 0 && <p className="text-[11px] text-gray-400 mt-1">No options → answer lines for القائل / المقول له are printed.</p>}
    </div>
  );
}

export default function QuestionEditor({ q, onChange, layout }) {
  const set = (field, value) => onChange({ ...q, [field]: value });
  const [more, setMore] = useState(false);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-bold text-gray-600">Question / Instruction</label>
          <AutoText value={q.text || ''} onChange={(v) => set('text', v)} placeholder="سؤال…" />
        </div>
        <div>
          <label className="block mb-1 text-sm font-bold text-gray-600">Marks</label>
          <Stepper value={q.marks} onChange={(v) => set('marks', v)} step={0.5} decimals />
        </div>
      </div>

      <button type="button" onClick={() => setMore(!more)} className="text-sm text-gray-500 font-bold mb-3">{more ? '▾' : '▸'} More options</button>
      {more && (
        <div className="flex flex-col gap-3 mb-4 bg-white border border-gray-200 rounded-lg p-3">
          <Toggle checked={q.newPage} onChange={(v) => set('newPage', v)}>Start this question on a new page</Toggle>
          <Toggle checked={q.hideNumber} onChange={(v) => set('hideNumber', v)}>No number (س) for this question</Toggle>
          <Toggle checked={q.hideMarks} onChange={(v) => set('hideMarks', v)}>Don't print the marks</Toggle>
        </div>
      )}

      <div className="border-t border-gray-200 pt-3">
        {q.type === 'subjective' && (
          <>
            <Hint>Each sub-question gets its own answer lines. Set lines to 0 for no lines.</Hint>
            <div className="space-y-2">
              {(q.subQuestions || []).map((sq, i) => (
                <div key={sq.id} className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-md border border-gray-200 shadow-sm">
                  <div className="flex gap-2 flex-1">
                    <span className="font-bold text-lg pt-1.5 font-arabic text-gray-400 w-10 text-center shrink-0">{subLabel(i, layout.subNumbering)}</span>
                    <AutoText value={sq.text || ''} onChange={(v) => set('subQuestions', q.subQuestions.map(x => (x.id === sq.id ? { ...x, text: v } : x)))} placeholder="…" />
                  </div>
                  <div className="flex items-center gap-2 sm:flex-col sm:items-end mr-12 sm:mr-0">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Lines</span>
                    <Stepper value={sq.lines} onChange={(v) => set('subQuestions', q.subQuestions.map(x => (x.id === sq.id ? { ...x, lines: v } : x)))} />
                    {q.subQuestions.length > 1 && <button type="button" onClick={() => set('subQuestions', q.subQuestions.filter(x => x.id !== sq.id))} className="text-red-500 text-xs hover:underline">Remove</button>}
                  </div>
                </div>
              ))}
            </div>
            <AddBtn onClick={() => set('subQuestions', [...(q.subQuestions || []), { id: uid(), text: '', lines: 3 }])}>+ Sub-question</AddBtn>
          </>
        )}

        {q.type === 'fillBlanks' && (
          <>
            <Hint>Type a <b>*</b> where the blank line should go.</Hint>
            <div className="mb-3"><Toggle checked={q.showWordBank !== false} onChange={(v) => set('showWordBank', v)}>Show word bank (answers, shuffled) above</Toggle></div>
            <div className="space-y-2">
              {(q.blanks || []).map((b, i) => (
                <div key={b.id} className="flex gap-2 items-center bg-white p-2 border border-gray-200 rounded-md shadow-sm flex-wrap sm:flex-nowrap">
                  <span className="font-bold font-arabic text-gray-400 text-lg w-8 text-center">{toArabicNumerals(i + 1)})</span>
                  <input type="text" value={b.text || ''} onChange={(e) => set('blanks', q.blanks.map(x => (x.id === b.id ? { ...x, text: e.target.value } : x)))} placeholder="وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *" className={`${inputCls} flex-1 min-w-[60%]`} dir="rtl" />
                  {q.showWordBank !== false && (
                    <input type="text" value={b.answer || ''} onChange={(e) => set('blanks', q.blanks.map(x => (x.id === b.id ? { ...x, answer: e.target.value } : x)))} placeholder="Answer" className="w-full sm:w-40 border border-green-300 bg-green-50 px-3 py-2 rounded-lg font-arabic text-xl" dir="rtl" />
                  )}
                  <RemoveBtn onClick={() => set('blanks', q.blanks.filter(x => x.id !== b.id))} />
                </div>
              ))}
            </div>
            <AddBtn onClick={() => set('blanks', [...(q.blanks || []), { id: uid(), text: '', answer: '' }])}>+ Sentence</AddBtn>
          </>
        )}

        {q.type === 'match' && (
          <>
            <Hint>Type the correct pairs. The left column is jumbled automatically on the paper.</Hint>
            <div className="space-y-2">
              {(q.pairs || []).map((p, i) => (
                <div key={i} className="flex gap-2 items-center bg-white p-2 border border-gray-200 rounded-md shadow-sm">
                  <span className="font-bold text-gray-400 text-xs w-5">{i + 1}.</span>
                  <input type="text" value={p.right || ''} onChange={(e) => set('pairs', q.pairs.map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} placeholder="Right column" className={inputCls} dir="rtl" />
                  <span className="text-gray-300">=</span>
                  <input type="text" value={p.left || ''} onChange={(e) => set('pairs', q.pairs.map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} placeholder="Left column" className={inputCls} dir="rtl" />
                  <RemoveBtn onClick={() => set('pairs', q.pairs.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <AddBtn onClick={() => set('pairs', [...(q.pairs || []), { right: '', left: '' }])}>+ Pair</AddBtn>
          </>
        )}

        {q.type === 'mcq' && (
          <>
            <div className="flex gap-4 mb-3 text-xs font-bold text-gray-700">
              Options:
              <label className="flex items-center gap-1"><input type="radio" checked={q.optionLayout !== 'column'} onChange={() => set('optionLayout', 'row')} /> side by side</label>
              <label className="flex items-center gap-1"><input type="radio" checked={q.optionLayout === 'column'} onChange={() => set('optionLayout', 'column')} /> one per line</label>
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} numbering={layout.subNumbering} placeholder="Question…" addLabel="+ Question"
              newItem={() => ({ id: uid(), text: '', options: ['', '', ''] })}
              renderExtra={(it, patch) => <OptionsEditor options={it.options} onChange={(o) => patch({ options: o })} />} />
          </>
        )}

        {q.type === 'trueFalse' && (
          <>
            <div className="flex gap-4 mb-3 text-xs font-bold text-gray-700 flex-wrap">
              Answer style:
              <label className="flex items-center gap-1"><input type="radio" checked={q.tfStyle !== 'words'} onChange={() => set('tfStyle', 'box')} /> empty box [ ]</label>
              <label className="flex items-center gap-1"><input type="radio" checked={q.tfStyle === 'words'} onChange={() => set('tfStyle', 'words')} /> ( صحيح / غلط )</label>
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} placeholder="Statement…" addLabel="+ Statement" />
          </>
        )}

        {q.type === 'whoSaid' && (
          <>
            <Hint>Type the quote. Add options to make it multiple-choice, or leave none for answer lines.</Hint>
            <div className="flex gap-2 mb-3">
              <input type="text" value={q.saidLabels?.speaker ?? ''} onChange={(e) => set('saidLabels', { ...q.saidLabels, speaker: e.target.value })} placeholder="القائل" className={`${inputCls} text-base`} dir="rtl" />
              <input type="text" value={q.saidLabels?.listener ?? ''} onChange={(e) => set('saidLabels', { ...q.saidLabels, listener: e.target.value })} placeholder="المقول له" className={`${inputCls} text-base`} dir="rtl" />
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} placeholder="Quote…" addLabel="+ Quote" multiline
              newItem={() => ({ id: uid(), text: '', options: [] })}
              renderExtra={(it, patch) => <OptionsEditor options={it.options} onChange={(o) => patch({ options: o })} optional />} />
          </>
        )}

        {q.type === 'wordList' && (
          <>
            <div className="flex items-center gap-3 mb-3 text-xs font-bold text-gray-700">
              Columns on paper:
              {[1, 2, 3, 4].map(c => (
                <button key={c} type="button" onClick={() => set('columns', c)} className={`w-8 h-8 rounded-md border ${(parseInt(q.columns) || 2) === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300'}`}>{c}</button>
              ))}
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} placeholder="Word…" addLabel="+ Word" />
          </>
        )}

        {q.type === 'textBlock' && (
          <>
            <Hint>Any text you like — a passage, poem, or your own question format. Line breaks are kept.</Hint>
            <AutoText value={q.content || ''} onChange={(v) => set('content', v)} minRows={4} />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-bold text-gray-600">Answer lines after text</span>
              <Stepper value={q.lines} onChange={(v) => set('lines', v)} />
            </div>
          </>
        )}
        {q.type === 'table' && <TableEditor q={q} set={set} />}
        {q.type === 'image' && <ImageEditor q={q} set={set} />}
      </div>
    </div>
  );
}

function TableEditor({ q, set }) {
  const rows = q.rows || [['']];
  const cols = Math.max(1, ...rows.map(r => r.length));
  const setRows = (r) => set('rows', r);
  const cell = (r, c, v) => setRows(rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : row[j] || '')) : row)));
  return (
    <>
      <Hint>Type in any cell. Leave cells empty for students to write in.</Hint>
      <div className="flex flex-wrap gap-2 mb-3">
        <AddBtn onClick={() => setRows([...rows, Array(cols).fill('')])}>+ Row</AddBtn>
        <AddBtn onClick={() => setRows(rows.map(r => [...r, '']))}>+ Column</AddBtn>
        {rows.length > 1 && <button type="button" onClick={() => setRows(rows.slice(0, -1))} className="mt-3 text-sm text-red-500 px-3 py-2 rounded-lg border border-red-200">− Row</button>}
        {cols > 1 && <button type="button" onClick={() => setRows(rows.map(r => r.slice(0, cols - 1)))} className="mt-3 text-sm text-red-500 px-3 py-2 rounded-lg border border-red-200">− Column</button>}
      </div>
      <div className="mb-3"><Toggle checked={q.headerRow} onChange={(v) => set('headerRow', v)}>First row is a heading (shaded, bold)</Toggle></div>
      <div className="overflow-x-auto">
        <table className="border-collapse" dir="rtl">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="border border-gray-300 p-0">
                    <input type="text" value={row[c] || ''} onChange={(e) => cell(r, c, e.target.value)} dir="rtl" className={`w-32 px-2 py-2 font-arabic text-lg outline-none focus:bg-indigo-50 ${q.headerRow && r === 0 ? 'bg-gray-100 font-bold' : 'bg-white'}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ImageEditor({ q, set }) {
  const [busy, setBusy] = useState(false);
  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    try { set('src', await resizeImage(file, 1000, 'image/jpeg')); }
    catch { alert('Could not read that picture. Please try a JPG or PNG.'); }
    setBusy(false);
  };
  return (
    <>
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 rounded-lg p-4 text-indigo-700 font-bold cursor-pointer hover:bg-indigo-50">
        <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        {busy ? 'Loading…' : q.src ? '🔄 Change picture' : '📷 Choose a picture or take a photo'}
      </label>
      {q.src && (
        <div className="mt-3">
          <img src={q.src} alt="" className="max-h-48 mx-auto border rounded" />
          <div className="flex items-center gap-3 mt-3">
            <span className="text-sm font-bold text-gray-600 whitespace-nowrap">Size on paper</span>
            <input type="range" min="20" max="100" step="5" value={q.width || 60} onChange={(e) => set('width', +e.target.value)} className="flex-1 accent-indigo-600" />
            <span className="text-sm w-12">{q.width || 60}%</span>
          </div>
          <label className="block mt-3 mb-1 text-sm font-bold text-gray-600">Caption (optional)</label>
          <AutoText value={q.caption || ''} onChange={(v) => set('caption', v)} />
        </div>
      )}
      <div className="flex items-center gap-3 mt-3">
        <span className="text-sm font-bold text-gray-600">Answer lines below</span>
        <Stepper value={q.lines} onChange={(v) => set('lines', v)} />
      </div>
    </>
  );
}
