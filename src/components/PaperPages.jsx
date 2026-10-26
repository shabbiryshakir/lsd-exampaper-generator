import { toArabicNumerals, abjad, questionMarks, subjectMarks, paperMarks, resolveBlanks, wordBankFor } from '../lib/paperModel'
import { generatePages, groupPageItems, coverHeightFor } from '../lib/paginate'

const Marks = ({ value, className = '' }) => (
  <span className={`marks-badge font-arabic ${className}`}>({toArabicNumerals(value)})</span>
)

const Blank = ({ size, answer, showAnswers }) => (
  <span className="blank" style={{ width: `${size * 5.6}rem` }}>
    {showAnswers && answer ? <span className="blank-answer">{answer}</span> : null}
  </span>
)

// One sentence / ayah: words and blanks laid out right-to-left, one isolated box per token so the
// bidi algorithm can never reorder a blank next to the wrong word. The ayah marker sits at the end.
const BlankLine = ({ blank, ayat, index, showAnswers }) => {
  const tokens = resolveBlanks(blank)
  return (
    <div className={`blank-line ${ayat ? 'ayat' : ''}`} dir="rtl">
      {!ayat && <span className="blank-no font-arabic">{toArabicNumerals(index + 1)}.</span>}
      {tokens.map((t, i) => t.kind === 'blank'
        ? <Blank key={i} size={t.size} answer={t.answer} showAnswers={showAnswers} />
        : <span key={i} className="blank-word font-arabic">{t.text}</span>)}
      {ayat && blank.ayah !== '' && blank.ayah != null && <span className="ayah-no font-arabic">{toArabicNumerals(blank.ayah)}</span>}
    </div>
  )
}

const CoverHeader = ({ paperData, school, subjects, showAnswers }) => {
  const subjectNames = subjects.length === 1 ? subjects[0].title : ''
  return (
    <div className="cover-box" dir="rtl">
      <div className="text-center text-sm font-sans leading-none mb-1">۷۸٦</div>
      <div className="relative flex items-center justify-center min-h-[84px]">
        {school?.logo && <img src={school.logo} alt="" className="absolute right-0 top-0 h-[84px] object-contain" />}
        <div className="text-center px-24">
          <div className="font-arabic text-3xl font-bold leading-snug">{school?.nameAr}</div>
          <div className="font-arabic text-2xl mt-1">{paperData.examName} {toArabicNumerals(paperData.hijriYear)}هـ</div>
        </div>
        <div className="absolute left-0 top-0 text-left">
          <div className="border-2 border-black px-3 py-1 font-sans font-bold text-lg inline-block">{paperData.paperNumber}</div>
          <div className="font-sans text-xs mt-1" dir="ltr">Time: {paperData.time}</div>
          {showAnswers && <div className="font-sans text-xs font-bold mt-1 text-red-700" dir="ltr">ANSWER KEY</div>}
        </div>
      </div>
      <div className="flex justify-between font-arabic text-xl mt-3">
        <span>الدرجة : {paperData.className}</span>
        <span>موضوع: {subjectNames}</span>
        <span>مارکس: {toArabicNumerals(paperMarks(subjects))}</span>
      </div>
      <div className="flex items-end gap-3 font-arabic text-xl mt-3">
        <span>الاسم:</span><span className="flex-grow border-b border-black h-5" />
        <span>رول نمبر:</span><span className="w-28 border-b border-black h-5" />
        <span>تاريخ:</span><span className="w-28 border-b border-black h-5" />
      </div>
    </div>
  )
}

const SummaryTable = ({ subjects }) => (
  <table className="summary-table font-arabic text-lg" dir="rtl">
    <thead><tr><th className="w-14">رقم</th><th>المواضيع</th><th className="w-24">ماركس</th><th className="w-32">المحصول</th></tr></thead>
    <tbody>
      {subjects.map((s, i) => (
        <tr key={s.id}><td>{toArabicNumerals(i + 1)}</td><td className="text-right pr-4">{s.title}</td><td>{toArabicNumerals(subjectMarks(s))}</td><td /></tr>
      ))}
      <tr className="bg-gray-100"><td colSpan="2">جملة</td><td>{toArabicNumerals(paperMarks(subjects))}</td><td /></tr>
    </tbody>
  </table>
)

const Item = ({ item, showAnswers }) => {
  const { type } = item
  if (type === 'subjectHeader') {
    return (
      <div className="subject-bar font-arabic">
        <span>{item.sub.title}</span>
        <span className="subject-marks">{toArabicNumerals(subjectMarks(item.sub))}</span>
      </div>
    )
  }
  if (type === 'questionHeader') {
    const { q, qIndex } = item
    return (
      <div className="flex justify-between items-start mb-2 mt-3 font-arabic">
        <p className="q-text font-bold text-xl leading-relaxed">
          <span>س{toArabicNumerals(qIndex + 1)} : </span>
          <span className="underline underline-offset-4">{q.text}</span>
        </p>
        <Marks value={questionMarks(q)} className="text-xl font-bold" />
      </div>
    )
  }
  if (type === 'partHeader') {
    const { p, pIndex, labelled } = item
    return (
      <div className="flex justify-between items-start mb-1 px-3 font-arabic">
        <p className="font-bold text-xl leading-relaxed">
          {labelled && <span className="ml-2">{abjad(pIndex)})</span>}
          <span>{p.text}</span>
        </p>
        {labelled && (parseInt(p.marks) || 0) > 0 && <Marks value={p.marks} className="text-lg" />}
      </div>
    )
  }
  if (type === 'lines') {
    return (
      <div className="px-3 mb-3">
        {[...Array(item.count)].map((_, j) => <div key={j} className="border-b-2 border-dotted border-gray-500 h-[34px]" />)}
      </div>
    )
  }
  if (type === 'wordBank') {
    return (
      <div className="mb-3 px-3 font-arabic">
        <div className="border-2 border-black p-2 flex flex-wrap gap-x-6 gap-y-1 justify-center text-xl rounded bg-gray-50">
          {wordBankFor(item.p).map((w, i) => <span key={i} className="px-2">{w}</span>)}
        </div>
      </div>
    )
  }
  if (type === 'blankItem') {
    return <div className="px-3"><BlankLine blank={item.blank} ayat={item.p.ayat} index={item.bIndex} showAnswers={showAnswers} /></div>
  }
  if (type === 'pairs') {
    const all = item.p.pairs || []
    const n = all.length
    return (
      <div className="mb-3 px-2 font-arabic">
        <table className="w-full border-collapse border border-black text-lg">
          <tbody>
            {item.rows.map((r) => {
              const j = (r + 1) % n // jumbled position of the left-hand item
              const correctLabel = abjad((r - 1 + n) % n)
              return (
                <tr key={r}>
                  <td className="border border-black p-1.5 text-right pr-3 w-5/12"><span className="ml-2 font-bold">{toArabicNumerals(r + 1)}.</span>{all[r].right}</td>
                  <td className="border border-black p-1.5 text-center w-2/12 font-bold">[ {showAnswers ? correctLabel : <>&nbsp;&nbsp;&nbsp;</>} ]</td>
                  <td className="border border-black p-1.5 text-right pr-3 w-5/12"><span className="ml-2 font-bold">{abjad(r)})</span>{all[j]?.left}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }
  return null
}

export default function PaperPages({ paperData, subjects, school, showAnswers = false }) {
  const compact = paperData.coverMode !== 'separate'
  const pages = generatePages(subjects, { coverHeight: compact ? coverHeightFor(subjects.length) : 0 })
  // "separate": cover page stands alone, questions start on page 2
  const sheets = compact ? pages : [[], ...pages]

  return (
    <div className="print:m-0 print:w-full">
      {sheets.map((items, pageIndex) => (
        <div key={pageIndex} className="a4-wrapper print:block">
          <div className="a4-sheet text-xl" dir="rtl">
            <div className="page-frame" />
            {pageIndex === 0 ? (
              <>
                <CoverHeader paperData={paperData} school={school} subjects={subjects} showAnswers={showAnswers} />
                <SummaryTable subjects={subjects} />
              </>
            ) : (
              <div className="page-head font-arabic">
                <span>{paperData.className}</span>
                <span>{paperData.examName} {toArabicNumerals(paperData.hijriYear)}هـ</span>
                <span className="w-24" />
              </div>
            )}
            <div className="flex-grow pt-3">
              {groupPageItems(items).map((item, idx) => <Item key={idx} item={item} showAnswers={showAnswers} />)}
            </div>
            <div className="page-no font-arabic">{toArabicNumerals(pageIndex + 1)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
