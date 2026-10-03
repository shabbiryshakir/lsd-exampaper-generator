import { useState, useEffect } from 'react'
import QuestionEditor from './QuestionEditor'
import { DARAJAH_OPTIONS, TIME_OPTIONS, QUESTION_TYPES, newQuestion, subjectTotal, grandTotal, uid, toArabicNumerals, questionNumbers, parseMarks } from '../lib/paper'

const Section = ({ title, summary, open, onToggle, children }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
    <button type="button" onClick={onToggle} className="w-full flex justify-between items-center gap-3 px-4 py-4 text-left">
      <div className="min-w-0">
        <div className="text-lg font-bold text-gray-800">{title}</div>
        {!open && summary && <div className="text-sm text-gray-500 truncate">{summary}</div>}
      </div>
      <span className={`text-gray-400 text-xl transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
    </button>
    {open && <div className="px-4 pb-5 border-t border-gray-100 pt-4">{children}</div>}
  </div>
);

const Choice = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(o => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)}
        className={`px-4 py-2.5 rounded-xl border-2 text-base text-right ${value === o.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-400'}`}>
        <div className="font-bold">{o.label}</div>
        {o.hint && <div className={`text-xs ${value === o.value ? 'text-indigo-100' : 'text-gray-500'}`}>{o.hint}</div>}
      </button>
    ))}
  </div>
);

const Row = ({ label, children }) => (
  <div className="py-4 border-b last:border-0 border-gray-100">
    <div className="text-sm font-bold text-gray-600 mb-2">{label}</div>
    {children}
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="block mb-1 font-bold text-sm text-gray-600">{label}</label>
    {children}
  </div>
);

const fieldCls = 'w-full border border-gray-300 px-3 py-2 rounded-lg h-12 bg-white focus:border-indigo-500 focus:outline-none';

function TypePicker({ onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl p-4 pb-8 sm:pb-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800">What kind of question?</h3>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 text-xl">✕</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {QUESTION_TYPES.map(t => (
            <button key={t.type} type="button" onClick={() => onPick(t.type)} className="bg-gray-50 border-2 border-gray-100 rounded-2xl p-3 text-left hover:border-indigo-500 active:bg-indigo-50">
              <div className="text-2xl mb-1">{t.icon}</div>
              <div className="font-bold text-gray-800 leading-tight">{t.label}</div>
              <div className="text-xs text-gray-500 leading-snug mt-1">{t.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Short one-line summary of a question for its folded card.
const summarize = (q) => {
  const first = q.text || q.content || q.subQuestions?.[0]?.text || q.items?.[0]?.text || q.blanks?.[0]?.text || q.pairs?.[0]?.right || q.rows?.[0]?.join(' · ') || q.caption || '';
  return first.trim() || '—';
};

function QuestionCard({ q, num, layout, open, onOpen, onChange, onMove, onDuplicate, onRemove, isFirst, isLast }) {
  const type = QUESTION_TYPES.find(t => t.type === q.type);
  const label = num === null ? '•' : layout.questionLabel === 'number' ? `${toArabicNumerals(num + 1)}.` : `س${toArabicNumerals(num + 1)}`;
  return (
    <div id={`qcard-${q.id}`} className={`rounded-2xl border-2 mb-3 scroll-mt-24 ${open ? 'border-indigo-400 bg-indigo-50/30' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-center gap-2 p-2 pr-3">
        <button type="button" onClick={onOpen} className="flex-1 flex items-center gap-3 min-w-0 text-left py-1">
          <span className="font-arabic text-xl text-indigo-700 font-bold w-12 text-center shrink-0">{label}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-gray-500 font-bold">{type?.icon} {type?.label}{parseMarks(q.marks) > 0 ? ` · ${parseMarks(q.marks)} marks` : ''}</span>
            <span className="block font-arabic text-lg text-gray-800 truncate" dir="rtl">{summarize(q)}</span>
          </span>
        </button>
        <div className="flex flex-col sm:flex-row gap-1 shrink-0">
          <button type="button" disabled={isFirst} onClick={() => onMove(-1)} aria-label="Move up" className="w-10 h-9 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-25">▲</button>
          <button type="button" disabled={isLast} onClick={() => onMove(1)} aria-label="Move down" className="w-10 h-9 rounded-lg bg-gray-100 text-gray-600 disabled:opacity-25">▼</button>
        </div>
      </div>
      {open && (
        <div className="px-3 sm:px-4 pb-4 pt-2 border-t border-indigo-100">
          <QuestionEditor q={q} onChange={onChange} layout={layout} />
          <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-gray-200">
            <button type="button" onClick={onOpen} className="flex-1 bg-indigo-600 text-white font-bold rounded-xl py-3 min-w-[120px]">✓ Done</button>
            <button type="button" onClick={onDuplicate} className="px-4 py-3 rounded-xl border border-gray-300 font-bold text-gray-700">⧉ Copy</button>
            <button type="button" onClick={onRemove} className="px-4 py-3 rounded-xl border border-red-200 text-red-600 font-bold">🗑 Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentFieldsEditor({ fields, onChange }) {
  return (
    <div className="space-y-2">
      {fields.map((f, i) => (
        <div key={i} className="flex gap-2">
          <input value={f} onChange={(e) => onChange(fields.map((x, j) => (j === i ? e.target.value : x)))} dir="auto" className={`${fieldCls} font-arabic text-lg`} />
          <button type="button" onClick={() => onChange(fields.filter((_, j) => j !== i))} className="w-12 h-12 rounded-lg text-red-500 border border-red-200 shrink-0">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, ''])} className="text-sm bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-lg font-bold border border-indigo-200">+ Add box (e.g. Section, Date, Teacher's sign)</button>
    </div>
  );
}

export default function Editor({ header, setHeader, subjects, setSubjects, layout, setLayout, activeId, setActiveId }) {
  const [openSection, setOpenSection] = useState(null);
  const [pickerFor, setPickerFor] = useState(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const onHeader = (e) => setHeader({ ...header, [e.target.name]: e.target.value });
  const setL = (k, v) => setLayout({ ...layout, [k]: v });

  const updateSubject = (id, fn) => setSubjects(subjects.map(s => (s.id === id ? fn(s) : s)));
  const setQuestions = (sid, fn) => updateSubject(sid, s => ({ ...s, questions: fn(s.questions || []) }));
  const moveSubject = (i, d) => { const a = [...subjects]; [a[i], a[i + d]] = [a[i + d], a[i]]; setSubjects(a); };

  const scrollToCard = (id) => requestAnimationFrame(() => document.getElementById(`qcard-${id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  const toggle = (id) => {
    const next = activeId === id ? null : id;
    setActiveId(next);
    if (next) scrollToCard(next);
  };

  // Coming back from the preview: land on the question that was being edited.
  useEffect(() => { if (activeId) document.getElementById(`qcard-${activeId}`)?.scrollIntoView({ block: 'start' }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addQuestion = (type) => {
    const q = newQuestion(type);
    setQuestions(pickerFor, qs => [...qs, q]);
    setPickerFor(null);
    setActiveId(q.id);
    scrollToCard(q.id);
  };

  const layoutSummary = [
    layout.coverStyle === 'full' ? 'Full cover page' : layout.coverStyle === 'compact' ? 'Name strip on page 1' : 'No cover',
    layout.pageBorder ? 'Border' : null,
    layout.showFooter ? 'Footer' : null,
    { small: 'Small text', large: 'Large text' }[layout.textSize],
  ].filter(Boolean).join(' · ');

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Section title="📄 Paper details" summary={`${header.className} · ${header.examName} ${header.hijriYear} · ${header.time} · ${grandTotal(subjects)} marks`} open={openSection === 'details'} onToggle={() => setOpenSection(openSection === 'details' ? null : 'details')}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Class (Darajah)" className="col-span-2 sm:col-span-1">
            <select name="className" value={header.className} onChange={onHeader} className={`${fieldCls} font-arabic text-xl`} dir="rtl">
              {[...new Set([header.className, ...DARAJAH_OPTIONS])].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Exam name" className="col-span-2 sm:col-span-1">
            <input type="text" name="examName" value={header.examName} onChange={onHeader} className={`${fieldCls} font-arabic text-xl`} dir="rtl" />
          </Field>
          <Field label="Hijri year"><input type="number" inputMode="numeric" name="hijriYear" value={header.hijriYear} onChange={onHeader} className={`${fieldCls} text-lg`} /></Field>
          <Field label="Paper no."><input type="text" name="paperNumber" value={header.paperNumber} onChange={onHeader} className={`${fieldCls} text-lg`} /></Field>
          <Field label="Duration" className="col-span-2 sm:col-span-1">
            <select name="time" value={header.time} onChange={onHeader} className={`${fieldCls} text-lg`}>
              {[...new Set([header.time, ...TIME_OPTIONS])].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      <Section title="🎨 Page style" summary={layoutSummary} open={openSection === 'layout'} onToggle={() => setOpenSection(openSection === 'layout' ? null : 'layout')}>
        <Row label="First page">
          <Choice value={layout.coverStyle} onChange={(v) => setL('coverStyle', v)} options={[
            { value: 'full', label: 'Full cover page', hint: 'Separate page with marks table' },
            { value: 'compact', label: 'Name strip on top', hint: 'Saves a whole page' },
            { value: 'none', label: 'No cover', hint: 'Questions start straight away' },
          ]} />
        </Row>
        {layout.coverStyle !== 'none' && (
          <Row label="Boxes for the student to fill in">
            <StudentFieldsEditor fields={layout.studentFields || []} onChange={(v) => setL('studentFields', v)} />
          </Row>
        )}
        <Row label="Question numbers">
          <Choice value={layout.questionLabel} onChange={(v) => setL('questionLabel', v)} options={[{ value: 'sin', label: 'س١ ، س٢' }, { value: 'number', label: '١. ٢.' }]} />
        </Row>
        <Row label="Sub-question numbers">
          <Choice value={layout.subNumbering} onChange={(v) => setL('subNumbering', v)} options={[{ value: 'abjad', label: 'الف) ب) ج)' }, { value: 'numeric', label: '١) ٢) ٣)' }]} />
        </Row>
        <Row label="Text size on paper">
          <Choice value={layout.textSize} onChange={(v) => setL('textSize', v)} options={[{ value: 'small', label: 'Small', hint: 'More per page' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large', hint: 'Young classes' }]} />
        </Row>
        <Row label="Extras">
          <div className="flex flex-col gap-3 text-base">
            <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={layout.pageBorder} onChange={(e) => setL('pageBorder', e.target.checked)} /> Border around every page</label>
            <label className="flex items-center gap-3"><input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={layout.showFooter} onChange={(e) => setL('showFooter', e.target.checked)} /> Footer with class, subject & page number</label>
          </div>
        </Row>
      </Section>

      {subjects.map((subject, sIndex) => {
        const qs = subject.questions || [];
        const nums = questionNumbers(qs);
        return (
          <div key={subject.id} id={`subject-${subject.id}`} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-3 sm:p-4 scroll-mt-24">
            <div className="flex items-center gap-2 mb-3">
              <input type="text" value={subject.title || ''} onChange={(e) => updateSubject(subject.id, s => ({ ...s, title: e.target.value }))} placeholder="Subject name" className="flex-1 min-w-0 border-b-2 border-indigo-200 focus:border-indigo-500 px-2 py-2 text-2xl font-bold font-arabic outline-none bg-transparent" dir="rtl" />
              <span className="px-3 py-1.5 bg-indigo-50 rounded-lg font-bold text-indigo-700 text-sm whitespace-nowrap">{subjectTotal(subject)} marks</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              {sIndex > 0 && <label className="flex items-center gap-2 text-gray-600 mr-auto"><input type="checkbox" className="w-5 h-5 accent-indigo-600" checked={!!subject.newPage} onChange={(e) => updateSubject(subject.id, s => ({ ...s, newPage: e.target.checked }))} /> Start on new page</label>}
              <div className="flex gap-2 ml-auto">
                <button type="button" disabled={sIndex === 0} onClick={() => moveSubject(sIndex, -1)} className="px-3 h-9 rounded-lg bg-gray-100 disabled:opacity-25">▲</button>
                <button type="button" disabled={sIndex === subjects.length - 1} onClick={() => moveSubject(sIndex, 1)} className="px-3 h-9 rounded-lg bg-gray-100 disabled:opacity-25">▼</button>
                <button type="button" onClick={() => { if (window.confirm(`Delete subject "${subject.title}" and all its questions?`)) setSubjects(subjects.filter(s => s.id !== subject.id)); }} className="px-3 h-9 rounded-lg text-red-600 border border-red-200 font-bold">Delete</button>
              </div>
            </div>

            {qs.map((q, qIndex) => (
              <QuestionCard key={q.id} q={q} num={nums[qIndex]} layout={layout} open={activeId === q.id} isFirst={qIndex === 0} isLast={qIndex === qs.length - 1}
                onOpen={() => toggle(q.id)}
                onChange={(nq) => setQuestions(subject.id, list => list.map(x => (x.id === q.id ? nq : x)))}
                onRemove={() => { if (window.confirm('Delete this question?')) setQuestions(subject.id, list => list.filter(x => x.id !== q.id)); }}
                onMove={(d) => { setQuestions(subject.id, list => { const a = [...list]; [a[qIndex], a[qIndex + d]] = [a[qIndex + d], a[qIndex]]; return a; }); scrollToCard(q.id); }}
                onDuplicate={() => {
                  const copy = JSON.parse(JSON.stringify(q)); copy.id = uid();
                  ['subQuestions', 'blanks', 'items'].forEach(k => copy[k]?.forEach(x => { x.id = uid(); }));
                  setQuestions(subject.id, list => { const a = [...list]; a.splice(qIndex + 1, 0, copy); return a; });
                  setActiveId(copy.id); scrollToCard(copy.id);
                }}
              />
            ))}
            <button type="button" onClick={() => setPickerFor(subject.id)} className="w-full border-2 border-dashed border-indigo-300 text-indigo-700 rounded-2xl py-4 font-bold text-base hover:bg-indigo-50 active:bg-indigo-100">+ Add question</button>
          </div>
        );
      })}
      <button type="button" onClick={() => setSubjects([...subjects, { id: uid(), title: 'New Subject', questions: [] }])} className="w-full bg-white border-2 border-gray-200 text-gray-700 py-4 rounded-2xl font-bold text-base">+ Add another subject</button>

      {/* Jump-to list: quick navigation in long papers */}
      {!activeId && <button type="button" onClick={() => setOutlineOpen(true)} className="fixed right-4 bottom-24 sm:bottom-8 z-30 bg-white border border-gray-200 shadow-lg rounded-full px-4 h-12 font-bold text-gray-700 print:hidden">☰ Jump to</button>}
      {outlineOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setOutlineOpen(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-4 pb-8 max-h-[75vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 sm:hidden" />
            <button type="button" onClick={() => { setOutlineOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-gray-50 font-bold text-gray-600">↑ Paper details & style</button>
            {subjects.map(s => (
              <div key={s.id} className="mt-2">
                <button type="button" onClick={() => { setOutlineOpen(false); document.getElementById(`subject-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} className="w-full text-right px-3 py-2 font-arabic text-xl font-bold text-indigo-700" dir="rtl">{s.title}</button>
                {(s.questions || []).map((q, i) => {
                  const n = questionNumbers(s.questions)[i];
                  return (
                    <button key={q.id} type="button" onClick={() => { setOutlineOpen(false); setActiveId(q.id); scrollToCard(q.id); }} className="w-full flex gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-gray-50 text-right" dir="rtl">
                      <span className="font-arabic text-lg text-gray-500 w-10">{n === null ? '•' : `س${toArabicNumerals(n + 1)}`}</span>
                      <span className="font-arabic text-lg truncate">{summarize(q)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {pickerFor && <TypePicker onPick={addQuestion} onClose={() => setPickerFor(null)} />}
    </div>
  );
}
