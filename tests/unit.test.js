import { describe, it, expect } from 'vitest'
import { draftLisan, draftLisanInPlace, hasEnglish } from '../src/lib/lisanDraft'
import { convertFinishedWord } from '../src/lib/englishTyping'
import { questionMarks, itemsMarks, subjectTotal, grandTotal, splitBlankText, blankCount, answerParts, normalizeLayout, normalizeSubjects, DEFAULT_LAYOUT, PAGE_PRESETS } from '../src/lib/paper'

describe('English → Lisan draft', () => {
  it('uses the dictionary for known names and joins', () => {
    expect(draftLisan('Murtaza & Fatema')).toBe('مرتضى و فاطمة')
    expect(draftLisan('Shabbir bhai Shakir')).toBe('شبير بھائي شاكر')
  })
  it('keeps line breaks, drops "the", never returns nothing for a new word', () => {
    expect(draftLisan('the Shakir family\nHusain bhai')).toBe('شاكر عائلة\nحسين بھائي')
    expect(draftLisan('Zoher').length).toBeGreaterThan(0)
    expect(draftLisan('')).toBe('')
    expect(draftLisan(null)).toBe('')
  })
  it('converts English inside a Lisan box and keeps the script', () => {
    expect(draftLisanInPlace('Murtaza bhai')).toBe('مرتضى بھائي')
    expect(draftLisanInPlace('ابن Shabbir bhai')).toBe('ابن شبير بھائي')
  })
  it('never touches Quran tokens, blanks or numbers', () => {
    const t = 'Murtaza {{q 2:255 b=3,7-9}} * 12'
    const out = draftLisanInPlace(t)
    expect(out).toContain('{{q 2:255 b=3,7-9}}')
    expect(out).toContain('مرتضى')
    expect(out).toContain('*')
    expect(out).toContain('12')
  })
  it('hasEnglish ignores tokens and single stray letters', () => {
    expect(hasEnglish('{{q 2:255}}')).toBe(false)
    expect(hasEnglish('بسم الله')).toBe(false)
    expect(hasEnglish('x')).toBe(false)
    expect(hasEnglish('bhai')).toBe(true)
    expect(hasEnglish('{{q 2:255}} ali')).toBe(true)
  })
})

describe('sub-question marks', () => {
  it('sum of sub-question marks replaces the typed question marks', () => {
    const q = { marks: 9, subQuestions: [{ marks: 2 }, { marks: '1.5' }, {}] }
    expect(itemsMarks(q)).toBe(3.5)
    expect(questionMarks(q)).toBe(3.5)
  })
  it('falls back to the typed marks when no sub-question has marks', () => {
    expect(questionMarks({ marks: '4', subQuestions: [{ text: 'a' }] })).toBe(4)
    expect(questionMarks({ marks: 'abc' })).toBe(0)
    expect(questionMarks({})).toBe(0)
  })
  it('works for every kind of sub-list', () => {
    expect(questionMarks({ items: [{ marks: 1 }, { marks: 2 }] })).toBe(3)
    expect(questionMarks({ blanks: [{ marks: 0.5 }, { marks: 0.5 }] })).toBe(1)
  })
  it('subject and paper totals follow', () => {
    const subjects = [
      { questions: [{ marks: 5 }, { subQuestions: [{ marks: 1 }, { marks: 2 }] }] },
      { questions: [{ items: [{ marks: 4 }] }] },
    ]
    expect(subjectTotal(subjects[0])).toBe(8)
    expect(grandTotal(subjects)).toBe(12)
  })
})

describe('fill-in-the-blanks', () => {
  it('* is a blank, ** a wider one', () => {
    const segs = splitBlankText('a * b ** c')
    expect(segs.filter(s => s.blank).map(s => s.size)).toEqual([1, 2])
    expect(blankCount('a * b ** c')).toBe(2)
    expect(blankCount('no blank')).toBe(0)
    expect(splitBlankText('').length).toBe(1)
    expect(splitBlankText(null)[0].text).toBe('')
  })
  it('several blanks take several answers; one blank keeps its answer whole', () => {
    expect(answerParts({ text: 'a * b *', answer: 'x / y' })).toEqual(['x', 'y'])
    expect(answerParts({ text: 'a * b *', answer: 'x | y، z' })).toEqual(['x', 'y', 'z'])
    expect(answerParts({ text: 'a *', answer: 'two words / here' })).toEqual(['two words / here'])
    expect(answerParts({ text: 'a *', answer: '' })).toEqual([])
    expect(answerParts({})).toEqual([])
  })
})

describe('layouts', () => {
  it('new papers start with the header + marks table', () => {
    expect(DEFAULT_LAYOUT.coverStyle).toBe('table')
    expect(PAGE_PRESETS.find(p => p.id === 'paper').patch.coverStyle).toBe('table')
  })
  it('papers saved before layouts existed keep their separate cover page', () => {
    expect(normalizeLayout(undefined).coverStyle).toBe('full')
    expect(normalizeLayout({ language: 'lsd' }).coverStyle).toBe('full')
    expect(normalizeLayout({ coverStyle: 'compact' }).coverStyle).toBe('compact')
    expect(normalizeLayout({ coverStyle: 'table' }).coverStyle).toBe('table')
    expect(normalizeLayout({ language: 'xx', studentFields: 'bad' }).language).toBe('lsd')
  })
  it('old papers still normalise', () => {
    expect(normalizeSubjects(null)).toEqual([])
    const s = normalizeSubjects([{ title: 'x', questions: [{ type: 'subjective', marks: 1, subQuestions: [{ text: 'a', lines: 2 }] }] }])
    expect(s[0].questions[0].subQuestions[0].lines).toBe(2)
  })
})

describe('Typing in English letters turns finished words into Lisan', () => {
  it('converts the word before the space and moves the caret with it', () => {
    const r = convertFinishedWord('Murtaza ', 8)
    expect(r.value).toBe('مرتضى ')
    expect(r.caret).toBe('مرتضى '.length)
  })
  it('works in the middle of a line and keeps what is after the caret', () => {
    const r = convertFinishedWord('ابن bhai  الدين', 9)
    expect(r.value).toBe('ابن بھائي  الدين')
    expect(r.caret).toBe('ابن بھائي '.length)
  })
  it('leaves single letters, Lisan script, numbers, blanks and Quran tokens alone', () => {
    expect(convertFinishedWord('a ', 2)).toBeNull()
    expect(convertFinishedWord('مرتضى ', 6)).toBeNull()
    expect(convertFinishedWord('12 ', 3)).toBeNull()
    expect(convertFinishedWord('** ', 3)).toBeNull()
    expect(convertFinishedWord('{{q 2:255 b=3 ', 14)).toBeNull()
  })
  it('only fires after a word boundary, never mid-word', () => {
    expect(convertFinishedWord('Murtaz', 6)).toBeNull()
    expect(convertFinishedWord('Murtaza,', 8).value).toBe('مرتضى,')
  })
})

describe('Part of an ayah (w=)', async () => {
  const { parseRich, formatToken } = await import('../src/lib/quran')
  it('reads and writes the chosen words', () => {
    const t = parseRich('{{q 2:255 w=3-6 b=4}}')[0].token
    expect([...t.words]).toEqual([3, 4, 5, 6])
    expect(formatToken(t)).toBe('{{q 2:255 b=4 w=3-6}}')
    expect(parseRich('{{q 2:255}}')[0].token.words).toBeNull()
  })
})
