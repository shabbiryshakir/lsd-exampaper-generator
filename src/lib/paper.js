// Paper data model: defaults, factories, normalisation of old saved papers, and formatting helpers.

export const DARAJAH_OPTIONS = ['روضة أطفال', 'الدرجة الأولى', 'الدرجة الثانية', 'الدرجة الثالثة', 'الدرجة الرابعة', 'الدرجة الخامسة', 'الدرجة السادسة', 'الدرجة السابعة', 'الدرجة الثامنة', 'الدرجة التاسعة', 'الدرجة العاشرة'];
export const TIME_OPTIONS = ['30 Mins', '45 Mins', '1 Hr', '1 Hr 15 Mins', '1 Hr 30 Mins', '1 Hr 45 Mins', '2 Hrs', '2.5 Hrs', '3 Hrs'];

const ABJAD_LABELS = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];

export const DEFAULT_SCHOOL_INFO = { nameAr: 'پنجتنية هاير سيكندري اسكول - برواني', logo: '' };

export const DEFAULT_HEADER = {
  className: 'الدرجة الرابعة',
  examName: 'الامتحان السنوي',
  hijriYear: '1447',
  paperNumber: 'Paper 1',
  time: '1 Hr 30 Mins',
};

export const DEFAULT_LAYOUT = {
  coverStyle: 'full',        // 'full' = separate cover page, 'compact' = info strip on top of page 1, 'none'
  pageBorder: true,
  showFooter: true,
  questionLabel: 'sin',      // 'sin' => س١ , 'number' => ١.
  subNumbering: 'abjad',     // 'abjad' => الف) ب) ج) , 'numeric' => ١) ٢) ٣)
  textSize: 'normal',        // 'normal' | 'small' | 'large'
  studentFields: ['نام', 'ITS NO', 'ROLL NO'],  // boxes for the student to fill in; teachers can rename/add/remove
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const toArabicNumerals = (num) => {
  if (num == null) return '';
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, w => arabicNumbers[+w]);
};

export const parseMarks = (m) => {
  const n = parseFloat(m);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;
export const subjectTotal = (subject) => round2((subject.questions || []).reduce((t, q) => t + parseMarks(q.marks), 0));
export const grandTotal = (subjects) => round2((subjects || []).reduce((t, s) => t + subjectTotal(s), 0));

export const subLabel = (index, style) => (style === 'numeric' ? toArabicNumerals(index + 1) : (ABJAD_LABELS[index] || toArabicNumerals(index + 1))) + ')';
export const questionLabel = (index, style) => (style === 'number' ? `${toArabicNumerals(index + 1)}.` : `س${toArabicNumerals(index + 1)} :`);

// ---------------------------------------------------------------------------
// Question types. Each has a label/description for the picker and a factory.
// ---------------------------------------------------------------------------
export const QUESTION_TYPES = [
  { type: 'subjective', icon: '✍️', label: 'Written Answer', hint: 'Questions with answer lines (ا، ب، ج)' },
  { type: 'fillBlanks', icon: '➖', label: 'Fill in the Blanks', hint: 'Sentences with * blanks + word bank' },
  { type: 'match', icon: '🔗', label: 'Match the Columns', hint: 'Pairs that get jumbled' },
  { type: 'mcq', icon: '🔘', label: 'Multiple Choice', hint: 'Question with options to tick' },
  { type: 'trueFalse', icon: '✔️', label: 'True / False', hint: 'صحيح / غلط for each statement' },
  { type: 'whoSaid', icon: '💬', label: 'Who Said to Whom', hint: 'Quote → القائل / المقول له' },
  { type: 'wordList', icon: '📋', label: 'Word List', hint: 'Meanings, opposites, plurals… in columns' },
  { type: 'textBlock', icon: '📝', label: 'Free Text / Passage', hint: 'Any text, poem or passage + lines' },
  { type: 'table', icon: '▦', label: 'Table', hint: 'Your own grid — any rows & columns' },
  { type: 'image', icon: '🖼️', label: 'Picture', hint: 'Diagram, map or picture from your phone' },
];

// Numbering skips questions marked "no number", so س١ س٢ stay continuous.
export const questionNumbers = (questions) => {
  let n = 0;
  return (questions || []).map(q => (q.hideNumber ? null : n++));
};

export const newQuestion = (type) => {
  const base = { id: uid(), type, marks: 0, text: '' };
  switch (type) {
    case 'subjective': return { ...base, text: 'نيححسس سؤالو نا جوابو لكهو :', subQuestions: [{ id: uid(), text: '', lines: 3 }] };
    case 'fillBlanks': return { ...base, text: 'خالي جككه نسس اهنا صحيح جواب سي ثثوري كرو :', showWordBank: true, blanks: [{ id: uid(), text: '', answer: '' }] };
    case 'match': return { ...base, text: 'ثثظظلا column  نسس بيجا column ما اهنا صحيح جوابو ساتهسس جورٌو :', pairs: [{ right: '', left: '' }] };
    case 'mcq': return { ...base, text: 'اختر الجواب الصحيح :', optionLayout: 'row', items: [{ id: uid(), text: '', options: ['', '', ''] }] };
    case 'trueFalse': return { ...base, text: 'ضع علامة ✓ أمام الصحيح و ✗ أمام الخطأ :', tfStyle: 'box', items: [{ id: uid(), text: '' }] };
    case 'whoSaid': return { ...base, text: 'من قال لمن ؟', saidLabels: { speaker: 'القائل', listener: 'المقول له' }, items: [{ id: uid(), text: '', options: [] }] };
    case 'wordList': return { ...base, text: 'اكتب معاني الألفاظ الآتية :', columns: 2, items: [{ id: uid(), text: '' }] };
    case 'textBlock': return { ...base, text: '', content: '', lines: 0 };
    case 'table': return { ...base, text: '', headerRow: true, rows: [['', '', ''], ['', '', ''], ['', '', '']] };
    case 'image': return { ...base, text: '', src: '', width: 60, caption: '', lines: 0 };
    default: return base;
  }
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
  return l;
};

// Firestore documents are limited to 1 MB; warn before a save would fail.
export const paperSizeKb = (obj) => Math.round(new Blob([JSON.stringify(obj)]).size / 1024);
