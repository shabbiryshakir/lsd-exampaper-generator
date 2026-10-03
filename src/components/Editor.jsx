import { useState, useEffect } from 'react'
import QuestionEditor, { EditorContext, editorContextFor, Toggle } from './QuestionEditor'
import Icon from './Icon'
import { TIME_OPTIONS, QUESTION_TYPES, LANGUAGES, langOf, newQuestion, subjectTotal, grandTotal, uid, questionNumbers, parseMarks, cloneWithNewIds, PAGE_PRESETS, presetOf, answerStats } from '../lib/paper'
import { BUILTIN_QUESTION_TEMPLATES } from '../lib/templates'

const Section = ({ icon, title, summary, open, onToggle, children }) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-card overflow-hidden">
    <button type="button" onClick={onToggle} aria-expanded={open} className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
      <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name={icon} size={20} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-slate-800">{title}</span>
        {!open && summary && <span className="block text-sm text-slate-500 truncate">{summary}</span>}
      </span>
      <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={20} className="text-slate-400" />
    </button>
    {open && <div className="px-4 pb-5 border-t border-slate-100 pt-3">{children}</div>}
  </div>
);

const Choice = ({ value, onChange, options }) => (
  <div className="flex flex-wrap gap-2">
    {options.map(o => (
      <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
        className={`px-4 py-2.5 rounded-xl border-2 text-base text-left ${value === o.value ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-700 hover:border-brand-400'}`}>
        <span className={`block font-bold ${o.font || ''}`}>{o.label}</span>
        {o.hint && <span className={`block text-xs ${value === o.value ? 'text-brand-100' : 'text-slate-500'}`}>{o.hint}</span>}
      </button>
    ))}
  </div>
);

const Seg = ({ value, onChange, options }) => (
  <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
    {options.map(o => (
      <button key={String(o.value)} type="button" onClick={() => onChange(o.value)}
        className={`flex-1 px-2 py-2 rounded-lg text-sm font-bold whitespace-nowrap ${value === o.value ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>
        <span className={o.font || ''}>{o.label}</span>
      </button>
    ))}
  </div>
);

const Row = ({ label, children }) => (
  <div className="py-3.5 border-b last:border-0 border-slate-100">
    <div className="text-sm font-bold text-slate-600 mb-2">{label}</div>
    {children}
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className="block mb-1 font-bold text-sm text-slate-600">{label}</label>
    {children}
  </div>
);

const fieldCls = 'w-full border border-slate-300 px-3 py-2 rounded-xl h-12 bg-white focus:border-brand-500 focus:outline-none';

const Sheet = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
    <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl p-4 pb-8 sm:pb-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-3 sm:hidden" />
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-bold text-slate-800">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center"><Icon name="X" /></button>
      </div>
      {children}
    </div>
  </div>
);

function TypePicker({ onPick, onTemplate, onClose, templates, onDeleteTemplate, language }) {
  const [tab, setTab] = useState('types');
  const mine = templates.filter(t => t.kind === 'question');
  const builtins = BUILTIN_QUESTION_TEMPLATES.filter(t => t.language === language);
  return (
    <Sheet title="Add a question" onClose={onClose}>
      <div className="inline-flex bg-slate-100 rounded-xl p-1 mb-4">
        {[['types', 'Question types'], ['templates', `Templates (${mine.length + builtins.length})`]].map(([v, l]) => (
          <button key={v} type="button" onClick={() => setTab(v)} className={`px-4 py-2 rounded-lg text-sm font-bold ${tab === v ? 'bg-white shadow text-brand-700' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {tab === 'types' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {QUESTION_TYPES.map(t => (
            <button key={t.type} type="button" onClick={() => onPick(t.type)} className="bg-white border-2 border-slate-100 rounded-2xl p-3 text-left hover:border-brand-500 active:bg-brand-50">
              <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center mb-2"><Icon name={t.icon} size={20} /></span>
              <span className="block font-bold text-slate-800 leading-tight">{t.label}</span>
              <span className="block text-xs text-slate-500 leading-snug mt-1">{t.hint}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {mine.length === 0 && <p className="text-sm text-slate-500 bg-slate-50 rounded-xl p-3">Your own templates appear here. Open any question and tap <b>Save as template</b> to reuse it in future papers.</p>}
          {[...mine, ...builtins].map(t => (
            <div key={t.id} className="flex items-center gap-2 border border-slate-200 rounded-xl">
              <button type="button" onClick={() => onTemplate(t)} className="flex-1 flex items-center gap-3 p-3 text-left min-w-0">
                <Icon name={t.builtin ? 'Sparkles' : 'Bookmark'} size={20} className={t.builtin ? 'text-amber-500' : 'text-brand-600'} />
                <span className="min-w-0">
                  <span className="block font-bold text-slate-800 truncate">{t.name}</span>
                  <span className="block text-xs text-slate-500">{QUESTION_TYPES.find(x => x.type === t.data?.type)?.label}{t.builtin ? ' · ready-made' : ' · yours'}</span>
                </span>
              </button>
              {!t.builtin && <button type="button" onClick={() => { if (window.confirm(`Delete template "${t.name}"?`)) onDeleteTemplate(t.id); }} aria-label="Delete template" className="w-11 h-11 text-slate-400 hover:text-red-600 flex items-center justify-center"><Icon name="Trash2" size={18} /></button>}
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

// Short one-line summary of a question for its folded card.
const summarize = (q) => {
  const first = q.text || q.content || q.subQuestions?.[0]?.text || q.items?.[0]?.text || q.blanks?.[0]?.text || q.pairs?.[0]?.right || q.rows?.[0]?.join(' · ') || q.caption || '';
  return first.trim() || '—';
};

const shortLabel = (num, layout) => {
  const L = langOf(layout);
  if (num === null) return '•';
  if (layout.questionLabel === 'number') return `${L.num(num + 1)}.`;
  return layout.language === 'en' ? `Q${num + 1}` : `س${L.num(num + 1)}`;
};

function QuestionCard({ q, num, layout, open, onOpen, onChange, onMove, onDuplicate, onRemove, onSaveTemplate, isFirst, isLast }) {
  const type = QUESTION_TYPES.find(t => t.type === q.type);
  const L = langOf(layout);
  return (
    <div id={`qcard-${q.id}`} className={`rounded-2xl border-2 mb-2.5 scroll-mt-20 ${open ? 'border-brand-400 bg-brand-50/30' : 'border-slate-100 bg-white'}`}>
      <div className="flex items-center gap-1 p-1.5 ps-2">
        <button type="button" onClick={onOpen} className="flex-1 flex items-center gap-2.5 min-w-0 text-left py-1">
          <span className={`${L.fontClass} text-xl text-brand-700 font-bold w-11 text-center shrink-0`}>{shortLabel(num, layout)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 font-bold"><Icon name={type?.icon} size={14} />{type?.label}{parseMarks(q.marks) > 0 ? ` · ${parseMarks(q.marks)} marks` : ''}</span>
            <span className={`block ${L.fontClass} text-lg text-slate-800 truncate`} dir={L.dir}>{summarize(q)}</span>
          </span>
        </button>
        <div className="flex flex-col gap-1 shrink-0">
          <button type="button" disabled={isFirst} onClick={() => onMove(-1)} aria-label="Move up" className="w-10 h-8 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-25 flex items-center justify-center"><Icon name="ChevronUp" size={18} /></button>
          <button type="button" disabled={isLast} onClick={() => onMove(1)} aria-label="Move down" className="w-10 h-8 rounded-lg bg-slate-50 text-slate-600 disabled:opacity-25 flex items-center justify-center"><Icon name="ChevronDown" size={18} /></button>
        </div>
      </div>
      {open && (
        <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-brand-100">
          <QuestionEditor q={q} onChange={onChange} layout={layout} />
          <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-200">
            <button type="button" onClick={onOpen} className="col-span-4 sm:col-span-1 bg-brand-600 text-white font-bold rounded-xl py-3 inline-flex items-center justify-center gap-2"><Icon name="Check" size={18} />Done</button>
            {[['Copy', 'Copy', onDuplicate], ['BookmarkPlus', 'Template', onSaveTemplate], ['Trash2', 'Delete', onRemove]].map(([ic, label, fn]) => (
              <button key={label} type="button" onClick={fn} className={`sm:col-span-1 ${label === 'Delete' ? 'col-span-1 text-red-600 border-red-200' : 'col-span-1 text-slate-700 border-slate-300'} ${label === 'Copy' ? 'col-span-2 sm:col-span-1' : ''} py-2.5 rounded-xl border font-bold text-sm inline-flex flex-col sm:flex-row items-center justify-center gap-1`}>
                <Icon name={ic} size={18} />{label}
              </button>
            ))}
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
          <button type="button" aria-label="Remove box" onClick={() => onChange(fields.filter((_, j) => j !== i))} className="w-12 h-12 rounded-xl text-red-500 border border-red-200 shrink-0 flex items-center justify-center"><Icon name="X" /></button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...fields, ''])} className="text-sm bg-white text-brand-700 px-4 py-2.5 rounded-xl font-bold border border-brand-200 inline-flex items-center gap-1.5"><Icon name="Plus" size={16} />Add box (Date, Section, Signature…)</button>
    </div>
  );
}

export default function Editor({ header, setHeader, subjects, setSubjects, layout, setLayout, activeId, setActiveId, showAnswers, setShowAnswers, templates, onSaveTemplate, onDeleteTemplate, onMakeDefaultStyle, members = [], myUid, hideJump = false }) {
  const [openSection, setOpenSection] = useState(null);
  const [moreStyle, setMoreStyle] = useState(false);
  const isShared = members.length > 1;
  const preset = presetOf(layout);
  const stats = answerStats(subjects);
  const [pickerFor, setPickerFor] = useState(null);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const L = langOf(layout);
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

  const insert = (q) => {
    setQuestions(pickerFor, qs => [...qs, q]);
    setPickerFor(null);
    setActiveId(q.id);
    scrollToCard(q.id);
  };

  const changeLanguage = (language) => {
    if (language === layout.language) return;
    const N = LANGUAGES[language];
    const O = langOf(layout);
    // Swap the untouched defaults over to the new language; anything the teacher typed is kept.
    setLayout({ ...layout, language, studentFields: JSON.stringify(layout.studentFields) === JSON.stringify(O.studentFields) ? N.studentFields : layout.studentFields });
    setHeader({
      ...header,
      className: O.classes.includes(header.className) ? N.header.className : header.className,
      examName: header.examName === O.header.examName ? N.header.examName : header.examName,
      hijriYear: header.hijriYear === O.header.hijriYear ? N.header.hijriYear : header.hijriYear,
    });
  };

  const layoutSummary = [
    L.name,
    PAGE_PRESETS.find(p => p.id === preset)?.label || 'Custom',
    layout.pageBorder ? 'Border' : null,
    layout.showFooter ? 'Footer' : null,
    { small: 'Small text', large: 'Large text' }[layout.textSize],
  ].filter(Boolean).join(' · ');

  return (
    <EditorContext.Provider value={editorContextFor(layout, showAnswers)}>
      <div className="max-w-3xl mx-auto space-y-3">
        <Section icon="FileText" title="Paper details" summary={`${header.className} · ${header.examName} ${header.hijriYear} · ${header.time} · ${grandTotal(subjects)} marks`} open={openSection === 'details'} onToggle={() => setOpenSection(openSection === 'details' ? null : 'details')}>
          <Row label="Paper language">
            <Choice value={layout.language || 'lsd'} onChange={changeLanguage} options={[
              { value: 'lsd', label: 'لسان الدعوة', font: 'font-arabic text-xl', hint: 'Right to left' },
              { value: 'en', label: 'English', hint: 'Left to right' },
            ]} />
          </Row>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <Field label="Class" className="col-span-2 sm:col-span-1">
              <select name="className" value={header.className} onChange={onHeader} className={`${fieldCls} ${L.fontClass} text-xl`} dir={L.dir}>
                {[...new Set([header.className, ...L.classes])].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
            <Field label="Exam name" className="col-span-2 sm:col-span-1">
              <input type="text" name="examName" value={header.examName} onChange={onHeader} className={`${fieldCls} ${L.fontClass} text-xl`} dir={L.dir} />
            </Field>
            <Field label={layout.language === 'en' ? 'Year' : 'Hijri year'}><input type="text" inputMode="numeric" name="hijriYear" value={header.hijriYear} onChange={onHeader} className={`${fieldCls} text-lg`} /></Field>
            <Field label="Paper no."><input type="text" name="paperNumber" value={header.paperNumber} onChange={onHeader} className={`${fieldCls} text-lg`} /></Field>
            <Field label="Duration" className="col-span-2 sm:col-span-1">
              <select name="time" value={header.time} onChange={onHeader} className={`${fieldCls} text-lg`}>
                {[...new Set([header.time, ...TIME_OPTIONS])].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>
          </div>
        </Section>

        <Section icon="Palette" title="Page style" summary={layoutSummary} open={openSection === 'layout'} onToggle={() => setOpenSection(openSection === 'layout' ? null : 'layout')}>
          {isShared && <p className="text-sm text-brand-800 bg-brand-50 rounded-xl px-3 py-2 mb-3 flex gap-2"><Icon name="Users" size={18} className="mt-0.5" />These page settings, and your school name & logo, are just yours. Your colleagues print their own way.</p>}
          <div className="grid grid-cols-3 gap-2">
            {PAGE_PRESETS.map(p => {
              const on = preset === p.id;
              return (
                <button key={p.id} type="button" onClick={() => setLayout({ ...layout, ...p.patch })}
                  className={`rounded-2xl border-2 p-3 text-start transition ${on ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`}>
                  <Icon name={p.icon} size={22} className={on ? 'text-brand-700' : 'text-slate-500'} />
                  <span className="block font-bold text-slate-800 text-sm mt-2 leading-tight">{p.label}</span>
                  <span className="block text-xs text-slate-500 leading-snug mt-0.5">{p.hint}</span>
                </button>
              );
            })}
          </div>
          <Row label="Text size on paper">
            <Seg value={layout.textSize} onChange={(v) => setL('textSize', v)} options={[{ value: 'small', label: 'Small' }, { value: 'normal', label: 'Normal' }, { value: 'large', label: 'Large' }]} />
          </Row>
          <button type="button" onClick={() => setMoreStyle(!moreStyle)} className="w-full flex items-center justify-between py-3 text-sm font-bold text-slate-600">
            <span>Customise numbering, cover & extras</span><Icon name={moreStyle ? 'ChevronUp' : 'ChevronDown'} size={18} />
          </button>
          {moreStyle && (
            <div className="border-t border-slate-100">
              <Row label="First page">
                <Seg value={layout.coverStyle} onChange={(v) => setL('coverStyle', v)} options={[{ value: 'full', label: 'Cover page' }, { value: 'compact', label: 'Name strip' }, { value: 'none', label: 'None' }]} />
              </Row>
              {layout.coverStyle !== 'none' && (
                <Row label="Boxes for the student to fill in">
                  <StudentFieldsEditor fields={layout.studentFields || []} onChange={(v) => setL('studentFields', v)} />
                </Row>
              )}
              <Row label="Question numbers">
                <Seg value={layout.questionLabel} onChange={(v) => setL('questionLabel', v)} options={layout.language === 'en'
                  ? [{ value: 'sin', label: 'Q1. Q2.' }, { value: 'number', label: '1. 2.' }]
                  : [{ value: 'sin', label: 'س١ ، س٢', font: 'font-arabic text-lg' }, { value: 'number', label: '١. ٢.', font: 'font-arabic text-lg' }]} />
              </Row>
              <Row label="Sub-question numbers">
                <Seg value={layout.subNumbering} onChange={(v) => setL('subNumbering', v)} options={layout.language === 'en'
                  ? [{ value: 'abjad', label: 'a) b) c)' }, { value: 'numeric', label: '1) 2) 3)' }]
                  : [{ value: 'abjad', label: 'الف) ب) ج)', font: 'font-arabic text-lg' }, { value: 'numeric', label: '١) ٢) ٣)', font: 'font-arabic text-lg' }]} />
              </Row>
              <Row label="Extras">
                <div className="flex flex-col gap-3">
                  <Toggle checked={layout.pageBorder} onChange={(v) => setL('pageBorder', v)}>Border around every page</Toggle>
                  <Toggle checked={layout.showFooter} onChange={(v) => setL('showFooter', v)}>Footer with class, subject & page number</Toggle>
                </div>
              </Row>
            </div>
          )}
          <button type="button" onClick={() => onMakeDefaultStyle(layout)} className="mt-2 w-full text-sm font-bold text-brand-700 bg-brand-50 rounded-xl py-3 inline-flex items-center justify-center gap-2"><Icon name="Bookmark" size={16} />Use this style for all my new papers</button>
        </Section>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-card px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-3 min-w-0">
              <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Icon name="KeyRound" size={20} /></span>
              <span className="min-w-0"><span className="block font-bold text-slate-800">Answer key</span><span className="block text-xs text-slate-500">{stats.total ? `${stats.done} of ${stats.total} questions answered` : 'Type answers for the printable key'}</span></span>
            </span>
            <button type="button" role="switch" aria-checked={showAnswers} aria-label="Show answer boxes" onClick={() => setShowAnswers(!showAnswers)} className={`w-14 h-8 rounded-full p-1 transition shrink-0 ${showAnswers ? 'bg-amber-500' : 'bg-slate-300'}`}>
              <span className={`block w-6 h-6 rounded-full bg-white shadow transition ${showAnswers ? 'translate-x-6' : ''}`} />
            </button>
          </div>
          {stats.total > 0 && <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden"><div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.round(stats.done / stats.total * 100)}%` }} /></div>}
        </div>

        {subjects.map((subject, sIndex) => {
          const qs = subject.questions || [];
          const nums = questionNumbers(qs);
          return (
            <div key={subject.id} id={`subject-${subject.id}`} className="bg-white rounded-2xl border border-slate-200 shadow-card p-3 sm:p-4 scroll-mt-20">
              <div className="flex items-center gap-2 mb-2">
                <input type="text" value={subject.title || ''} onChange={(e) => updateSubject(subject.id, s => ({ ...s, title: e.target.value }))} placeholder="Subject name" className={`flex-1 min-w-0 border-b-2 border-brand-100 focus:border-brand-500 px-1 py-1.5 text-2xl font-bold ${L.fontClass} outline-none bg-transparent`} dir={L.dir} />
                <span className="px-2.5 py-1 bg-brand-50 rounded-lg font-bold text-brand-700 text-sm whitespace-nowrap">{subjectTotal(subject)} marks</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-3 text-sm">
                {isShared && (
                  <label className={`inline-flex items-center gap-1.5 rounded-full ps-2.5 pe-1 py-1 text-xs font-bold ${subject.assignee === myUid ? 'bg-brand-600 text-white' : subject.assignee ? 'bg-brand-50 text-brand-800' : 'bg-slate-100 text-slate-600'}`}>
                    <Icon name="UserRound" size={14} />
                    <select value={subject.assignee || ''} onChange={(e) => updateSubject(subject.id, s => ({ ...s, assignee: e.target.value || null }))} className="bg-transparent outline-none font-bold max-w-[9rem]" aria-label="Who writes this subject">
                      <option value="">Anyone</option>
                      {members.map(m => <option key={m.uid} value={m.uid}>{m.uid === myUid ? 'Me' : m.name}</option>)}
                    </select>
                  </label>
                )}
                {sIndex > 0 && <Toggle checked={subject.newPage} onChange={(v) => updateSubject(subject.id, s => ({ ...s, newPage: v }))}>New page</Toggle>}
                <div className="flex gap-1.5 ms-auto">
                  <button type="button" aria-label="Move subject up" disabled={sIndex === 0} onClick={() => moveSubject(sIndex, -1)} className="w-9 h-9 rounded-lg bg-slate-50 disabled:opacity-25 flex items-center justify-center"><Icon name="ChevronUp" size={18} /></button>
                  <button type="button" aria-label="Move subject down" disabled={sIndex === subjects.length - 1} onClick={() => moveSubject(sIndex, 1)} className="w-9 h-9 rounded-lg bg-slate-50 disabled:opacity-25 flex items-center justify-center"><Icon name="ChevronDown" size={18} /></button>
                  <button type="button" aria-label="Delete subject" onClick={() => { if (window.confirm(`Delete subject "${subject.title}" and all its questions?`)) setSubjects(subjects.filter(s => s.id !== subject.id)); }} className="w-9 h-9 rounded-lg text-red-500 border border-red-100 flex items-center justify-center"><Icon name="Trash2" size={18} /></button>
                </div>
              </div>

              {qs.map((q, qIndex) => (
                <QuestionCard key={q.id} q={q} num={nums[qIndex]} layout={layout} open={activeId === q.id} isFirst={qIndex === 0} isLast={qIndex === qs.length - 1}
                  onOpen={() => toggle(q.id)}
                  onChange={(nq) => setQuestions(subject.id, list => list.map(x => (x.id === q.id ? nq : x)))}
                  onRemove={() => { if (window.confirm('Delete this question?')) setQuestions(subject.id, list => list.filter(x => x.id !== q.id)); }}
                  onMove={(d) => { setQuestions(subject.id, list => { const a = [...list]; [a[qIndex], a[qIndex + d]] = [a[qIndex + d], a[qIndex]]; return a; }); scrollToCard(q.id); }}
                  onDuplicate={() => {
                    const copy = cloneWithNewIds(q);
                    setQuestions(subject.id, list => { const a = [...list]; a.splice(qIndex + 1, 0, copy); return a; });
                    setActiveId(copy.id); scrollToCard(copy.id);
                  }}
                  onSaveTemplate={() => {
                    const name = window.prompt('Name this template (e.g. "Word meanings — 8 words")', (q.text || '').slice(0, 40));
                    if (name && name.trim()) onSaveTemplate({ kind: 'question', name: name.trim(), language: layout.language, data: q });
                  }}
                />
              ))}
              <button type="button" onClick={() => setPickerFor(subject.id)} className="w-full border-2 border-dashed border-brand-200 text-brand-700 rounded-2xl py-3.5 font-bold text-base hover:bg-brand-50 active:bg-brand-100 inline-flex items-center justify-center gap-2"><Icon name="Plus" size={20} />Add question</button>
            </div>
          );
        })}
        <button type="button" onClick={() => setSubjects([...subjects, { id: uid(), title: layout.language === 'en' ? 'New Subject' : 'موضوع', questions: [] }])} className="w-full bg-white border-2 border-dashed border-slate-300 text-slate-700 py-3.5 rounded-2xl font-bold text-base inline-flex items-center justify-center gap-2"><Icon name="Plus" size={20} />Add another subject</button>

        {/* Jump-to list: quick navigation in long papers */}
        {!activeId && !hideJump && <button type="button" onClick={() => setOutlineOpen(true)} className="fixed end-4 bottom-24 sm:bottom-8 z-30 bg-white border border-slate-200 shadow-lg rounded-full ps-4 pe-5 h-12 font-bold text-slate-700 inline-flex items-center gap-2 print:hidden"><Icon name="ListTree" size={18} />Jump to</button>}
        {outlineOpen && (
          <Sheet title="Jump to" onClose={() => setOutlineOpen(false)}>
            <button type="button" onClick={() => { setOutlineOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-50 font-bold text-slate-600 inline-flex items-center gap-2"><Icon name="ChevronUp" size={18} />Paper details & style</button>
            {subjects.map(s => (
              <div key={s.id} className="mt-2">
                <button type="button" onClick={() => { setOutlineOpen(false); document.getElementById(`subject-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }); }} className={`w-full text-start px-3 py-2 ${L.fontClass} text-xl font-bold text-brand-700`} dir={L.dir}>{s.title}</button>
                {(s.questions || []).map((q, i) => (
                  <button key={q.id} type="button" onClick={() => { setOutlineOpen(false); setActiveId(q.id); scrollToCard(q.id); }} className="w-full flex gap-3 items-center px-3 py-2.5 rounded-xl hover:bg-slate-50 text-start" dir={L.dir}>
                    <span className={`${L.fontClass} text-lg text-slate-500 w-10`}>{shortLabel(questionNumbers(s.questions)[i], layout)}</span>
                    <span className={`${L.fontClass} text-lg truncate`}>{summarize(q)}</span>
                  </button>
                ))}
              </div>
            ))}
          </Sheet>
        )}

        {pickerFor && (
          <TypePicker language={layout.language || 'lsd'} templates={templates} onDeleteTemplate={onDeleteTemplate} onClose={() => setPickerFor(null)}
            onPick={(type) => insert(newQuestion(type, layout.language))}
            onTemplate={(t) => insert(cloneWithNewIds(t.data))} />
        )}
      </div>
    </EditorContext.Provider>
  );
}
