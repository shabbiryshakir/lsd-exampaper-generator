import { useState } from 'react'
import QuestionEditor from './QuestionEditor'
import { DARAJAH_OPTIONS, TIME_OPTIONS, QUESTION_TYPES, newQuestion, subjectTotal, grandTotal, uid } from '../lib/paper'

const Card = ({ title, children, right }) => (
  <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
    <div className="flex justify-between items-center mb-4 border-b pb-2"><h2 className="text-lg font-bold text-gray-800">{title}</h2>{right}</div>
    {children}
  </div>
);

const Choice = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(o => (
      <button key={o.value} type="button" onClick={() => onChange(o.value)}
        className={`px-3 py-2 rounded-lg border text-sm text-right ${value === o.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400'}`}>
        <div className="font-bold">{o.label}</div>
        {o.hint && <div className={`text-[11px] ${value === o.value ? 'text-indigo-100' : 'text-gray-500'}`}>{o.hint}</div>}
      </button>
    ))}
  </div>
);

const Row = ({ label, children }) => (
  <div className="py-3 border-b last:border-0 border-gray-100">
    <div className="text-xs font-bold text-gray-600 mb-2">{label}</div>
    {children}
  </div>
);

function AddQuestionMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="w-full border-2 border-dashed border-indigo-300 text-indigo-700 rounded-lg py-3 font-bold text-sm hover:bg-indigo-50">+ Add Question</button>;
  }
  return (
    <div className="border-2 border-indigo-200 rounded-lg p-3 bg-indigo-50/40">
      <div className="flex justify-between items-center mb-2"><span className="text-sm font-bold text-gray-700">Choose question type</span><button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 px-2">✕</button></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {QUESTION_TYPES.map(t => (
          <button key={t.type} type="button" onClick={() => { onAdd(t.type); setOpen(false); }} className="bg-white border border-gray-200 rounded-lg p-2.5 text-left hover:border-indigo-500 hover:shadow-sm">
            <div className="font-bold text-sm text-gray-800">{t.icon} {t.label}</div>
            <div className="text-[11px] text-gray-500 leading-snug mt-0.5">{t.hint}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Editor({ header, setHeader, subjects, setSubjects, layout, setLayout }) {
  const [showLayout, setShowLayout] = useState(false);
  const onHeader = (e) => setHeader({ ...header, [e.target.name]: e.target.value });
  const setL = (k, v) => setLayout({ ...layout, [k]: v });

  const updateSubject = (id, fn) => setSubjects(subjects.map(s => (s.id === id ? fn(s) : s)));
  const setQuestions = (sid, fn) => updateSubject(sid, s => ({ ...s, questions: fn(s.questions || []) }));
  const moveSubject = (i, d) => { const a = [...subjects]; [a[i], a[i + d]] = [a[i + d], a[i]]; setSubjects(a); };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card title="Paper Details" right={<span className="text-sm font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded">Total marks: {grandTotal(subjects)}</span>}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-1 font-bold text-xs text-gray-600">Class (Darajah)</label>
            <select name="className" value={header.className} onChange={onHeader} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl">
              {[...new Set([header.className, ...DARAJAH_OPTIONS])].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-1 font-bold text-xs text-gray-600">Exam Name</label>
            <input type="text" name="examName" value={header.examName} onChange={onHeader} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl" />
          </div>
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-600">Hijri Year</label>
            <input type="number" inputMode="numeric" name="hijriYear" value={header.hijriYear} onChange={onHeader} className="w-full border border-gray-300 p-2 rounded-md text-lg" dir="ltr" />
          </div>
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-600">Paper No.</label>
            <input type="text" name="paperNumber" value={header.paperNumber} onChange={onHeader} className="w-full border border-gray-300 p-2 rounded-md text-sm h-[46px]" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-1 font-bold text-xs text-gray-600">Duration</label>
            <select name="time" value={header.time} onChange={onHeader} className="w-full border border-gray-300 p-2 rounded-md text-sm h-[46px]">
              {[...new Set([header.time, ...TIME_OPTIONS])].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
      </Card>

      <Card title="Page Layout & Style" right={<button type="button" onClick={() => setShowLayout(!showLayout)} className="text-sm text-indigo-700 font-bold">{showLayout ? 'Hide ▲' : 'Show ▼'}</button>}>
        {!showLayout ? (
          <p className="text-sm text-gray-500">
            {layout.coverStyle === 'full' ? 'Full cover page' : layout.coverStyle === 'compact' ? 'Name & class strip on top of page 1' : 'No cover'}
            {' · '}{layout.pageBorder ? 'Page border' : 'No border'}{' · '}{layout.showFooter ? 'Footer with class & subject' : 'Page number only'}
          </p>
        ) : (
          <div>
            <Row label="First page">
              <Choice value={layout.coverStyle} onChange={(v) => setL('coverStyle', v)} options={[
                { value: 'full', label: 'Full cover page', hint: 'Separate page with marks table' },
                { value: 'compact', label: 'Compact header', hint: 'Name / class on top — saves a page' },
                { value: 'none', label: 'No cover', hint: 'Questions start straight away' },
              ]} />
            </Row>
            <Row label="Question numbering">
              <Choice value={layout.questionLabel} onChange={(v) => setL('questionLabel', v)} options={[{ value: 'sin', label: 'س١ ، س٢' }, { value: 'number', label: '١. ٢.' }]} />
            </Row>
            <Row label="Sub-question numbering">
              <Choice value={layout.subNumbering} onChange={(v) => setL('subNumbering', v)} options={[{ value: 'abjad', label: 'الف) ب) ج)' }, { value: 'numeric', label: '١) ٢) ٣)' }]} />
            </Row>
            <Row label="Text size">
              <Choice value={layout.textSize} onChange={(v) => setL('textSize', v)} options={[{ value: 'small', label: 'Small', hint: 'Fits more per page' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large', hint: 'Younger classes' }]} />
            </Row>
            <Row label="Page extras">
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={layout.pageBorder} onChange={(e) => setL('pageBorder', e.target.checked)} /> Border around every page</label>
                <label className="flex items-center gap-2"><input type="checkbox" className="w-4 h-4" checked={layout.showFooter} onChange={(e) => setL('showFooter', e.target.checked)} /> Footer with class, subject and page number (helps when photocopying)</label>
              </div>
            </Row>
          </div>
        )}
      </Card>

      {subjects.map((subject, sIndex) => (
        <div key={subject.id} className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500">
          <div className="flex flex-col md:flex-row justify-between md:items-end mb-4 border-b pb-4 gap-3">
            <div className="flex-1">
              <label className="block mb-1 font-bold text-xs text-indigo-800">Subject {sIndex + 1} (الموضوع)</label>
              <input type="text" value={subject.title || ''} onChange={(e) => updateSubject(subject.id, s => ({ ...s, title: e.target.value }))} className="w-full border border-indigo-200 p-2 rounded-md text-xl font-bold font-arabic focus:border-indigo-400 focus:outline-none" dir="rtl" />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1.5 bg-indigo-50 rounded-md font-bold text-indigo-700 text-sm border border-indigo-100">Total: {subjectTotal(subject)}</span>
              <button type="button" disabled={sIndex === 0} onClick={() => moveSubject(sIndex, -1)} className="w-8 h-8 rounded border border-gray-200 disabled:opacity-30">↑</button>
              <button type="button" disabled={sIndex === subjects.length - 1} onClick={() => moveSubject(sIndex, 1)} className="w-8 h-8 rounded border border-gray-200 disabled:opacity-30">↓</button>
              <button type="button" onClick={() => { if (window.confirm(`Delete subject "${subject.title}" and all its questions?`)) setSubjects(subjects.filter(s => s.id !== subject.id)); }} className="text-red-500 text-xs font-bold px-2 py-1.5 rounded-md border border-red-200">Delete</button>
            </div>
          </div>
          {sIndex > 0 && (
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 mb-4"><input type="checkbox" className="w-4 h-4" checked={!!subject.newPage} onChange={(e) => updateSubject(subject.id, s => ({ ...s, newPage: e.target.checked }))} /> Start this subject on a new page</label>
          )}

          {(subject.questions || []).map((q, qIndex, arr) => (
            <QuestionEditor key={q.id} q={q} index={qIndex} total={arr.length} layout={layout}
              onChange={(nq) => setQuestions(subject.id, qs => qs.map(x => (x.id === q.id ? nq : x)))}
              onRemove={() => { if (window.confirm('Delete this question?')) setQuestions(subject.id, qs => qs.filter(x => x.id !== q.id)); }}
              onMove={(d) => setQuestions(subject.id, qs => { const a = [...qs]; [a[qIndex], a[qIndex + d]] = [a[qIndex + d], a[qIndex]]; return a; })}
              onDuplicate={() => setQuestions(subject.id, qs => { const copy = JSON.parse(JSON.stringify(q)); copy.id = uid(); ['subQuestions', 'blanks', 'items'].forEach(k => copy[k]?.forEach(x => { x.id = uid(); })); const a = [...qs]; a.splice(qIndex + 1, 0, copy); return a; })}
            />
          ))}
          <AddQuestionMenu onAdd={(type) => setQuestions(subject.id, qs => [...qs, newQuestion(type)])} />
        </div>
      ))}
      <button type="button" onClick={() => setSubjects([...subjects, { id: uid(), title: 'New Subject', questions: [] }])} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 p-3 rounded-xl hover:bg-indigo-100 font-bold text-sm shadow-sm">+ Add Subject</button>
    </div>
  );
}
