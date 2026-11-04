import test from 'node:test'
import assert from 'node:assert/strict'
import * as M from '../src/lib/paperModel.js'
import { generatePages, groupPageItems, coverHeightFor, PAGE_CAPACITY } from '../src/lib/paginate.js'

const subj = (questions, title = 'مادة') => ({ id: M.uid(), title, questions })
const blanksQ = (n, extra = {}) => ({ id: M.uid(), text: 'سؤال', marks: 1, parts: [{ id: M.uid(), type: 'fillBlanks', text: '', marks: 0, showWordBank: false, ayat: true, blanks: Array.from({ length: n }, (_, i) => ({ id: M.uid(), text: `كَلَّآ * كِتَٰبَ ${i} *`, answer: 'أ | ب', ayah: i + 1 })) , ...extra }] })
const allAtoms = (pages) => pages.flat()

test('arabic numerals', () => {
  assert.equal(M.toArabicNumerals(1448), '١٤٤٨')
  assert.equal(M.toArabicNumerals(null), '')
})

test('abjad labels run الف ب ج and numbers style works', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => M.abjad(i)), ['الف', 'ب', 'ج', 'د'])
  assert.equal(M.partLabel(2, 'numbers'), '٣')
  assert.equal(M.partLabel(1), 'ب')
})

test('blank parsing: * is one blank, ** is wide, words kept in order', () => {
  const t = M.parseBlankText('وَمَآ * مَا **')
  assert.deepEqual(t.map((x) => x.kind === 'blank' ? `_${x.size}` : x.text), ['وَمَآ', '_1', 'مَا', '_2'])
  assert.equal(M.parseBlankText('').length, 0)
  assert.equal(M.parseBlankText('no blanks here').filter((x) => x.kind === 'blank').length, 0)
})

test('several answers separated by | map to blanks in order and multi-word answers widen the blank', () => {
  const r = M.resolveBlanks({ text: 'أ * ب * ج *', answer: 'واحد | اثنان ثلاثة' })
  const blanks = r.filter((x) => x.kind === 'blank')
  assert.deepEqual(blanks.map((b) => b.answer), ['واحد', 'اثنان ثلاثة', ''])
  assert.deepEqual(blanks.map((b) => b.size), [1, 2, 1])
})

test('word bank lists every answer separately, sorted, no empties', () => {
  const bank = M.wordBankFor({ blanks: [{ answer: 'ب | أ' }, { answer: '' }, { answer: 'ج' }] })
  assert.equal(bank.length, 3)
  assert.ok(!bank.includes(''))
})

test('marks: sub-question marks override the typed main marks', () => {
  const q = { marks: 9, parts: [{ marks: 2 }, { marks: 3 }] }
  assert.equal(M.questionMarks(q), 5)
  assert.equal(M.questionMarks({ marks: '4', parts: [{ marks: 0 }] }), 4)
  assert.equal(M.questionMarks({ marks: 'abc', parts: [] }), 0)
  const s = { questions: [q, { marks: 4, parts: [] }] }
  assert.equal(M.subjectMarks(s), 9)
  assert.equal(M.paperMarks([s, s]), 18)
})

test('legacy papers are upgraded without losing data and upgrade is idempotent', () => {
  const sub = M.normalizeQuestion({ id: 1, type: 'subjective', text: 'Q', marks: 5, subQuestions: [{ id: 'a', text: 'x', lines: 4 }, { id: 'b', text: 'y', lines: 2 }] })
  assert.equal(sub.parts.length, 2)
  assert.equal(sub.parts[0].lines, 4)
  assert.equal(M.normalizeQuestion(sub), sub)
  const fb = M.normalizeQuestion({ id: 2, type: 'fillBlanks', text: 'Q', content: 'a *\n\nb *', showWordBank: false })
  assert.equal(fb.parts[0].blanks.length, 2)
  assert.equal(fb.parts[0].showWordBank, false)
  const m = M.normalizeQuestion({ id: 3, type: 'match', text: 'Q', pairs: [{ right: 'a', left: 'b' }] })
  assert.equal(m.parts[0].pairs.length, 1)
  const ancient = M.normalizeQuestion({ id: 4, type: 'subjective', text: 'Q', questionText: 'old', lines: 6 })
  assert.equal(ancient.parts[0].text, 'old')
  assert.equal(ancient.parts[0].lines, 6)
  assert.deepEqual(M.normalizeSubjects(undefined), [])
})

test('duplicate gives fresh ids everywhere', () => {
  const q = M.sampleSubjects()[0].questions[0]
  const d = M.duplicateQuestion(q)
  const ids = (o) => JSON.stringify(o).match(/"id":"[^"]+"/g)
  const a = new Set(ids(q)); ids(d).forEach((i) => assert.ok(!a.has(i)))
  assert.equal(d.parts.length, q.parts.length)
})

test('toPlain strips undefined (Firestore safe)', () => {
  assert.deepEqual(M.toPlain({ a: 1, b: undefined, c: [undefined, 2] }), { a: 1, c: [null, 2] })
})

test('validatePaper finds the common mistakes', () => {
  const bad = [subj([
    { id: 1, text: '', marks: 0, parts: [{ id: 2, type: 'fillBlanks', blanks: [{ id: 3, text: 'no blank here', answer: '' }, { id: 4, text: 'a * b *', answer: 'x' }], showWordBank: true }] },
    { id: 5, text: 'm', marks: 2, parts: [{ id: 6, type: 'match', pairs: [{ right: 'a', left: '' }] }] },
    { id: 7, text: 'm', marks: 2, parts: [{ id: 8, type: 'mcq', items: [{ id: 9, text: '', options: ['a', ''], answer: 0 }] }] },
    { id: 10, text: 'm', marks: 2, parts: [{ id: 11, type: 'subjective', lines: 0, text: '' }] },
  ], '')]
  const msgs = M.validatePaper(bad).map((i) => i.msg).join(' | ')
  for (const frag of ['Main instruction is empty', 'Marks are 0', 'no blank', '2 blank(s) but 1 answer', 'at least 2 pairs', 'incomplete', 'no question', 'at least 2 options', '0 lines', 'Subject name is empty']) assert.ok(msgs.includes(frag), `missing: ${frag}`)
  assert.equal(M.validatePaper(M.sampleSubjects()).filter((i) => i.level === 'error').length, 0)
  assert.equal(M.validatePaper([]).some((i) => i.level === 'error'), true)
})

test('drafts round-trip and never throw without storage', () => {
  globalThis.localStorage = (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) } })()
  assert.equal(M.loadDraft('u1'), null)
  assert.equal(M.saveDraft('u1', { header: { a: 1 }, subjects: [] }), true)
  assert.equal(M.loadDraft('u1').header.a, 1)
  assert.equal(M.loadDraft('u2'), null)
  M.clearDraft('u1'); assert.equal(M.loadDraft('u1'), null)
  globalThis.localStorage = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.equal(M.saveDraft('u', {}), false); assert.equal(M.loadDraft('u'), null); M.clearDraft('u')
  delete globalThis.localStorage
})

test('pagination never loses or duplicates content', () => {
  const subs = [subj(Array.from({ length: 12 }, () => blanksQ(7)))]
  const pages = generatePages(subs, { coverHeight: coverHeightFor(1) })
  const blanksOut = allAtoms(pages).filter((a) => a.type === 'blankItem').length
  assert.equal(blanksOut, 12 * 7)
  assert.ok(pages.length > 1)
})

test('headers are never stranded at the bottom of a page', () => {
  for (const n of [3, 5, 8, 11]) {
    const pages = generatePages([subj(Array.from({ length: 9 }, () => blanksQ(n)))], { coverHeight: 363 })
    pages.forEach((p) => { if (p.length) assert.ok(!['subjectHeader', 'questionHeader', 'partHeader'].includes(p[p.length - 1].type), `page ends with ${p[p.length - 1].type}`) })
  }
})

test('pages stay within capacity (estimates)', () => {
  const pages = generatePages([subj(Array.from({ length: 20 }, () => blanksQ(4)))], { coverHeight: 363 })
  pages.slice(1).forEach((p) => assert.ok(p.reduce((t, a) => t + a.h, 0) <= PAGE_CAPACITY + 1))
})

test('long written answers split across pages, line count preserved', () => {
  const q = { id: 1, text: 'q', marks: 3, parts: [{ id: 2, type: 'subjective', text: 'x', marks: 0, lines: 60 }] }
  const pages = generatePages([subj([q])], { coverHeight: 363 })
  const lines = allAtoms(pages).filter((a) => a.type === 'line').length
  assert.equal(lines, 60)
  assert.ok(pages.length >= 2)
  const merged = pages.flatMap(groupPageItems).filter((a) => a.type === 'lines').reduce((t, a) => t + a.count, 0)
  assert.equal(merged, 60)
})

test('match rows are grouped and keep their order', () => {
  const q = { id: 1, text: 'q', marks: 3, parts: [{ id: 2, type: 'match', text: '', marks: 0, pairs: Array.from({ length: 30 }, (_, i) => ({ right: `r${i}`, left: `l${i}` })) }] }
  const rows = generatePages([subj([q])], { coverHeight: 363 }).flatMap(groupPageItems).filter((a) => a.type === 'pairs').flatMap((a) => a.rows)
  assert.deepEqual(rows, Array.from({ length: 30 }, (_, i) => i))
})

test('slack makes a page hold less', () => {
  const subs = [subj(Array.from({ length: 10 }, () => blanksQ(5)))]
  const a = generatePages(subs, { coverHeight: 363 })
  const b = generatePages(subs, { coverHeight: 363, slack: [0, 400, 400, 400] })
  assert.ok(b[1].length < a[1].length)
})

test('many subjects: first page may be cover-only instead of overflowing', () => {
  const subs = Array.from({ length: 14 }, () => subj([blanksQ(2)]))
  const pages = generatePages(subs, { coverHeight: coverHeightFor(subs.length), slack: [300] })
  assert.ok(pages.length >= 2)
})

test('empty paper still produces one page', () => {
  assert.equal(generatePages([subj([])], { coverHeight: 363 }).length, 1)
  assert.equal(generatePages([], {}).length, 1)
})

test('mcq and true/false items are all emitted', () => {
  const pages = generatePages(M.sampleSubjects(), { coverHeight: 363 })
  const types = allAtoms(pages).map((a) => a.type)
  assert.equal(types.filter((t) => t === 'mcqItem').length, 2)
  assert.equal(types.filter((t) => t === 'tfItem').length, 2)
})
