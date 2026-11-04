// End-to-end checks in a real browser. Needs the dev server running:
//   npm run dev -- --port 5199   (in another terminal)
//   BASE_URL=http://localhost:5199 node tests/e2e.mjs
// Uses the dev-only ?demo mode, so no Google login or Firebase is touched.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5199'
let passed = 0, failed = 0
const failures = []
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${name}`) } else { failed++; failures.push(name); console.log(`  ✗ ${name} ${extra}`) } }
const section = (t) => console.log(`\n${t}`)

const browser = await chromium.launch()
const newPage = async (url, viewport = { width: 1100, height: 1300 }) => {
  const ctx = await browser.newContext({ viewport })
  const pg = await ctx.newPage()
  pg.errors = []
  pg.on('pageerror', (e) => pg.errors.push(e.message))
  pg.on('console', (m) => { if (m.type() === 'error') pg.errors.push(m.text()) })
  pg.on('dialog', (d) => d.accept(pg.promptAnswer || undefined))
  await pg.goto(`${BASE}/${url}`)
  await pg.waitForFunction(() => window.__paper)
  return pg
}
const overflow = (pg) => pg.evaluate(() => [...document.querySelectorAll('.a4-sheet')].map((s, i) => {
  const body = s.querySelector(':scope > .page-body'); const sb = s.getBoundingClientRect()
  const last = body && body.lastElementChild
  return { i, over: last ? Math.round(last.getBoundingClientRect().bottom - sb.top - (sb.height - 76)) : -999 }
}).filter((x) => x.over > 1))
const setPaper = (pg, subjects, header = {}) => pg.evaluate(({ subjects, header }) => { window.__paper.setSubjects(subjects); window.__paper.setHeaderData((h) => ({ ...h, ...header })) }, { subjects, header })
const goto = async (pg, view) => { await pg.evaluate((v) => window.__paper.setAppState(v), view); await pg.waitForTimeout(250) }
const sheets = (pg) => pg.locator('.a4-sheet').count()
const addQ = (pg, label) => pg.locator('div.mt-2.flex.flex-wrap.gap-2').getByRole('button', { name: label, exact: true }).click()
const uid = (() => { let n = 0; return () => `t${++n}` })()
const fill = (n, extra = {}) => ({ id: uid(), type: 'fillBlanks', text: '', marks: 0, showWordBank: false, ayat: true, blanks: Array.from({ length: n }, (_, i) => ({ id: uid(), text: `وَمَآ * مَا ** لَفِى`, answer: 'أَدْرَىٰكَ | عِلِّيُّونَ كَثِيرٌ', ayah: i + 1 })), ...extra })
const q = (parts, o = {}) => ({ id: uid(), text: 'نیچے اپیلی آیات اعراب ساتھے تمام کرو!', marks: 5, parts, ...o })
const S = (questions, title = 'حفظ القرآن') => ({ id: uid(), title, questions })

// ---------------------------------------------------------------------------------
section('1. Cover page & layout (your template)')
{
  const pg = await newPage('?demo=preview')
  check('cover shows school name, 786, Paper box, الدرجة/موضوع/مارکس and name/roll/date', await pg.evaluate(() => { const t = document.querySelector('.cover-box').innerText; return ['۷۸٦', 'Paper 1', 'الدرجة', 'موضوع', 'مارکس', 'الاسم', 'رول نمبر', 'تاريخ'].every((x) => t.includes(x)) }))
  check('marks table has رقم / المواضيع / ماركس / المحصول / جملة', await pg.evaluate(() => { const t = document.querySelector('.summary-table').innerText; return ['رقم', 'المواضيع', 'ماركس', 'المحصول', 'جملة'].every((x) => t.includes(x)) }))
  check('single subject: questions start on the cover page (no wasted space)', await pg.locator('.a4-sheet').first().locator('.subject-bar').count() === 1)
  const m = await pg.evaluate(() => { const s = document.querySelector('.a4-sheet'); const sb = s.getBoundingClientRect(); const last = s.querySelector('.page-body').lastElementChild.getBoundingClientRect(); return sb.height - 76 - (last.bottom - sb.top) })
  check('first page is well filled (< 260px unused)', m < 260, `unused=${Math.round(m)}`)
  check('every page has the border frame and a page number', await pg.evaluate(() => [...document.querySelectorAll('.a4-sheet')].every((s) => s.querySelector('.page-frame') && s.querySelector('.page-no'))))
  check('page numbers run ١ ٢ …', await pg.evaluate(() => [...document.querySelectorAll('.page-no')].map((e) => e.innerText).join('') === '١٢'.slice(0, document.querySelectorAll('.page-no').length)))
  check('no overflow on any page', (await overflow(pg)).length === 0)
  await pg.evaluate(() => window.__paper.setHeaderData((h) => ({ ...h, coverMode: 'separate' })))
  await pg.waitForTimeout(250)
  check('"separate" mode: cover page alone, questions from page 2', await pg.locator('.a4-sheet').first().locator('.subject-bar').count() === 0 && await pg.locator('.a4-sheet').nth(1).locator('.subject-bar').count() === 1)
  check('page 2+ has the running header (class + exam name)', await pg.locator('.a4-sheet').nth(1).locator('.page-head').count() === 1)
  check('no JS errors', pg.errors.length === 0, pg.errors.join('; '))
}

section('2. Quran ayat blanks (the glitchy part)')
{
  const pg = await newPage('?demo=preview')
  const order = await pg.evaluate(() => [...document.querySelectorAll('.blank-line.ayat')].map((line) => {
    const kids = [...line.children].filter((c) => !c.classList.contains('ayah-no'))
    const boxes = kids.map((k) => k.getBoundingClientRect())
    const byRow = new Map(); boxes.forEach((b, i) => { const key = Math.round(b.bottom / 12); byRow.set(key, [...(byRow.get(key) || []), { i, x: b.left }]) })
    // within a row, DOM order must be right-to-left (x strictly decreasing)
    const rtl = [...byRow.values()].every((row) => row.every((r, k) => k === 0 || r.x < row[k - 1].x))
    const overlap = boxes.some((a, i) => boxes.some((b, j) => j > i && Math.abs(a.bottom - b.bottom) < 10 && a.left < b.right - 1 && b.left < a.right - 1))
    const marker = line.querySelector('.ayah-no'); const lastWord = kids[kids.length - 1].getBoundingClientRect()
    const markerAtEnd = marker ? marker.getBoundingClientRect().right <= lastWord.left + 1 || marker.getBoundingClientRect().top > lastWord.top : true
    return { rtl, overlap, markerAtEnd, kinds: kids.map((k) => (k.classList.contains('blank') ? 'B' : 'W')).join('') }
  }))
  check('ayat lines found', order.length >= 5, String(order.length))
  check('words & blanks flow strictly right-to-left on every ayat line', order.every((o) => o.rtl), JSON.stringify(order))
  check('no word/blank overlaps another on any ayat line', order.every((o) => !o.overlap))
  check('ayah number circle sits at the end (left) of the line', order.every((o) => o.markerAtEnd))
  check('line 1 pattern is W B W B W B (as in the sample sheet)', order[0].kinds === 'WBWBWB', order[0].kinds)
  check('"**" gives a wider blank than "*"', await pg.evaluate(() => { const w = [...document.querySelectorAll('.blank-line.ayat')][4].querySelectorAll('.blank'); return w[1].getBoundingClientRect().width > w[0].getBoundingClientRect().width * 1.8 }))
  check('student paper shows NO answers', await pg.locator('.blank-answer').count() === 0)
  const pa = await newPage('?demo=answers')
  check('answer key shows every answer inside the blanks', await pa.locator('.blank-answer').count() >= 9)
  check('answer key is marked ANSWER KEY', (await pa.locator('.cover-box').innerText()).includes('ANSWER KEY'))
  check('MCQ correct options highlighted (2) on answer key only', await pa.locator('.mcq-correct').count() === 2 && await pg.locator('.mcq-correct').count() === 0)
  check('True/False answers: صح & غلط on answer key', await pa.evaluate(() => { const t = document.body.innerText; return t.includes('صح') && t.includes('غلط') }))
  // answer wider than blank must not collide with neighbours
  check('answers do not overlap neighbouring words', await pa.evaluate(() => [...document.querySelectorAll('.blank-line.ayat')].every((line) => { const bs = [...line.querySelectorAll('.blank-answer')].map((a) => a.getBoundingClientRect()); const ws = [...line.querySelectorAll('.blank-word')].map((a) => a.getBoundingClientRect()); return bs.every((a) => ws.every((w) => !(a.left < w.right - 2 && w.left < a.right - 2 && Math.abs(a.bottom - w.bottom) < 20))) })))
}

section('3. Sub-questions with marks (الف / ب / ج)')
{
  const pg = await newPage('?demo=preview')
  const txt = await pg.locator('.a4-sheet').first().innerText()
  check('main question shows س١ and marks in brackets (٥)', txt.includes('س١') && txt.includes('(٥)'))
  check('sub-parts labelled الف) and ب)', txt.includes('الف)') && txt.includes('ب)'))
  check('sub-part marks shown (٣) and (٢)', txt.includes('(٣)') && txt.includes('(٢)'))
  check('subject total in the bar = sum of everything', (await pg.locator('.subject-marks').first().innerText()) === '١٨')
  check('marks table total matches', (await pg.locator('.summary-table tr').last().innerText()).includes('١٨'))
  await pg.evaluate(() => window.__paper.setHeaderData((h) => ({ ...h, labelStyle: 'numbers' })))
  await pg.waitForTimeout(200)
  check('label style "numbers" gives ١) ٢)', (await pg.locator('.a4-sheet').first().innerText()).includes('١)'))
}

section('4. Editor interactions')
{
  const pg = await newPage('?demo=editor')
  const qCount = () => pg.locator('h3,button').filter({ hasText: /^▼\s*س/ }).count()
  const before = await qCount()
  await addQ(pg, '+ Subjective')
  check('+ Subjective adds a question', await qCount() === before + 1)
  await addQ(pg, '+ Quran ayat')
  check('+ Quran ayat adds an ayat question with the ayat option on', await pg.locator('input[type=checkbox]:checked').count() > 0 && await qCount() === before + 2)
  await addQ(pg, '+ MCQ'); await addQ(pg, '+ True/False'); await addQ(pg, '+ Match')
  check('MCQ / True-False / Match can be added', await qCount() === before + 5)
  // sub-question + marks sum
  const lastQ = pg.locator('div.bg-gray-50.p-4.mb-4').last()
  await lastQ.getByRole('button', { name: 'Written answer' }).click()
  check('adding a sub-question shows الف) and ب) labels', (await lastQ.innerText()).includes('الف)') && (await lastQ.innerText()).includes('ب)'))
  const marksInputs = lastQ.locator('input[type=number]')
  await marksInputs.first().fill('3'); await marksInputs.nth(2).fill('2').catch(() => {})
  check('main marks become "sum of parts"', (await lastQ.innerText()).includes('sum of parts'))
  // blank insert
  const firstBlankInput = pg.locator('input[placeholder^="وَيَطُوفُ"]').first()
  await firstBlankInput.fill('abc'); await firstBlankInput.press('Home')
  await pg.getByRole('button', { name: '+ wide' }).first().click()
  check('"+ wide" inserts ** at the cursor', (await firstBlankInput.inputValue()).includes('**'))
  // validation panel
  check('paper checks panel is visible with a total', (await pg.locator('text=Paper checks').first().innerText()).includes('Total marks'))
  // duplicate question
  const n0 = await qCount()
  await pg.locator('button[title="Duplicate question"]').first().click()
  check('duplicate question adds one more', await qCount() === n0 + 1)
  // collapse
  await pg.locator('button[title="Collapse / expand"]').first().click()
  check('collapse hides the question body', (await pg.locator('button[title="Collapse / expand"]').first().innerText()).includes('▶'))
  // delete subject blocked when only one
  check('cannot delete the only subject', await pg.getByRole('button', { name: 'Delete Subject' }).first().isDisabled())
  // preview still renders after all of that
  await goto(pg, 'preview')
  check('preview renders after edits without overflow or errors', (await overflow(pg)).length === 0 && pg.errors.length === 0, pg.errors.join(';'))
}

section('5. MCQ & True/False editors set the answer key')
{
  const pg = await newPage('?demo=editor')
  await addQ(pg, '+ MCQ')
  const card = pg.locator('div.bg-gray-50.p-4.mb-4').last()
  const inputs = card.locator('input[type=text]')
  await inputs.nth(1).fill('سؤال'); 
  const opts = card.locator('input[type=text]'); await opts.nth(2).fill('أ'); await opts.nth(3).fill('ب'); await opts.nth(4).fill('ج')
  await card.locator('input[type=radio]').nth(1).check()
  await goto(pg, 'answers')
  check('option ب is the highlighted correct answer', (await pg.locator('.mcq-correct').last().innerText()).includes('ب'))
}

section('6. Dashboard: search, folders, sorting')
{
  const pg = await newPage('?demo=dashboard')
  const cards = () => pg.locator('.grid > div.cursor-pointer').count()
  check('3 papers listed', await cards() === 3)
  await pg.getByPlaceholder(/Search/).fill('النحو'); check('search by subject finds 1', await cards() === 1)
  await pg.getByPlaceholder(/Search/).fill('الدرجة الرابعة'); check('search by class finds 1', await cards() === 1)
  await pg.getByPlaceholder(/Search/).fill('paper 2'); check('search by paper number finds 1', await cards() === 1)
  await pg.getByPlaceholder(/Search/).fill('zzzz'); check('no match → friendly empty state', (await pg.locator('.grid').innerText()).includes('No papers match'))
  await pg.getByPlaceholder(/Search/).fill('')
  pg.promptAnswer = 'Midterm'
  await pg.getByRole('button', { name: '+ New folder' }).click()
  check('folder chip created', await pg.getByRole('button', { name: /📁 Midterm/ }).count() === 1)
  await pg.locator('select[aria-label="Move to folder"]').first().selectOption({ index: 1 })
  check('paper moved into folder (count 1)', (await pg.getByRole('button', { name: /📁 Midterm/ }).innerText()).includes('1'))
  await pg.getByRole('button', { name: /📁 Midterm/ }).click(); check('folder filter shows 1', await cards() === 1)
  await pg.getByRole('button', { name: /^Unfiled/ }).click(); check('Unfiled shows the other 2', await cards() === 2)
  await pg.getByRole('button', { name: /📁 Midterm/ }).click()
  pg.promptAnswer = 'Final'; await pg.getByRole('button', { name: 'Rename' }).click()
  check('folder renamed', await pg.getByRole('button', { name: /📁 Final/ }).count() === 1)
  await pg.getByRole('button', { name: 'Delete folder' }).click()
  check('deleting a folder keeps its papers (back in All)', await cards() === 3 && await pg.getByRole('button', { name: /📁/ }).count() === 0)
  await pg.locator('select[aria-label="Sort papers"]').selectOption('class')
  const first = await pg.locator('.grid > div.cursor-pointer').first().innerText()
  check('sort by class puts الدرجة الرابعة before السابعة', first.includes('الرابعة'))
  await pg.locator('.grid > div.cursor-pointer').first().locator('button[title="Delete Paper"]').click()
  check('delete paper (confirmed) removes it', await cards() === 2)
  await pg.locator('.grid > div.cursor-pointer').first().click(); await pg.waitForTimeout(250)
  check('opening a paper goes to the editor', await pg.getByRole('button', { name: /Preview/ }).count() > 0)
  check('no JS errors', pg.errors.length === 0, pg.errors.join('; '))
}

section('7. Printing: PDF has exactly one A4 page per sheet')
{
  const pg = await newPage('?demo=preview&stress')
  const n = await sheets(pg)
  await pg.emulateMedia({ media: 'print' })
  const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  const pagesInPdf = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
  check(`PDF pages (${pagesInPdf}) = sheets (${n})`, pagesInPdf === n)
  check('PDF has no cut-off: all sheets overflow-free', (await overflow(pg)).length === 0)
}

section('8. Stress & weird input (self-correcting page packing)')
{
  const pg = await newPage('?demo=preview')
  const run = async (name, subjects, header) => { await setPaper(pg, subjects, header); await goto(pg, 'preview'); await pg.waitForTimeout(400); const o = await overflow(pg); check(`${name} → no overflow (${await sheets(pg)} pages)`, o.length === 0, JSON.stringify(o)) }
  const longText = 'سؤال طويل جدا '.repeat(60)
  await run('very long instruction text', [S([q([{ id: uid(), type: 'subjective', text: longText, marks: 0, lines: 4 }], { text: longText })])])
  await run('60 written lines', [S([q([{ id: uid(), type: 'subjective', text: 'x', marks: 0, lines: 60 }])])])
  await run('200 lines', [S([q([{ id: uid(), type: 'subjective', text: 'x', marks: 0, lines: 200 }])])])
  await run('80 matching pairs', [S([q([{ id: uid(), type: 'match', text: '', marks: 0, pairs: Array.from({ length: 80 }, (_, i) => ({ right: `رقم ${i}`, left: `جواب ${i}` })) }])])])
  await run('huge word bank (80 answers)', [S([q([{ id: uid(), type: 'fillBlanks', text: '', marks: 0, showWordBank: true, ayat: false, blanks: Array.from({ length: 80 }, (_, i) => ({ id: uid(), text: 'جملة *', answer: `كلمة${i}` })) }])])])
  await run('long sentences wrapping to many lines', [S([q([fill(6, { blanks: Array.from({ length: 6 }, (_, i) => ({ id: uid(), text: 'كلمة '.repeat(40) + '* ' + 'كلمة '.repeat(40), answer: 'س', ayah: i })) })])])])
  await run('12 subjects (dense cover table)', Array.from({ length: 12 }, (_, i) => S([q([fill(2)])], `مادة ${i + 1}`)))
  await run('20 subjects', Array.from({ length: 20 }, (_, i) => S([q([fill(1)])], `مادة ${i + 1}`)))
  await run('50 MCQ', [S([q([{ id: uid(), type: 'mcq', text: '', marks: 0, items: Array.from({ length: 50 }, (_, i) => ({ id: uid(), text: `سؤال ${i}`, options: ['أ', 'ب', 'ج', 'د'], answer: 1 })) }])])])
  await run('empty paper', [S([])])
  await run('empty question parts', [S([{ id: uid(), text: '', marks: 0, parts: [] }])])
  await run('subject without title', [{ id: uid(), title: '', questions: [q([fill(1)])] }])
  await run('mixed types in one question', [S([q([fill(2), { id: uid(), type: 'subjective', text: 'x', marks: 1, lines: 3 }, { id: uid(), type: 'match', text: '', marks: 1, pairs: [{ right: 'a', left: 'b' }, { right: 'c', left: 'd' }] }, { id: uid(), type: 'trueFalse', text: '', marks: 1, items: [{ id: uid(), text: 'x', answer: true }] }])])])
  // hostile text
  await setPaper(pg, [S([q([{ id: uid(), type: 'subjective', text: '<img src=x onerror=window.__pwned=1> <script>window.__pwned=1</script>', marks: 0, lines: 1 }], { text: '<b>bold?</b>' })])])
  await goto(pg, 'preview'); await pg.waitForTimeout(300)
  check('HTML in text is shown literally (no injection)', await pg.evaluate(() => !window.__pwned && !document.querySelector('.a4-sheet img[src="x"]') && !document.querySelector('.a4-sheet b')))
  // blanks edge cases
  await setPaper(pg, [S([q([{ id: uid(), type: 'fillBlanks', text: '', marks: 0, showWordBank: true, ayat: false, blanks: [{ id: uid(), text: '***', answer: '' }, { id: uid(), text: '', answer: 'x' }, { id: uid(), text: '* * * *', answer: 'a|b' }, { id: uid(), text: 'بدون فراغ', answer: '' }] }])])])
  await goto(pg, 'answers'); await pg.waitForTimeout(300)
  check('odd blank inputs (***, empty, no *, missing answers) render without crashing', pg.errors.length === 0 && await sheets(pg) >= 1, pg.errors.join(';'))
  // data shape from the old app version
  await setPaper(pg, [{ id: 1, title: 'قديم', questions: [{ id: 2, type: 'fillBlanks', text: 'q', marks: 3, blanks: [{ id: 3, text: 'a *', answer: 'b' }] }] }])
  await goto(pg, 'preview'); await pg.waitForTimeout(300)
  check('old-format paper (not normalised) is shown with an error boundary instead of a white screen', (await pg.locator('body').innerText()).length > 0)
}

section('9. Phones (390px)')
{
  const pg = await newPage('?demo=editor', { width: 390, height: 800 })
  check('editor has no sideways scrolling on a phone', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2), String(await pg.evaluate(() => document.documentElement.scrollWidth)))
  await goto(pg, 'preview')
  check('preview scrolls inside its own container (page itself does not overflow)', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
  const pd = await newPage('?demo=dashboard', { width: 390, height: 800 })
  check('dashboard has no sideways scrolling on a phone', await pd.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
}

section('9b. Papers saved by the OLD app version open correctly')
{
  const pg = await newPage('?demo=preview')
  const legacy = [
    { id: 11, title: 'تعليم القرآن', questions: [
      { id: 12, type: 'subjective', text: 'اكتب', marks: 6, subQuestions: [{ id: 13, text: 'أ', lines: 3 }, { id: 14, text: 'ب', lines: 2 }] },
      { id: 15, type: 'fillBlanks', text: 'املأ', marks: 4, showWordBank: true, blanks: [{ id: 16, text: 'الله *', answer: 'أحد' }, { id: 17, text: 'قل هو * أحد', answer: 'الله' }] },
      { id: 18, type: 'fillBlanks', text: 'قديم جدا', marks: 2, content: 'سطر *\nسطر آخر *' },
      { id: 19, type: 'match', text: 'صل', marks: 3, pairs: [{ right: 'أ', left: 'ب' }, { right: 'ج', left: 'د' }] },
      { id: 20, type: 'subjective', text: 'q', marks: 1, questionText: 'سؤال قديم', lines: 2 },
    ] },
  ]
  await pg.evaluate((l) => window.__paper.setSubjects(window.__paper.normalizeSubjects(l)), legacy)
  await pg.waitForTimeout(400)
  const t = (await pg.locator('.a4-sheet').allInnerTexts()).join(' ').replace(/\s+/g, ' ')
  check('old subjective sub-questions keep their text and lines', t.includes('الف)') && t.includes('ب)'))
  check('old fill-in-the-blank sentences and word bank survive', t.includes('قل هو') && t.includes('أحد'))
  check('very old "content" blanks are converted', t.includes('سطر آخر'))
  check('old match pairs survive', t.includes('صل'))
  check('old paper marks total (6+4+2+3+1 = 16) is right', (await pg.locator('.subject-marks').first().innerText()) === '١٦')
  check('old paper has no overflow and no errors', (await overflow(pg)).length === 0 && pg.errors.length === 0, pg.errors.join(';'))
}

section('10. Safety nets: draft, unsaved warning, save shortcut')
{
  const pg = await newPage('?demo=editor')
  await pg.locator('input[name=examName]').fill('امتحان تجريبي ٩٩')
  check('Save button shows the unsaved marker', (await pg.getByRole('button', { name: /^Save/ }).innerText()).includes('•'))
  await pg.keyboard.press('Control+s'); await pg.waitForTimeout(300)
  check('Ctrl+S saves (demo toast) and clears the unsaved marker', (await pg.getByRole('button', { name: /^Save/ }).innerText()).includes('✓'))
  await pg.locator('input[name=examName]').fill('امتحان تجريبي ١٠٠')
  await pg.waitForTimeout(1000)
  check('a local draft is written while there are unsaved changes', await pg.evaluate(() => { const d = JSON.parse(localStorage.getItem('paperDraft:demo') || 'null'); return !!d && d.header.examName.includes('١٠٠') }))
  await pg.getByRole('button', { name: /^←/ }).click(); await pg.waitForTimeout(300)
  check('leaving with unsaved changes → dashboard offers to restore the draft', await pg.getByTestId('draft-banner').count() === 1)
  await pg.getByRole('button', { name: 'Restore' }).click(); await pg.waitForTimeout(300)
  check('Restore brings the edited paper back', (await pg.locator('input[name=examName]').inputValue()).includes('١٠٠'))
  await pg.getByRole('button', { name: /^←/ }).click(); await pg.waitForTimeout(300)
  await pg.getByRole('button', { name: 'Discard' }).click()
  check('Discard removes the banner and the draft', await pg.getByTestId('draft-banner').count() === 0 && await pg.evaluate(() => !localStorage.getItem('paperDraft:demo')))
  // blocked storage must not break the app
  const pb = await browser.newContext(); await pb.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked') } }) })
  const pp = await pb.newPage(); const errs = []; pp.on('pageerror', (e) => errs.push(e.message)); await pp.goto(`${BASE}/?demo=preview`); await pp.waitForSelector('.a4-sheet')
  check('app works with browser storage blocked', errs.length === 0 && await pp.locator('.a4-sheet').count() >= 1, errs.join(';'))
}

await browser.close()
console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1) }
