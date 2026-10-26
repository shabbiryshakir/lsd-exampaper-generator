import { DARAJAH_OPTIONS, TIME_OPTIONS, abjad, toArabicNumerals, uid, newQuestion, newPart, partsMarks, questionMarks, subjectMarks, splitAnswers } from '../lib/paperModel'

const TYPE_LABEL = { subjective: 'Written answer', fillBlanks: 'Fill in the blanks', match: 'Match' }

const Stepper = ({ value, onChange, width = 'w-24' }) => (
  <div className={`flex border border-gray-300 rounded-md overflow-hidden bg-white ${width}`}>
    <button type="button" onClick={() => onChange(Math.max(0, (parseInt(value) || 0) - 1))} className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-r border-gray-300">-</button>
    <input type="number" value={value || 0} onChange={(e) => onChange(e.target.value)} className="w-full text-center p-1.5 font-sans text-sm outline-none" />
    <button type="button" onClick={() => onChange((parseInt(value) || 0) + 1)} className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-l border-gray-300">+</button>
  </div>
)

export default function Editor({ paperData, setHeaderData, subjects, setSubjects }) {
  const handleInputChange = (e) => setHeaderData({ ...paperData, [e.target.name]: e.target.value })

  // --- immutable update helpers -------------------------------------------------
  const mapSubject = (sid, fn) => setSubjects(subjects.map((s) => (s.id === sid ? fn(s) : s)))
  const mapQuestion = (sid, qid, fn) => mapSubject(sid, (s) => ({ ...s, questions: s.questions.map((q) => (q.id === qid ? fn(q) : q)) }))
  const mapPart = (sid, qid, pid, fn) => mapQuestion(sid, qid, (q) => ({ ...q, parts: q.parts.map((p) => (p.id === pid ? fn(p) : p)) }))
  const patchPart = (sid, qid, pid, patch) => mapPart(sid, qid, pid, (p) => ({ ...p, ...patch }))
  const mapBlank = (sid, qid, pid, bid, patch) => mapPart(sid, qid, pid, (p) => ({ ...p, blanks: p.blanks.map((b) => (b.id === bid ? { ...b, ...patch } : b)) }))

  const addSubject = () => setSubjects([...subjects, { id: uid(), title: 'New Subject', questions: [] }])
  const moveItem = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return arr; const c = [...arr];[c[i], c[j]] = [c[j], c[i]]; return c }

  const insertAtCursor = (id, symbol, current, apply) => {
    const el = document.getElementById(id)
    const pos = el && el.selectionStart != null ? el.selectionStart : (current || '').length
    const end = el && el.selectionEnd != null ? el.selectionEnd : pos
    const next = (current || '').slice(0, pos) + symbol + (current || '').slice(end)
    apply(next)
    if (el) setTimeout(() => { el.focus(); el.setSelectionRange(pos + symbol.length, pos + symbol.length) }, 0)
  }

  const renderPart = (subject, q, part, pIndex) => {
    const sid = subject.id
    const labelled = q.parts.length > 1
    return (
      <div key={part.id} className="bg-white p-3 mb-3 rounded-md border border-gray-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {labelled && <span className="font-bold text-lg font-arabic text-indigo-600 border border-indigo-200 rounded px-2 bg-indigo-50">{abjad(pIndex)})</span>}
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{TYPE_LABEL[part.type]}</span>
          <div className="flex-grow" />
          {labelled && (
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-bold text-gray-500">Marks</span>
              <Stepper width="w-24" value={part.marks} onChange={(v) => patchPart(sid, q.id, part.id, { marks: v })} />
            </div>
          )}
          {labelled && <>
            <button type="button" title="Move up" onClick={() => mapQuestion(sid, q.id, (qq) => ({ ...qq, parts: moveItem(qq.parts, pIndex, -1) }))} className="text-gray-400 hover:text-gray-700 px-1">↑</button>
            <button type="button" title="Move down" onClick={() => mapQuestion(sid, q.id, (qq) => ({ ...qq, parts: moveItem(qq.parts, pIndex, 1) }))} className="text-gray-400 hover:text-gray-700 px-1">↓</button>
            <button type="button" onClick={() => mapQuestion(sid, q.id, (qq) => ({ ...qq, parts: qq.parts.filter((p) => p.id !== part.id) }))} className="text-red-500 text-xs font-medium hover:underline">Drop</button>
          </>}
        </div>

        {part.type === 'subjective' && (
          <div className="flex flex-col md:flex-row gap-3 items-start">
            <textarea value={part.text || ''} onChange={(e) => patchPart(sid, q.id, part.id, { text: e.target.value })} className="w-full md:w-3/4 border border-gray-300 p-2 rounded-md min-h-[50px] font-arabic text-lg" dir="rtl" placeholder="..." />
            <div className="w-full md:w-1/4">
              <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase">Answer lines</label>
              <Stepper width="w-28" value={part.lines} onChange={(v) => patchPart(sid, q.id, part.id, { lines: v })} />
            </div>
          </div>
        )}

        {part.type === 'fillBlanks' && (
          <div>
            {labelled && (
              <input type="text" value={part.text || ''} onChange={(e) => patchPart(sid, q.id, part.id, { text: e.target.value })} placeholder="Instruction for this part (optional)" className="w-full border border-gray-300 p-1.5 rounded-md font-arabic text-lg mb-3" dir="rtl" />
            )}
            <p className="text-xs text-blue-600 mb-2 font-medium">
              ℹ️ Use <b>*</b> for a blank. <b>**</b> makes a wider blank (two words). Several blanks in one line: separate their answers with <b>|</b>.
            </p>
            <div className="flex flex-wrap gap-4 mb-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={!!part.ayat} onChange={(e) => patchPart(sid, q.id, part.id, { ayat: e.target.checked })} /> Quran ayat style (large text + ayah number)
              </label>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={part.showWordBank !== false} onChange={(e) => patchPart(sid, q.id, part.id, { showWordBank: e.target.checked })} /> Word bank at the top
              </label>
            </div>
            <div className="space-y-2">
              {part.blanks.map((blank, bIndex) => {
                const inputId = `blank-${blank.id}`
                const nBlanks = (blank.text.match(/\*+/g) || []).length
                const nAnswers = splitAnswers(blank.answer).filter(Boolean).length
                return (
                  <div key={blank.id} className="bg-gray-50 p-2 border border-gray-200 rounded-md">
                    <div className="flex gap-2 items-center flex-wrap sm:flex-nowrap">
                      <span className="font-bold font-arabic text-gray-400 text-xl w-6">{toArabicNumerals(bIndex + 1)}.</span>
                      <input id={inputId} type="text" value={blank.text || ''} onChange={(e) => mapBlank(sid, q.id, part.id, blank.id, { text: e.target.value })} placeholder="وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *" className="flex-grow border border-gray-300 p-1.5 rounded-md font-arabic text-lg" dir="rtl" />
                      <button type="button" title="Insert a blank at the cursor" onClick={() => insertAtCursor(inputId, ' * ', blank.text, (t) => mapBlank(sid, q.id, part.id, blank.id, { text: t }))} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded px-2 py-1.5 whitespace-nowrap">+ blank</button>
                      <button type="button" title="Insert a wide blank (two words)" onClick={() => insertAtCursor(inputId, ' ** ', blank.text, (t) => mapBlank(sid, q.id, part.id, blank.id, { text: t }))} className="text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded px-2 py-1.5 whitespace-nowrap">+ wide</button>
                      <button type="button" onClick={() => mapPart(sid, q.id, part.id, (p) => ({ ...p, blanks: p.blanks.filter((b) => b.id !== blank.id) }))} className="text-red-400 font-bold text-lg hover:text-red-600 px-1">×</button>
                    </div>
                    <div className="flex gap-2 items-center mt-2 flex-wrap sm:flex-nowrap">
                      <input type="text" value={blank.answer || ''} onChange={(e) => mapBlank(sid, q.id, part.id, blank.id, { answer: e.target.value })} placeholder="Answer(s) — word | word | word" className="flex-grow border border-green-300 bg-green-50 p-1.5 rounded-md font-arabic text-lg" dir="rtl" />
                      {part.ayat && <input type="number" value={blank.ayah ?? ''} onChange={(e) => mapBlank(sid, q.id, part.id, blank.id, { ayah: e.target.value })} placeholder="Ayah #" className="w-24 border border-gray-300 p-1.5 rounded-md text-sm font-sans" />}
                    </div>
                    {nBlanks > 0 && nAnswers > 0 && nAnswers !== nBlanks && (
                      <p className="text-[11px] text-amber-600 mt-1">⚠️ {nBlanks} blank(s) but {nAnswers} answer(s) — separate answers with | (one per blank).</p>
                    )}
                  </div>
                )
              })}
            </div>
            <button type="button" onClick={() => mapPart(sid, q.id, part.id, (p) => ({ ...p, blanks: [...p.blanks, { id: uid(), text: '', answer: '', ayah: part.ayat && p_lastAyah(part) ? p_lastAyah(part) + 1 : '' }] }))} className="mt-3 text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-md font-bold border border-purple-200 hover:bg-purple-100">+ Add Line</button>
          </div>
        )}

        {part.type === 'match' && (
          <div>
            {labelled && (
              <input type="text" value={part.text || ''} onChange={(e) => patchPart(sid, q.id, part.id, { text: e.target.value })} placeholder="Instruction for this part (optional)" className="w-full border border-gray-300 p-1.5 rounded-md font-arabic text-lg mb-3" dir="rtl" />
            )}
            <p className="text-xs text-blue-600 mb-2 font-medium">ℹ️ Type the correct pairs. The left column is jumbled automatically on paper.</p>
            <div className="space-y-2">
              {part.pairs.map((pair, i) => (
                <div key={i} className="flex gap-2 items-center bg-gray-50 p-2 border border-gray-200 rounded-md">
                  <span className="font-bold font-sans text-gray-400 text-xs w-5">{i + 1}.</span>
                  <input type="text" value={pair.right || ''} onChange={(e) => mapPart(sid, q.id, part.id, (p) => ({ ...p, pairs: p.pairs.map((x, k) => (k === i ? { ...x, right: e.target.value } : x)) }))} placeholder="Right..." className="flex-1 min-w-0 border border-gray-300 p-1.5 rounded-md font-arabic text-lg" dir="rtl" />
                  <span className="font-bold text-gray-300 text-sm">=</span>
                  <input type="text" value={pair.left || ''} onChange={(e) => mapPart(sid, q.id, part.id, (p) => ({ ...p, pairs: p.pairs.map((x, k) => (k === i ? { ...x, left: e.target.value } : x)) }))} placeholder="Left..." className="flex-1 min-w-0 border border-gray-300 p-1.5 rounded-md font-arabic text-lg" dir="rtl" />
                  <button type="button" onClick={() => mapPart(sid, q.id, part.id, (p) => ({ ...p, pairs: p.pairs.filter((_, k) => k !== i) }))} className="text-red-400 font-bold text-lg hover:text-red-600 px-1">×</button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => mapPart(sid, q.id, part.id, (p) => ({ ...p, pairs: [...p.pairs, { right: '', left: '' }] }))} className="mt-3 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md font-bold border border-blue-200 hover:bg-blue-100">+ Pair</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 print:hidden flex-grow">
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md shadow-sm flex items-start">
        <span className="text-blue-500 text-xl mr-3">💾</span>
        <div>
          <p className="text-sm text-blue-800 font-bold">Save Your Work Frequently!</p>
          <p className="text-xs text-blue-600 mt-1">Please remember to click the Save button above. Any unsaved progress will be lost if you refresh, close the tab, or return to the dashboard.</p>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Paper Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-1 font-bold text-xs text-gray-600">Class (Darajah)</label>
            <select name="className" value={paperData.className || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl">
              {DARAJAH_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-1 font-bold text-xs text-gray-600">Exam Name (Arabic)</label>
            <input type="text" name="examName" value={paperData.examName || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl" />
          </div>
          <div className="col-span-2 md:col-span-1">
            <label className="block mb-1 font-bold text-xs text-gray-600">Hijri Year</label>
            <input type="number" name="hijriYear" value={paperData.hijriYear || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-sans text-lg" dir="ltr" />
          </div>
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-600">Paper No.</label>
            <input type="text" name="paperNumber" value={paperData.paperNumber || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-sans text-sm" />
          </div>
          <div>
            <label className="block mb-1 font-bold text-xs text-gray-600">Duration</label>
            <select name="time" value={paperData.time || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-sans text-sm">
              {TIME_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          </div>
        </div>
        <label className="flex items-center gap-2 mt-4 text-xs font-bold text-gray-700 cursor-pointer">
          <input type="checkbox" checked={paperData.coverMode !== 'separate'} onChange={(e) => setHeaderData({ ...paperData, coverMode: e.target.checked ? 'compact' : 'separate' })} />
          Start questions on the first page, right under the marks table (no wasted space)
        </label>
      </div>

      {subjects.map((subject, sIndex) => (
        <div key={subject.id} className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-4 gap-3">
            <div className="w-full md:w-1/2">
              <label className="block mb-1 font-bold text-xs text-indigo-800">Subject Name (الموضوع)</label>
              <input type="text" value={subject.title || ''} onChange={(e) => mapSubject(subject.id, (s) => ({ ...s, title: e.target.value }))} className="w-full border border-indigo-200 p-2 rounded-md text-xl font-bold font-arabic focus:border-indigo-400 focus:outline-none" dir="rtl" />
            </div>
            <div className="flex items-center gap-3 self-end md:self-auto">
              <div className="text-center px-3 py-1.5 bg-indigo-50 rounded-md font-bold text-indigo-700 font-sans text-sm border border-indigo-100">Total: {subjectMarks(subject)}</div>
              <button type="button" disabled={subjects.length < 2} onClick={() => { if (window.confirm('Delete this subject and all its questions?')) setSubjects(subjects.filter((s) => s.id !== subject.id)) }} className="text-red-500 hover:text-red-700 text-xs font-bold bg-white px-2 py-1.5 rounded-md border border-red-200 shadow-sm disabled:opacity-40">Delete Subject</button>
            </div>
          </div>

          {subject.questions.map((q, qIndex) => {
            const autoMarks = partsMarks(q) > 0
            return (
              <div key={q.id} className="bg-gray-50 p-4 mb-4 rounded-lg border border-gray-200 relative">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-700 font-arabic text-lg">س{toArabicNumerals(qIndex + 1)}</h3>
                  <div className="flex items-center gap-2">
                    <button type="button" title="Move up" onClick={() => mapSubject(subject.id, (s) => ({ ...s, questions: moveItem(s.questions, qIndex, -1) }))} className="text-gray-400 hover:text-gray-700 px-1">↑</button>
                    <button type="button" title="Move down" onClick={() => mapSubject(subject.id, (s) => ({ ...s, questions: moveItem(s.questions, qIndex, 1) }))} className="text-gray-400 hover:text-gray-700 px-1">↓</button>
                    <button type="button" onClick={() => mapSubject(subject.id, (s) => ({ ...s, questions: s.questions.filter((x) => x.id !== q.id) }))} className="text-gray-400 hover:text-red-500 text-xs font-bold">✕ Remove</button>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-3 mb-3">
                  <div className="w-full md:w-3/4">
                    <label className="block mb-1 text-xs font-bold text-gray-600">Main Instruction</label>
                    <input type="text" value={q.text || ''} onChange={(e) => mapQuestion(subject.id, q.id, (x) => ({ ...x, text: e.target.value }))} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl" />
                  </div>
                  <div className="w-full md:w-1/4">
                    <label className="block mb-1 text-xs font-bold text-gray-600">Marks {autoMarks && <span className="text-green-600 font-normal">(sum of parts)</span>}</label>
                    {autoMarks
                      ? <div className="w-24 border border-gray-200 bg-gray-100 rounded-md text-center p-1.5 font-sans text-sm font-bold">{questionMarks(q)}</div>
                      : <Stepper value={q.marks} onChange={(v) => mapQuestion(subject.id, q.id, (x) => ({ ...x, marks: v }))} />}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3">
                  {q.parts.length > 1 && <p className="text-xs text-blue-600 mb-3 font-medium">ℹ️ Sub-questions are labelled الف، ب، ج … on the paper. Give each one its own marks — the main question total is calculated for you.</p>}
                  {q.parts.map((part, pIndex) => renderPart(subject, q, part, pIndex))}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[11px] font-bold text-gray-500 uppercase">+ Sub-question:</span>
                    {['subjective', 'fillBlanks', 'match'].map((t) => (
                      <button key={t} type="button" onClick={() => mapQuestion(subject.id, q.id, (x) => ({ ...x, parts: [...x.parts, newPart(t)] }))} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-md font-bold border border-green-200 hover:bg-green-100">{TYPE_LABEL[t]}</button>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
          <div className="mt-2 flex flex-wrap gap-2">
            {[['subjective', '+ Subjective'], ['fillBlanks', '+ Blanks'], ['match', '+ Match']].map(([t, label]) => (
              <button key={t} type="button" onClick={() => mapSubject(subject.id, (s) => ({ ...s, questions: [...s.questions, newQuestion(t)] }))} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 font-bold text-xs shadow-sm">{label}</button>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={addSubject} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 p-3 rounded-xl hover:bg-indigo-100 transition font-bold text-sm shadow-sm mb-4">+ Add Subject Section</button>
    </div>
  )
}

const p_lastAyah = (part) => {
  const last = [...part.blanks].reverse().find((b) => b.ayah !== '' && b.ayah != null)
  return last ? parseInt(last.ayah) || 0 : 0
}
