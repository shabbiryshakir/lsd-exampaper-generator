import { useState, useRef, useLayoutEffect, createContext, useContext } from 'react'
import { uid, subLabel, langOf } from '../lib/paper'
import { resizeImage } from '../lib/pdf'
import Icon from './Icon'

// Paper language + "show answers" for every input inside the editor.
export const EditorContext = createContext({ dir: 'rtl', font: 'font-arabic', lang: 'lsd', answers: false, L: langOf({}) });
export const editorContextFor = (layout, answers) => {
  const L = langOf(layout);
  return { dir: L.dir, font: L.fontClass, lang: layout.language || 'lsd', answers, L };
};
const useUI = () => useContext(EditorContext);

const baseInput = 'w-full border border-gray-300 px-3 py-2 rounded-xl text-xl leading-relaxed bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none';
const answerInput = 'w-full border border-emerald-300 bg-emerald-50 px-3 py-2 rounded-xl text-lg focus:border-emerald-500 focus:outline-none placeholder:text-emerald-600/60';

// Textarea that grows with its content, so long lines are never hidden.
export function AutoText({ value, onChange, placeholder, className = '', minRows = 1, answer = false }) {
  const UI = useUI();
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 2 + 'px';
  }, [value]);
  return <textarea ref={ref} rows={minRows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={UI.dir} spellCheck={false} autoComplete="off" className={`${answer ? answerInput : baseInput} ${UI.font} resize-none overflow-hidden ${className}`} />;
}

function TextInput({ value, onChange, placeholder, className = '', answer = false }) {
  const UI = useUI();
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} dir={UI.dir} spellCheck={false} autoComplete="off" className={`${answer ? answerInput : baseInput} ${UI.font} ${className}`} />;
}

export const Stepper = ({ value, onChange, step = 1, min = 0, decimals = false, className = '' }) => {
  const parse = (v) => (decimals ? parseFloat(v) : parseInt(v)) || 0;
  const fix = (n) => Math.max(min, Math.round(n * 100) / 100);
  return (
    <div className={`flex border border-gray-300 rounded-xl overflow-hidden bg-white w-32 h-11 ${className}`} dir="ltr">
      <button type="button" aria-label="Less" onClick={() => onChange(fix(parse(value) - step))} className="w-10 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xl font-bold border-r border-gray-300">−</button>
      <input type="number" inputMode="decimal" step={decimals ? 0.5 : 1} min={min} value={value ?? 0} onChange={(e) => onChange(e.target.value)} onBlur={(e) => onChange(fix(parse(e.target.value)))} className="w-full min-w-0 text-center p-1.5 font-sans text-base outline-none" />
      <button type="button" aria-label="More" onClick={() => onChange(fix(parse(value) + step))} className="w-10 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xl font-bold border-l border-gray-300">+</button>
    </div>
  );
};

const RemoveBtn = ({ onClick, title = 'Remove' }) => (
  <button type="button" onClick={onClick} aria-label={title} title={title} className="shrink-0 w-10 h-10 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"><Icon name="X" size={20} /></button>
);

const AddBtn = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="mt-3 text-sm bg-white text-indigo-700 px-4 py-2.5 rounded-xl font-bold border border-indigo-200 hover:bg-indigo-50 inline-flex items-center gap-1.5"><Icon name="Plus" size={16} />{children}</button>
);

const Hint = ({ children }) => <p className="text-sm text-slate-600 bg-slate-100 rounded-xl px-3 py-2 mb-3">{children}</p>;

export const Toggle = ({ checked, onChange, children }) => (
  <label className="inline-flex items-center gap-3 text-sm font-bold text-gray-700 cursor-pointer select-none">
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} className="w-5 h-5 accent-indigo-600" />{children}
  </label>
);

const Label = ({ i, style }) => {
  const UI = useUI();
  return <span className={`font-bold ${UI.font} text-gray-400 text-lg pt-2 w-10 text-center shrink-0`}>{subLabel(i, style, UI.lang)}</span>;
};

// Generic editor for a list of { id, text } items (used by MCQ, True/False, Who said, Word list).
function ItemList({ items, onChange, placeholder, numbering = 'numeric', renderExtra, newItem, addLabel, multiline }) {
  const UI = useUI();
  const update = (id, patch) => onChange(items.map(it => (it.id === id ? { ...it, ...patch } : it)));
  return (
    <div className="space-y-2" dir={UI.dir}>
      {items.map((it, i) => (
        <div key={it.id} className="bg-white p-2 border border-gray-200 rounded-xl">
          <div className="flex gap-1 items-start">
            <Label i={i} style={numbering} />
            {multiline
              ? <AutoText value={it.text || ''} onChange={(v) => update(it.id, { text: v })} placeholder={placeholder} />
              : <TextInput value={it.text || ''} onChange={(v) => update(it.id, { text: v })} placeholder={placeholder} />}
            <RemoveBtn onClick={() => onChange(items.filter(x => x.id !== it.id))} />
          </div>
          {renderExtra && <div className="mt-2 ps-11">{renderExtra(it, (patch) => update(it.id, patch))}</div>}
        </div>
      ))}
      <AddBtn onClick={() => onChange([...items, newItem ? newItem() : { id: uid(), text: '' }])}>{addLabel || 'Add item'}</AddBtn>
    </div>
  );
}

// Options with a tap-to-mark correct answer (used for the answer key).
function OptionsEditor({ options, onChange, optional, answer, onAnswer }) {
  const UI = useUI();
  const opts = options || [];
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {opts.map((o, k) => (
          <div key={k} className={`flex items-center gap-1 border rounded-xl ps-1 ${answer === k ? 'bg-emerald-50 border-emerald-400' : 'bg-gray-50 border-gray-200'}`}>
            {onAnswer && (
              <button type="button" onClick={() => onAnswer(answer === k ? null : k)} aria-label="Mark as correct answer" title="Mark as correct answer"
                className={`w-8 h-8 rounded-full flex items-center justify-center ${answer === k ? 'text-emerald-600' : 'text-gray-300 hover:text-emerald-500'}`}>
                <Icon name="CircleCheckBig" size={20} />
              </button>
            )}
            <input type="text" value={o} onChange={(e) => onChange(opts.map((x, j) => (j === k ? e.target.value : x)))} placeholder={`Option ${k + 1}`} className={`w-32 bg-transparent p-2 ${UI.font} text-xl outline-none`} dir={UI.dir} />
            <button type="button" aria-label="Remove option" onClick={() => onChange(opts.filter((_, j) => j !== k))} className="px-1.5 text-gray-400 hover:text-red-600"><Icon name="X" size={16} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...opts, ''])} className="text-sm text-indigo-700 font-bold px-3 py-1.5 rounded-xl border border-dashed border-indigo-300 hover:bg-indigo-50">+ Option</button>
      </div>
      {onAnswer && opts.length > 0 && <p className="text-xs text-emerald-700 mt-1">Tap the ✓ next to the correct option for the answer key.</p>}
      {optional && opts.length === 0 && <p className="text-xs text-gray-400 mt-1">No options → answer lines are printed instead.</p>}
    </div>
  );
}

const Segmented = ({ value, onChange, options }) => (
  <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1 flex-wrap">
    {options.map(o => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${value === o.value ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>{o.label}</button>
    ))}
  </div>
);

export default function QuestionEditor({ q, onChange, layout }) {
  const UI = useUI();
  const set = (field, value) => onChange({ ...q, [field]: value });
  const [more, setMore] = useState(false);

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <div className="flex-1">
          <label className="block mb-1 text-sm font-bold text-gray-600">Question / Instruction</label>
          <AutoText value={q.text || ''} onChange={(v) => set('text', v)} placeholder={UI.lang === 'en' ? 'Question…' : 'سؤال…'} />
        </div>
        <div>
          <label className="block mb-1 text-sm font-bold text-gray-600">Marks</label>
          <Stepper value={q.marks} onChange={(v) => set('marks', v)} step={0.5} decimals />
        </div>
      </div>

      <button type="button" onClick={() => setMore(!more)} className="text-sm text-gray-500 font-bold mb-3 inline-flex items-center gap-1"><Icon name={more ? 'ChevronUp' : 'ChevronDown'} size={16} /> More options</button>
      {more && (
        <div className="flex flex-col gap-3 mb-4 bg-white border border-gray-200 rounded-xl p-3">
          <Toggle checked={q.newPage} onChange={(v) => set('newPage', v)}>Start this question on a new page</Toggle>
          <Toggle checked={q.hideNumber} onChange={(v) => set('hideNumber', v)}>No question number</Toggle>
          <Toggle checked={q.hideMarks} onChange={(v) => set('hideMarks', v)}>Don't print the marks</Toggle>
        </div>
      )}

      <div className="border-t border-gray-200 pt-3">
        {q.type === 'subjective' && (
          <>
            <div className="space-y-2" dir={UI.dir}>
              {(q.subQuestions || []).map((sq, i) => {
                const upd = (patch) => set('subQuestions', q.subQuestions.map(x => (x.id === sq.id ? { ...x, ...patch } : x)));
                return (
                  <div key={sq.id} className="bg-white p-2 rounded-xl border border-gray-200">
                    <div className="flex gap-1 items-start">
                      <Label i={i} style={layout.subNumbering} />
                      <AutoText value={sq.text || ''} onChange={(v) => upd({ text: v })} placeholder="…" />
                      {q.subQuestions.length > 1 && <RemoveBtn onClick={() => set('subQuestions', q.subQuestions.filter(x => x.id !== sq.id))} />}
                    </div>
                    <div className="flex items-center gap-3 mt-2 ps-11" dir="ltr">
                      <span className="text-sm font-bold text-gray-500">Answer lines</span>
                      <Stepper value={sq.lines} onChange={(v) => upd({ lines: v })} />
                    </div>
                    {UI.answers && <div className="mt-2 ps-11"><AutoText answer value={sq.answer || ''} onChange={(v) => upd({ answer: v })} placeholder="Model answer (for the answer key)" /></div>}
                  </div>
                );
              })}
            </div>
            <AddBtn onClick={() => set('subQuestions', [...(q.subQuestions || []), { id: uid(), text: '', lines: 3, answer: '' }])}>Sub-question</AddBtn>
          </>
        )}

        {q.type === 'fillBlanks' && (
          <>
            <Hint>Type a <b>*</b> where the blank line should go. The green box is the answer.</Hint>
            <div className="mb-3"><Toggle checked={q.showWordBank !== false} onChange={(v) => set('showWordBank', v)}>Show the answers as a word bank above</Toggle></div>
            <div className="space-y-2" dir={UI.dir}>
              {(q.blanks || []).map((b, i) => {
                const upd = (patch) => set('blanks', q.blanks.map(x => (x.id === b.id ? { ...x, ...patch } : x)));
                return (
                  <div key={b.id} className="bg-white p-2 border border-gray-200 rounded-xl">
                    <div className="flex gap-1 items-start">
                      <Label i={i} style="numeric" />
                      <AutoText value={b.text || ''} onChange={(v) => upd({ text: v })} placeholder={UI.lang === 'en' ? 'The sun rises in the *.' : 'وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *'} />
                      <RemoveBtn onClick={() => set('blanks', q.blanks.filter(x => x.id !== b.id))} />
                    </div>
                    {(q.showWordBank !== false || UI.answers) && <div className="mt-2 ps-11 pe-11"><TextInput answer value={b.answer || ''} onChange={(v) => upd({ answer: v })} placeholder="Answer" /></div>}
                  </div>
                );
              })}
            </div>
            <AddBtn onClick={() => set('blanks', [...(q.blanks || []), { id: uid(), text: '', answer: '' }])}>Sentence</AddBtn>
          </>
        )}

        {q.type === 'match' && (
          <>
            <Hint>Type the correct pairs. The second column is jumbled automatically on the paper.</Hint>
            <div className="space-y-2" dir={UI.dir}>
              {(q.pairs || []).map((p, i) => (
                <div key={i} className="flex gap-2 items-center bg-white p-2 border border-gray-200 rounded-xl">
                  <span className="font-bold text-gray-400 text-sm w-5 text-center">{i + 1}</span>
                  <TextInput value={p.right || ''} onChange={(v) => set('pairs', q.pairs.map((x, j) => (j === i ? { ...x, right: v } : x)))} placeholder="Column A" />
                  <Icon name="ArrowRightLeft" size={16} className="text-gray-300" />
                  <TextInput value={p.left || ''} onChange={(v) => set('pairs', q.pairs.map((x, j) => (j === i ? { ...x, left: v } : x)))} placeholder="Column B" />
                  <RemoveBtn onClick={() => set('pairs', q.pairs.filter((_, j) => j !== i))} />
                </div>
              ))}
            </div>
            <AddBtn onClick={() => set('pairs', [...(q.pairs || []), { right: '', left: '' }])}>Pair</AddBtn>
          </>
        )}

        {q.type === 'mcq' && (
          <>
            <div className="flex items-center gap-3 mb-3 text-sm font-bold text-gray-600">
              Options <Segmented value={q.optionLayout === 'column' ? 'column' : 'row'} onChange={(v) => set('optionLayout', v)} options={[{ value: 'row', label: 'Side by side' }, { value: 'column', label: 'One per line' }]} />
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} numbering={layout.subNumbering} placeholder="Question…" addLabel="Question"
              newItem={() => ({ id: uid(), text: '', options: ['', '', ''], answer: null })}
              renderExtra={(it, patch) => <OptionsEditor options={it.options} onChange={(o) => patch({ options: o, answer: it.answer != null && it.answer >= o.length ? null : it.answer })} answer={it.answer} onAnswer={(a) => patch({ answer: a })} />} />
          </>
        )}

        {q.type === 'trueFalse' && (
          <>
            <div className="flex items-center gap-3 mb-3 text-sm font-bold text-gray-600 flex-wrap">
              On paper <Segmented value={q.tfStyle === 'words' ? 'words' : 'box'} onChange={(v) => set('tfStyle', v)} options={[{ value: 'box', label: 'Empty box' }, { value: 'words', label: `( ${UI.L.t.true} / ${UI.L.t.false} )` }]} />
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} placeholder="Statement…" addLabel="Statement"
              newItem={() => ({ id: uid(), text: '', answer: null })}
              renderExtra={UI.answers ? (it, patch) => (
                <div className="flex gap-2">
                  {[[true, 'Check', UI.L.t.true], [false, 'X', UI.L.t.false]].map(([v, ic, label]) => (
                    <button key={label} type="button" onClick={() => patch({ answer: it.answer === v ? null : v })}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border text-sm font-bold ${it.answer === v ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-300 text-gray-600'}`}>
                      <Icon name={ic} size={16} />{label}
                    </button>
                  ))}
                </div>
              ) : undefined} />
          </>
        )}

        {q.type === 'whoSaid' && (
          <>
            <Hint>Type the quote. Add options to make it multiple-choice, or leave none for answer lines.</Hint>
            <div className="flex gap-2 mb-3" dir={UI.dir}>
              <TextInput value={q.saidLabels?.speaker ?? ''} onChange={(v) => set('saidLabels', { ...q.saidLabels, speaker: v })} placeholder={UI.L.t.speaker} className="text-base" />
              <TextInput value={q.saidLabels?.listener ?? ''} onChange={(v) => set('saidLabels', { ...q.saidLabels, listener: v })} placeholder={UI.L.t.listener} className="text-base" />
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} placeholder="Quote…" addLabel="Quote" multiline
              newItem={() => ({ id: uid(), text: '', options: [], answer: '' })}
              renderExtra={(it, patch) => (
                <>
                  <OptionsEditor options={it.options} onChange={(o) => patch({ options: o })} optional />
                  {UI.answers && <div className="mt-2"><TextInput answer value={it.answer || ''} onChange={(v) => patch({ answer: v })} placeholder="Answer: who said it, to whom" /></div>}
                </>
              )} />
          </>
        )}

        {q.type === 'wordList' && (
          <>
            <div className="flex items-center gap-3 mb-3 text-sm font-bold text-gray-600">
              Columns <Segmented value={parseInt(q.columns) || 2} onChange={(v) => set('columns', v)} options={[1, 2, 3, 4].map(c => ({ value: c, label: String(c) }))} />
            </div>
            <ItemList items={q.items || []} onChange={(v) => set('items', v)} placeholder="Word…" addLabel="Word"
              newItem={() => ({ id: uid(), text: '', answer: '' })}
              renderExtra={UI.answers ? (it, patch) => <TextInput answer value={it.answer || ''} onChange={(v) => patch({ answer: v })} placeholder="Answer" /> : undefined} />
          </>
        )}

        {q.type === 'textBlock' && (
          <>
            <Hint>Any text you like — a passage, poem, or your own question format. Line breaks are kept.</Hint>
            <AutoText value={q.content || ''} onChange={(v) => set('content', v)} minRows={4} />
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm font-bold text-gray-600">Answer lines after text</span>
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
  const UI = useUI();
  const rows = q.rows || [['']];
  const cols = Math.max(1, ...rows.map(r => r.length));
  const setRows = (r) => set('rows', r);
  const cell = (r, c, v) => setRows(rows.map((row, i) => (i === r ? Array.from({ length: cols }, (_, j) => (j === c ? v : row[j] || '')) : row)));
  const small = 'mt-3 text-sm px-3 py-2 rounded-xl border font-bold';
  return (
    <>
      <Hint>Type in any cell. Leave cells empty for students to write in.</Hint>
      <div className="flex flex-wrap gap-2 mb-3">
        <AddBtn onClick={() => setRows([...rows, Array(cols).fill('')])}>Row</AddBtn>
        <AddBtn onClick={() => setRows(rows.map(r => [...r, '']))}>Column</AddBtn>
        {rows.length > 1 && <button type="button" onClick={() => setRows(rows.slice(0, -1))} className={`${small} text-red-600 border-red-200`}>− Row</button>}
        {cols > 1 && <button type="button" onClick={() => setRows(rows.map(r => r.slice(0, cols - 1)))} className={`${small} text-red-600 border-red-200`}>− Column</button>}
      </div>
      <div className="mb-3"><Toggle checked={q.headerRow} onChange={(v) => set('headerRow', v)}>First row is a heading (shaded, bold)</Toggle></div>
      <div className="overflow-x-auto">
        <table className="border-collapse" dir={UI.dir}>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }, (_, c) => (
                  <td key={c} className="border border-gray-300 p-0">
                    <input type="text" value={row[c] || ''} onChange={(e) => cell(r, c, e.target.value)} dir={UI.dir} className={`w-32 px-2 py-2 ${UI.font} text-lg outline-none focus:bg-indigo-50 ${q.headerRow && r === 0 ? 'bg-gray-100 font-bold' : 'bg-white'}`} />
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
      <label className="flex items-center justify-center gap-2 border-2 border-dashed border-indigo-300 rounded-xl p-4 text-indigo-700 font-bold cursor-pointer hover:bg-indigo-50">
        <input type="file" accept="image/*" onChange={onFile} className="hidden" />
        <Icon name={busy ? 'Loader2' : 'Image'} size={20} />
        {busy ? 'Loading…' : q.src ? 'Change picture' : 'Choose a picture or take a photo'}
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
