// Paper data model: languages, defaults, factories, normalisation of old saved papers, and formatting helpers.

export const TIME_OPTIONS = ['30 Mins', '45 Mins', '1 Hr', '1 Hr 15 Mins', '1 Hr 30 Mins', '1 Hr 45 Mins', '2 Hrs', '2.5 Hrs', '3 Hrs'];

const ABJAD_LABELS = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export const toArabicNumerals = (num) => (num == null ? '' : String(num).replace(/[0-9]/g, w => ARABIC_DIGITS[+w]));

// ---------------------------------------------------------------------------
// LANGUAGES — everything printed on the paper that is not typed by the teacher.
// ---------------------------------------------------------------------------
export const LANGUAGES = {
  lsd: {
    name: 'Lisan ud Dawat',
    dir: 'rtl',
    fontClass: 'font-arabic',
    num: toArabicNumerals,
    yearSuffix: 'هـ',
    classes: ['روضة أطفال', 'الدرجة الأولى', 'الدرجة الثانية', 'الدرجة الثالثة', 'الدرجة الرابعة', 'الدرجة الخامسة', 'الدرجة السادسة', 'الدرجة السابعة', 'الدرجة الثامنة', 'الدرجة التاسعة', 'الدرجة العاشرة'],
    header: { className: 'الدرجة الرابعة', examName: 'الامتحان السنوي', hijriYear: '1447' },
    firstSubject: 'تعليم القرآن',
    studentFields: ['نام', 'ITS NO', 'ROLL NO'],
    t: { no: 'رقم', subjects: 'المواضيع', marks: 'ماركس', obtained: 'المحصول', total: 'جملة', time: 'Time', speaker: 'القائل', listener: 'المقول له', true: 'صحيح', false: 'غلط', answerKey: 'الجوابات', modelAnswer: 'جواب' },
    defaults: {
      subjective: 'نيححسس سؤالو نا جوابو لكهو :',
      fillBlanks: 'خالي جككه نسس اهنا صحيح جواب سي ثثوري كرو :',
      match: 'ثثظظلا column  نسس بيجا column ما اهنا صحيح جوابو ساتهسس جورٌو :',
      mcq: 'اختر الجواب الصحيح :',
      trueFalse: 'ضع علامة ✓ أمام الصحيح و ✗ أمام الخطأ :',
      whoSaid: 'من قال لمن ؟',
      wordList: 'اكتب معاني الألفاظ الآتية :',
    },
  },
  en: {
    name: 'English',
    dir: 'ltr',
    fontClass: 'font-english',
    num: (n) => (n == null ? '' : String(n)),
    yearSuffix: '',
    classes: ['Nursery', 'KG', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'],
    header: { className: 'Grade 4', examName: 'Annual Examination', hijriYear: '2026' },
    firstSubject: 'English',
    studentFields: ['Name', 'ITS No', 'Roll No'],
    t: { no: 'No.', subjects: 'Subject', marks: 'Marks', obtained: 'Obtained', total: 'Total', time: 'Time', speaker: 'Speaker', listener: 'Spoken to', true: 'True', false: 'False', answerKey: 'Answer Key', modelAnswer: 'Answer' },
    defaults: {
      subjective: 'Answer the following questions:',
      fillBlanks: 'Fill in the blanks with the correct word:',
      match: 'Match column A with column B:',
      mcq: 'Choose the correct answer:',
      trueFalse: 'Write True or False:',
      whoSaid: 'Who said to whom?',
      wordList: 'Write the meanings of the following words:',
    },
  },
};
export const langOf = (layout) => LANGUAGES[layout?.language] || LANGUAGES.lsd;

// Kept for older imports.
export const DARAJAH_OPTIONS = LANGUAGES.lsd.classes;

export const DEFAULT_SCHOOL_INFO = { nameAr: 'پنجتنية هاير سيكندري اسكول - برواني', logo: '' };

export const DEFAULT_HEADER = {
  className: 'الدرجة الرابعة',
  examName: 'الامتحان السنوي',
  hijriYear: '1447',
  paperNumber: 'Paper 1',
  time: '1 Hr 30 Mins',
};

export const DEFAULT_LAYOUT = {
  language: 'lsd',           // 'lsd' (right-to-left, Kanz al Marjaan) | 'en' (left-to-right, English)
  coverStyle: 'full',        // 'full' = separate cover page, 'compact' = info strip on top of page 1, 'none'
  pageBorder: true,
  showFooter: true,
  questionLabel: 'sin',      // 'sin' => س١ / Q1 , 'number' => ١. / 1.
  subNumbering: 'abjad',     // 'abjad' => الف) ب) / a) b) , 'numeric' => ١) ٢) / 1) 2)
  textSize: 'normal',        // 'normal' | 'small' | 'large'
  studentFields: ['نام', 'ITS NO', 'ROLL NO'],  // boxes for the student to fill in; teachers can rename/add/remove
};

// Default header/layout for a new paper in a given language.
export const defaultsFor = (language = 'lsd', base = {}) => {
  const L = LANGUAGES[language] || LANGUAGES.lsd;
  return {
    header: { ...DEFAULT_HEADER, ...L.header },
    layout: { ...DEFAULT_LAYOUT, ...base, language, studentFields: L.studentFields },
    subjects: [{ id: uid(), title: L.firstSubject, questions: [] }],
  };
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const parseMarks = (m) => {
  const n = parseFloat(m);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;
export const subjectTotal = (subject) => round2((subject.questions || []).reduce((t, q) => t + parseMarks(q.marks), 0));
export const grandTotal = (subjects) => round2((subjects || []).reduce((t, s) => t + subjectTotal(s), 0));

export const subLabel = (index, style, language = 'lsd') => {
  const L = LANGUAGES[language] || LANGUAGES.lsd;
  if (style === 'numeric') return `${L.num(index + 1)})`;
  if (language === 'en') return `${index < 26 ? String.fromCharCode(97 + index) : index + 1})`;
  return `${ABJAD_LABELS[index] || L.num(index + 1)})`;
};
export const questionLabel = (index, style, language = 'lsd') => {
  const L = LANGUAGES[language] || LANGUAGES.lsd;
  if (style === 'number') return `${L.num(index + 1)}.`;
  return language === 'en' ? `Q${index + 1}.` : `س${L.num(index + 1)} :`;
};
export const optionLetter = (index, language = 'lsd') => (language === 'en' ? `(${String.fromCharCode(97 + index)})` : `(${ABJAD_LABELS[index] || index + 1})`);

// ---------------------------------------------------------------------------
// Question types. `icon` is a lucide icon name (see components/Icon.jsx).
// ---------------------------------------------------------------------------
export const QUESTION_TYPES = [
  { type: 'subjective', icon: 'PenLine', label: 'Written Answer', hint: 'Questions with answer lines' },
  { type: 'fillBlanks', icon: 'TextCursorInput', label: 'Fill in the Blanks', hint: 'Sentences with * blanks + word bank' },
  { type: 'match', icon: 'ArrowRightLeft', label: 'Match the Columns', hint: 'Pairs that get jumbled' },
  { type: 'mcq', icon: 'ListChecks', label: 'Multiple Choice', hint: 'Question with options to tick' },
  { type: 'trueFalse', icon: 'CircleCheckBig', label: 'True / False', hint: 'Mark each statement' },
  { type: 'whoSaid', icon: 'Quote', label: 'Who Said to Whom', hint: 'Quote → speaker & listener' },
  { type: 'wordList', icon: 'Columns2', label: 'Word List', hint: 'Meanings, opposites, plurals… in columns' },
  { type: 'textBlock', icon: 'AlignRight', label: 'Free Text / Passage', hint: 'Any text, poem or passage + lines' },
  { type: 'table', icon: 'Table', label: 'Table', hint: 'Your own grid — any rows & columns' },
  { type: 'image', icon: 'Image', label: 'Picture', hint: 'Diagram, map or picture from your phone' },
];

// Numbering skips questions marked "no number", so س١ س٢ stay continuous.
export const questionNumbers = (questions) => {
  let n = 0;
  return (questions || []).map(q => (q.hideNumber ? null : n++));
};

export const newQuestion = (type, language = 'lsd') => {
  const L = LANGUAGES[language] || LANGUAGES.lsd;
  const base = { id: uid(), type, marks: 0, text: L.defaults[type] || '' };
  switch (type) {
    case 'subjective': return { ...base, subQuestions: [{ id: uid(), text: '', lines: 3, answer: '' }] };
    case 'fillBlanks': return { ...base, showWordBank: true, blanks: [{ id: uid(), text: '', answer: '' }] };
    case 'match': return { ...base, pairs: [{ right: '', left: '' }] };
    case 'mcq': return { ...base, optionLayout: 'row', items: [{ id: uid(), text: '', options: ['', '', ''], answer: null }] };
    case 'trueFalse': return { ...base, tfStyle: 'box', items: [{ id: uid(), text: '', answer: null }] };
    case 'whoSaid': return { ...base, saidLabels: { speaker: L.t.speaker, listener: L.t.listener }, items: [{ id: uid(), text: '', options: [], answer: '' }] };
    case 'wordList': return { ...base, columns: 2, items: [{ id: uid(), text: '', answer: '' }] };
    case 'textBlock': return { ...base, content: '', lines: 0 };
    case 'table': return { ...base, headerRow: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] };
    case 'image': return { ...base, src: '', width: 60, caption: '', lines: 0 };
    default: return base;
  }
};

// Deep copy with fresh ids (used for duplicating and for inserting templates).
export const cloneWithNewIds = (obj) => {
  const copy = JSON.parse(JSON.stringify(obj));
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      if ('id' in o) o.id = uid();
      Object.values(o).forEach(walk);
    }
  };
  walk(copy);
  return copy;
};

// Upgrades any older saved paper format into the current shape.
export const normalizeSubjects = (subjects) => (subjects || []).map(sub => ({
  ...sub,
  id: sub.id ?? uid(),
  questions: (sub.questions || []).map(q => {
    const n = { ...q, id: q.id ?? uid() };
    if (q.type === 'subjective' && !q.subQuestions) n.subQuestions = [{ id: uid(), text: q.questionText || '', lines: q.lines || 3 }];
    if (q.type === 'match' && !q.pairs) n.pairs = [];
    if (q.type === 'fillBlanks') {
      if (q.showWordBank === undefined) n.showWordBank = true;
      if (!n.blanks) {
        const oldLines = (q.content || '').split('\n').filter(line => line.trim() !== '');
        n.blanks = oldLines.map(line => ({ id: uid(), text: line, answer: '' }));
      }
    }
    if (['mcq', 'trueFalse', 'whoSaid', 'wordList'].includes(q.type) && !n.items) n.items = [];
    if (q.type === 'table' && !n.rows) n.rows = [['']];
    return n;
  }),
}));

export const normalizeHeader = (header) => {
  const h = { ...DEFAULT_HEADER, ...(header || {}) };
  // Very old papers stored the year inside the exam name.
  if (h.examName.includes('١٤٤٦هـ')) {
    h.examName = h.examName.replace('١٤٤٦هـ', '').trim();
    h.hijriYear = '1446';
  }
  return h;
};

// Papers saved before layout options existed get the defaults (full cover page, as before).
export const normalizeLayout = (layout) => {
  const l = { ...DEFAULT_LAYOUT, ...(layout || {}) };
  if (!Array.isArray(l.studentFields)) l.studentFields = DEFAULT_LAYOUT.studentFields;
  if (!LANGUAGES[l.language]) l.language = 'lsd';
  return l;
};

// Firestore documents are limited to 1 MB; warn before a save would fail.
export const paperSizeKb = (obj) => Math.round(new Blob([JSON.stringify(obj)]).size / 1024);

// Does this question carry anything for the answer key?
export const hasAnswers = (q) => {
  switch (q.type) {
    case 'subjective': return (q.subQuestions || []).some(s => (s.answer || '').trim());
    case 'fillBlanks': return (q.blanks || []).some(b => (b.answer || '').trim());
    case 'match': return (q.pairs || []).some(p => (p.left || '').trim());
    case 'mcq': return (q.items || []).some(i => i.answer != null);
    case 'trueFalse': return (q.items || []).some(i => i.answer != null);
    case 'whoSaid': case 'wordList': return (q.items || []).some(i => String(i.answer || '').trim());
    default: return false;
  }
};
