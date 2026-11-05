// End-to-end checks in a real browser, using the dev-only ?demo mode (no Google login, no Firebase).
//   npm run dev -- --port 5200      (another terminal)
//   BASE_URL=http://localhost:5200 npm run test:e2e        (needs `playwright` and its Chromium)
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const BASE = process.env.BASE_URL || 'http://localhost:5200'
let passed = 0, failed = 0
const failures = []
const check = (name, cond, extra = '') => { if (cond) { passed++; console.log(`  ✓ ${name}`) } else { failed++; failures.push(name); console.log(`  ✗ ${name} ${extra}`) } }
const section = (t) => console.log(`\n${t}`)

const browser = await chromium.launch()
const open = async (viewport = { width: 1300, height: 1500 }, answer = 'Annual') => {
  const ctx = await browser.newContext({ viewport })
  const pg = await ctx.newPage()
  pg.errors = []
  pg.on('pageerror', (e) => pg.errors.push(e.message))
  pg.on('dialog', (d) => d.accept(pg.promptAnswer ?? answer))
  await pg.goto(`${BASE}/?demo`)
  await pg.getByRole('button', { name: 'Got it' }).click({ timeout: 8000 }).catch(() => {})
  await pg.waitForSelector('text=Papers')
  return pg
}
const openPaper = async (pg, text) => { await pg.locator(`text=${text}`).first().click(); await pg.waitForSelector('text=Paper details'); await pg.waitForTimeout(800) }
const tab = async (pg, name) => { await pg.getByRole('button', { name, exact: true }).first().click(); await pg.waitForTimeout(400) }
const settle = async (pg) => { await pg.waitForFunction(() => !document.body.innerText.includes('Laying out pages'), null, { timeout: 15000 }); await pg.waitForTimeout(900) }
const sheets = (pg) => pg.locator('.paper-pages .a4-sheet')
const sheetText = async (pg, i) => (await sheets(pg).nth(i).innerText()).replace(/\s+/g, ' ')
const allText = async (pg) => (await sheets(pg).allInnerTexts()).join(' ').replace(/\s+/g, ' ')
const noOverflow = (pg) => pg.evaluate(() => [...document.querySelectorAll('.paper-pages .a4-sheet .sheet-content')].every((c) => c.scrollHeight <= c.clientHeight + 2))

// ---------------------------------------------------------------------------------------------
section('1. Dashboard: search and folders')
{
  const pg = await open()
  const cards = () => pg.locator('button.text-start.flex-1').count()
  check('no Copy button on paper cards', await pg.getByRole('button', { name: 'Make a copy' }).count() === 0)
  check('all demo papers are listed', await cards() === 7)
  check('search bar is shown', await pg.getByLabel('Search papers').count() === 1)
  await pg.getByLabel('Search papers').fill('حفظ القرآن'); check('search by subject', await cards() === 1)
  await pg.getByLabel('Search papers').fill('Grade 5'); check('search by class', await cards() === 1)
  await pg.getByLabel('Search papers').fill('zzzzz'); check('no match → friendly message', (await pg.locator('body').innerText()).includes('No papers match your search'))
  await pg.getByLabel('Search papers').fill('')
  pg.promptAnswer = 'Annual'; await pg.getByRole('button', { name: 'New folder' }).click()
  check('a folder is created and selected', await pg.getByRole('button', { name: /Annual/ }).count() >= 1)
  check('an empty folder explains itself', (await pg.locator('body').innerText()).includes('Move papers here'))
  await pg.getByRole('button', { name: /^All/ }).click()
  await pg.locator('select[aria-label="Move to folder"]').first().selectOption({ index: 1 })
  check('paper moved into the folder (count 1)', (await pg.getByRole('button', { name: /Annual/ }).first().innerText()).includes('1'))
  await pg.getByRole('button', { name: /Annual/ }).first().click(); check('folder filter shows 1 paper', await cards() === 1)
  await pg.getByRole('button', { name: /^No folder/ }).click(); check('"No folder" shows the other 6', await cards() === 6)
  await pg.getByRole('button', { name: /Annual/ }).first().click()
  pg.promptAnswer = 'Final'; await pg.getByRole('button', { name: 'Rename folder' }).click()
  check('folder renamed', await pg.getByRole('button', { name: /Final/ }).count() === 1)
  await pg.getByRole('button', { name: 'Delete folder' }).click()
  await pg.waitForTimeout(300)
  check('deleting a folder keeps its papers (back to All = 7)', await cards() === 7 && await pg.getByRole('button', { name: /Final/ }).count() === 0)
  check('no JS errors', pg.errors.length === 0, pg.errors.join('; '))
}

// ---------------------------------------------------------------------------------------------
section('2. Your template: header + marks table, questions start on page 1')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Preview'); await settle(pg)
  const first = await sheetText(pg, 0)
  check('header: 786, school name, Paper box, class / subject / marks', ['۷۸٦', 'Paper 1', 'الدرجة', 'موضوع', 'مارکس', 'پنجتنية'].every((x) => first.includes(x)))
  check('header: name / roll no / date boxes', ['الاسم', 'رول نمبر', 'تاريخ'].every((x) => first.includes(x)))
  check('marks table: رقم / المواضيع / ماركس / المحصول / جملة', ['رقم', 'المواضيع', 'ماركس', 'المحصول', 'جملة'].every((x) => first.includes(x)))
  check('class is not repeated ("الدرجة : الدرجة العاشرة")', !first.includes('الدرجة : الدرجة'))
  check('questions start on the FIRST page (no wasted cover)', first.includes('س١'))
  check('only the needed pages (2)', await sheets(pg).count() === 2)
  check('nothing runs past the bottom of a page', await noOverflow(pg))
  check('page border and footer present', await pg.locator('.paper-pages .sheet-border').count() === 2 && first.includes('1 / 2'))
  check('no JS errors', pg.errors.length === 0, pg.errors.join('; '))
}

// ---------------------------------------------------------------------------------------------
section('3. Quran ayat blanks and sub-questions with marks')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Preview'); await settle(pg)
  const t = await allText(pg)
  check('main question marks are shown in brackets', t.includes('(٥)'))
  check('sub-question marks (١) and (٢) are shown', t.includes('(١)') && t.includes('(٢)'))
  check('question total = sum of its sub-questions: (٣) and (٥)', t.includes('(٣)'))
  check('subject total and table total = 13', (await sheets(pg).first().innerText()).replace(/\s+/g, ' ').includes('١٣'))
  check('sub-labels الف) ب) ج) د) on the ayat', ['الف)', 'ب)', 'ج)', 'د)'].every((x) => t.includes(x)))
  const lineLayout = await pg.evaluate(() => {
    const blocks = [...document.querySelectorAll('.paper-pages .quran')]
    const rows = blocks.map((q) => { const r = q.getBoundingClientRect(); return { right: r.right, left: r.left } })
    const markersAlone = [...document.querySelectorAll('.paper-pages .quran .q-end')].some((m) => { const p = m.parentElement; return p && p.className !== 'q-nowrap' && !p.classList.contains('q-nowrap') })
    return { rows: rows.length, markersAlone }
  })
  check('Quran lines found', lineLayout.rows >= 8, String(lineLayout.rows))
  check('ayah-number ornament always stays with its last word', !lineLayout.markersAlone)
  const w = await pg.evaluate(() => { const g = [...document.querySelectorAll('.paper-pages .blank-gap')].map((e) => Math.round(e.getBoundingClientRect().width)); return g })
  check('"**" makes a wider blank than "*"', Math.max(...w) > Math.min(...w) * 1.4, JSON.stringify(w))
  const bank = (await pg.locator('.paper-pages .border-2.bg-gray-50').first().innerText().catch(() => '')).replace(/\s+/g, ' ')
  check('word bank lists each answer separately (الذي / لم / كفوا / أحد)', ['الذي', 'لم', 'كفوا', 'أحد'].every((x) => bank.includes(x)))
  check('no JS errors', pg.errors.length === 0, pg.errors.join('; '))
}

// ---------------------------------------------------------------------------------------------
section('4. Answer key')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Answer key'); await settle(pg)
  const t = await allText(pg)
  check('answers are filled into the sentences (أحد, كفوا)', t.includes('أحد') && t.includes('كفوا'))
  check('several answers go to the right blanks (الذي … لم)', t.includes('الذي') && t.includes('لم'))
  check('hidden ayah words are revealed', await pg.locator('.paper-pages .q-revealed').count() >= 5)
  check('answer key has no overflow', await noOverflow(pg))
}

// ---------------------------------------------------------------------------------------------
section('5. Editor: marks per sub-question, auto total')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Edit')
  await pg.locator('button', { hasText: 'Fill in the Blanks' }).first().click(); await pg.waitForTimeout(500)
  check('each sentence has a Marks box', await pg.locator('text=Marks').count() >= 4)
  check('question marks show "Added up from the sub-questions"', await pg.locator('text=Added up from the sub-questions').count() >= 1)
  const markBoxes = pg.locator('div:has(> span:text-is("Marks")) input[type=number]')
  await markBoxes.nth(1).fill('2'); await markBoxes.nth(1).blur(); await pg.waitForTimeout(500)
  check('changing a sub-question mark updates the total (1+2+1 = 4)', (await pg.locator('button', { hasText: 'Fill in the Blanks' }).first().innerText()).includes('4 marks'))
  check('the hint explains ** and /', (await pg.locator('body').innerText()).includes('wider blank'))
}

// ---------------------------------------------------------------------------------------------
section('6. English → Lisan script')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Edit')
  await pg.getByRole('button', { name: /Add question/ }).first().click(); await pg.waitForTimeout(400)
  await pg.getByRole('button', { name: /Written Answer/ }).first().click().catch(() => {}); await pg.waitForTimeout(600)
  const box = pg.locator('textarea').last()
  await box.fill('Murtaza bhai Shakir')
  const btn = pg.getByRole('button', { name: 'Convert English letters to Lisan script' })
  check('"A→ع" appears only when English letters are typed', await btn.count() >= 1)
  await btn.first().click(); await pg.waitForTimeout(300)
  check('English is turned into Lisan script', (await box.inputValue()) === 'مرتضى بھائي شاكر', await box.inputValue())
  check('button disappears once everything is script', await pg.getByRole('button', { name: 'Convert English letters to Lisan script' }).count() === 0)
  await box.fill('Ali {{q 112:1 b=2}} *'); await pg.getByRole('button', { name: 'Convert English letters to Lisan script' }).first().click(); await pg.waitForTimeout(300)
  const v = await box.inputValue()
  check('Quran token and blank are left untouched', v.includes('{{q 112:1 b=2}}') && v.includes('*') && v.includes('علي'), v)
  // Automatic: typing English letters converts each finished word, and the caret stays where it was.
  await box.fill(''); await box.click()
  check('a tip about typing in English is shown under the box being edited', await pg.getByText('type in English letters, e.g.').count() === 1)
  await pg.keyboard.type('Murtaza bhai ', { delay: 20 })
  check('words turn into Lisan script as you press space', (await box.inputValue()) === 'مرتضى بھائي ', await box.inputValue())
  await pg.keyboard.press('Home'); await pg.keyboard.type('Ali ', { delay: 20 })
  check('typing in the middle keeps the caret in place', (await box.inputValue()) === 'علي مرتضى بھائي ' && await box.evaluate((e) => e.selectionStart) === 'علي '.length, await box.inputValue())
  await pg.getByRole('button', { name: 'Turn off' }).first().click(); await box.click(); await pg.keyboard.press('End'); await pg.keyboard.type('Zoher ', { delay: 20 })
  check('"Turn off" stops the automatic conversion', (await box.inputValue()).endsWith('Zoher '), await box.inputValue())
}

// ---------------------------------------------------------------------------------------------
section('7. First-page styles and old papers')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Edit')
  await pg.getByText('Page style').first().click(); await pg.waitForTimeout(300)
  check('the "Exam paper" preset is offered first', await pg.getByText('Exam paper', { exact: true }).count() >= 1)
  await pg.getByText('Full exam', { exact: true }).first().click(); await pg.waitForTimeout(300)
  await tab(pg, 'Preview'); await settle(pg)
  check('"Full exam" keeps the separate cover page (3 pages)', await sheets(pg).count() === 3)
  check('the cover page has no questions on it', !(await sheetText(pg, 0)).includes('س١'))
  check('no overflow', await noOverflow(pg))
}
{
  // every older paper format still opens
  for (const [label, marker] of [['الدرجة الرابعة', null], ['الدرجة الخامسة', null], ['الدرجة الأولى', null]]) {
    const pg = await open()
    const n = await pg.locator(`text=${label}`).count()
    if (!n) continue
    await openPaper(pg, label).catch(() => {})
    await tab(pg, 'Preview').catch(() => {}); await settle(pg).catch(() => {})
    check(`old paper (${label}) opens and prints without errors`, pg.errors.length === 0 && (await sheets(pg).count()) >= 1 && !(await pg.locator('body').innerText()).includes('Something went wrong'), pg.errors.join(';'))
  }
}

// ---------------------------------------------------------------------------------------------
section('8. Printing')
{
  const pg = await open()
  await openPaper(pg, 'الدرجة العاشرة'); await tab(pg, 'Preview'); await settle(pg)
  const n = await sheets(pg).count()
  await pg.emulateMedia({ media: 'print' })
  const pdf = await pg.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true })
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length
  check(`PDF has exactly ${n} A4 pages (got ${pages})`, pages === n)
}

// ---------------------------------------------------------------------------------------------
section('9. Phones (390px)')
{
  const pg = await open({ width: 390, height: 844 })
  check('dashboard does not scroll sideways', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
  await openPaper(pg, 'الدرجة العاشرة')
  check('editor does not scroll sideways', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
  await pg.locator('button[aria-label="Preview"], button:has-text("Preview")').locator('visible=true').first().click(); await settle(pg)
  check('preview fits the phone width', await pg.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2))
}

await browser.close()
console.log(`\n${passed} passed, ${failed} failed`)
if (failed) { console.log('FAILED:\n - ' + failures.join('\n - ')); process.exit(1) }
