import { uid, subLabel, toArabicNumerals, QUESTION_TYPES } from '../lib/paper'

const inputCls = 'w-full border border-gray-300 p-2 rounded-md font-arabic text-lg focus:border-indigo-400 focus:outline-none';

export const Stepper = ({ value, onChange, step = 1, min = 0, decimals = false, className = '' }) => {
  const parse = (v) => (decimals ? parseFloat(v) : parseInt(v)) || 0;
  const fix = (n) => Math.max(min, Math.round(n * 100) / 100);
  return (
    <div className={`flex border border-gray-300 rounded-md overflow-hidden bg-white w-28 ${className}`}>
      <button type="button" onClick={() => onChange(fix(parse(value) - step))} className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-r border-gray-300">−</button>
      <input type="number" inputMode="decimal" step={decimals ? 0.5 : 1} min={min} value={value ?? 0} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(fix(parse(e.target.value)))} className="w-full min-w-0 text-center p-1.5 font-sans text-sm outline-none" />
      <button type="button" onClick={() => onChange(fix(parse(value) + step))} className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-l border-gray-300">+</button>
    </div>
  );
};

const RemoveBtn = ({ onClick, title = 'Remove' }) => (
  <button type="button" onClick={onClick} title={title} className="shrink-0 w-8 h-8 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 font-bold text-lg">×</button>
);

const AddBtn = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="mt-2 text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-md font-bold border border-indigo-200 hover:bg-indigo-100">{children}</button>
);

const Hint = ({ children }) => <p className="text-xs text-blue-600 mb-3">ℹ️ {children}</p>;

const Toggle = ({ checked, onChange, children }) => (
  <label className="inline-flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer select-none">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4" />{children}
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
              ? <textarea rows={1} value={it.text || ''} onChange={(e) => update(it.id, { text: e.target.value })} placeholder={placeholder} className={`${inputCls} min-h-[44px]`} dir="rtl" />
              : <input type="text" value={it.text || ''} onChange={(e) => update(it.id, { text: e.target.value })} placeholder={placeholder} className={inputCls} dir="rtl" />}
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
            <input type="text" value={o} onChange={(e) => onChange(opts.map((x, j) => (j === k ? e.target.value : x)))} placeholder={`Option ${k + 1}`} className="w-32 bg-transparent p-1.5 font-arabic text-lg outline-none" dir="rtl" />
            <button type="button" onClick={() => onChange(opts.filter((_, j) => j !== k))} className="px-1.5 text-red-400 hover:text-red-600">×</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...opts, ''])} className="text-xs text-indigo-700 font-bold px-2 py-1 rounded-md border border-dashed border-indigo-300 hover:bg-indigo-50">+ Option</button>
      </div>
      {optional && opts.length === 0 && <p className="text-[11px] text-gray-400 mt-1">No options → answer lines for القائل / المقول له are printed.</p>}
    </div>
  );
}

export default function QuestionEditor({ q, index, total, onChange, onRemove, onMove, onDuplicate, layout }) {
  const set = (field, value) => onChange({ ...q, [field]: value });
  const typeInfo = QUESTION_TYPES.find(t => t.type === q.type);

  return (
    <div className="bg-gray-50 p-3 md:p-4 mb-4 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-700 text-sm flex items-center gap-2">
          <span className="font-arabic text-lg text-indigo-700">{layout.questionLabel === 'number' ? `${toArabicNumerals(index + 1)}.` : `س${toArabicNumerals(index + 1)}`}</span>
          <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded px-2 py-0.5">{typeInfo?.icon} {typeInfo?.label || q.type}</span>
        </h3>
        <div className="flex items-center gap-1 text-gray-500">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} title="Move up" className="w-8 h-8 rounded hover:bg-gray-200 disabled:opacity-30">↑</button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} title="Move down" className="w-8 h-8 rounded hover:bg-gray-200 disabled:opacity-30">↓</button>
          <button type="button" onClick={onDuplicate} title="Duplicate" className="w-8 h-8 rounded hover:bg-gray-200">⧉</button>
          <button type="button" onClick={onRemove} title="Delete question" className="w-8 h-8 rounded text-red-400 hover:text-red-600 hover:bg-red-50">🗑</button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1">
          <label className="block mb-1 text-xs font-bold text-gray-600">Question / Instruction</label>
          <input type="text" value={q.text || ''} onChange={(e) => set('text', e.target.value)} className={inputCls} dir="rtl" />
        </div>
        <div>
          <label className="block mb-1 text-xs font-bold text-gray-600">Marks</label>
          <Stepper value={q.marks} onChange={(v) => set('marks', v)} step={0.5} decimals />
        </div>
      </div>

      <div className="mb-3"><Toggle checked={q.newPage} onChange={(v) => set('newPage', v)}>Start this question on a new page</Toggle></div>

      <div className="border-t border-gray-200 pt-3">
        {q.type === 'subjective' && (
          <>
            <Hint>Each sub-question gets its own answer lines. Set lines to 0 for no lines.</Hint>
            <div className="space-y-2">
              {(q.subQuestions || []).map((sq, i) => (
                <div key={sq.id} className="flex flex-col sm:flex-row gap-2 bg-white p-2 rounded-md border border-gray-200 shadow-sm">
                  <div className="flex gap-2 flex-1">
                    <span className="font-bold text-lg pt-1.5 font-arabic text-gray-400 w-10 text-center shrink-0">{subLabel(i, layout.subNumbering)}</span>
                    <textarea value={sq.text || ''} onChange={(e) => set('subQuestions', q.subQuestions.map(x => (x.id === sq.id ? { ...x, text: e.target.value } : x)))} className={`${inputCls} min-h-[48px]`} dir="rtl" placeholder="..." />
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
                    <input type="text" value={b.answer || ''} onChange={(e) => set('blanks', q.blanks.map(x => (x.id === b.id ? { ...x, answer: e.target.value } : x)))} placeholder="Answer" className="w-full sm:w-36 border border-green-300 bg-green-50 p-2 rounded-md font-arabic text-lg" dir="rtl" />
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
            <textarea value={q.content || ''} onChange={(e) => set('content', e.target.value)} className={`${inputCls} min-h-[120px]`} dir="rtl" />
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-bold text-gray-600">Answer lines after text</span>
              <Stepper value={q.lines} onChange={(v) => set('lines', v)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
