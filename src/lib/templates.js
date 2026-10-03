// Ready-made starting points. Teachers' own templates are saved in their account
// (users/{uid}.templates) alongside their school settings.
import { newQuestion, uid, defaultsFor } from './paper';

const q = (type, lang, patch) => ({ ...newQuestion(type, lang), ...patch });

export const BUILTIN_QUESTION_TEMPLATES = [
  {
    id: 'b-lsd-meanings', builtin: true, kind: 'question', language: 'lsd', name: 'Word meanings (8 words, 2 columns)',
    data: q('wordList', 'lsd', { marks: 4, columns: 2, items: Array.from({ length: 8 }, () => ({ id: uid(), text: '', answer: '' })) }),
  },
  {
    id: 'b-lsd-short', builtin: true, kind: 'question', language: 'lsd', name: 'Short answers (الف ب ج, 3 lines each)',
    data: q('subjective', 'lsd', { marks: 6, subQuestions: Array.from({ length: 3 }, () => ({ id: uid(), text: '', lines: 3, answer: '' })) }),
  },
  {
    id: 'b-lsd-essay', builtin: true, kind: 'question', language: 'lsd', name: 'Essay (مضمون, 20 lines)',
    data: q('subjective', 'lsd', { text: 'مضمون لكهو :', marks: 10, subQuestions: [{ id: uid(), text: '', lines: 20, answer: '' }] }),
  },
  {
    id: 'b-en-comprehension', builtin: true, kind: 'question', language: 'en', name: 'Reading passage',
    data: q('textBlock', 'en', { text: 'Read the passage carefully:', content: '', lines: 0, marks: 0 }),
  },
  {
    id: 'b-en-grammar', builtin: true, kind: 'question', language: 'en', name: 'Grammar — choose the correct word',
    data: q('mcq', 'en', { marks: 5, items: Array.from({ length: 5 }, () => ({ id: uid(), text: '', options: ['', '', ''], answer: null })) }),
  },
];

export const BUILTIN_PAPER_TEMPLATES = [
  {
    id: 'bp-lsd-annual', builtin: true, kind: 'paper', language: 'lsd', name: 'LSD annual exam — 3 subjects',
    build: () => {
      const d = defaultsFor('lsd');
      d.subjects = ['تعليم القرآن', 'الحفظ والفحوى', 'لسان الدعوة'].map(title => ({ id: uid(), title, questions: [] }));
      return d;
    },
  },
  {
    id: 'bp-lsd-quick', builtin: true, kind: 'paper', language: 'lsd', name: 'LSD class test — no cover page',
    build: () => {
      const d = defaultsFor('lsd', { coverStyle: 'compact' });
      d.header.examName = 'الاختبار';
      return d;
    },
  },
  {
    id: 'bp-en-test', builtin: true, kind: 'paper', language: 'en', name: 'English test — compact header',
    build: () => {
      const d = defaultsFor('en', { coverStyle: 'compact', questionLabel: 'sin', subNumbering: 'abjad' });
      d.header.examName = 'Unit Test';
      d.subjects[0].questions = [newQuestion('fillBlanks', 'en'), newQuestion('mcq', 'en'), newQuestion('subjective', 'en')];
      return d;
    },
  },
];
