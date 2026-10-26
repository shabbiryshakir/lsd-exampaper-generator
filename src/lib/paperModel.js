// Shared data model + helpers for papers.
//
// A paper has subjects -> questions -> parts.
//   question: { id, text, marks, parts: [part] }
//   part:     { id, type: 'subjective' | 'fillBlanks' | 'match', text, marks, ... }
// When a question has more than one part, parts are labelled الف، ب، ج ... and
// each part can carry its own marks. Legacy papers (subQuestions / blanks / pairs
// directly on the question) are upgraded by normalizeQuestion().

export const DARAJAH_OPTIONS = ['روضة أطفال', 'الدرجة الأولى', 'الدرجة الثانية', 'الدرجة الثالثة', 'الدرجة الرابعة', 'الدرجة الخامسة', 'الدرجة السادسة', 'الدرجة السابعة', 'الدرجة الثامنة', 'الدرجة التاسعة', 'الدرجة العاشرة'];
export const TIME_OPTIONS = ['30 Mins', '45 Mins', '1 Hr', '1 Hr 15 Mins', '1 Hr 30 Mins', '1 Hr 45 Mins', '2 Hrs', '2.5 Hrs', '3 Hrs'];

// Abjad order used for sub-question labels: الف، ب، ج، د ...
export const ABJAD_LABELS = ['الف', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];
export const abjad = (i) => ABJAD_LABELS[i] || String(i + 1);

export const DEFAULT_HIJRI_YEAR = '1448';

export const DEFAULT_HEADER = {
  className: 'الدرجة الرابعة',
  examName: 'الامتحان السنوي',
  hijriYear: DEFAULT_HIJRI_YEAR,
  paperNumber: 'Paper 1',
  time: '1 Hr 30 Mins',
  coverMode: 'compact', // 'compact' = questions start right under the cover table, 'separate' = cover page alone
};

export const toArabicNumerals = (num) => {
  if (num == null) return '';
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, (w) => arabicNumbers[+w]);
};

let idCounter = 0;
export const uid = () => `${Date.now().toString(36)}${(idCounter++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const DEFAULT_TEXT = {
  subjective: 'نيچے سوالوں کے جواب لکھو :',
  fillBlanks: 'خالي جگه نے صحيح كلمة سي پُركرو :',
  match: 'صحيح جوڑ ملاؤ :',
};

export const newPart = (type) => {
  const base = { id: uid(), type, text: '', marks: 0 };
  if (type === 'subjective') return { ...base, lines: 3 };
  if (type === 'fillBlanks') return { ...base, showWordBank: true, ayat: false, blanks: [{ id: uid(), text: '', answer: '', ayah: '' }] };
  return { ...base, pairs: [{ right: '', left: '' }] };
};

export const newQuestion = (type) => ({ id: uid(), text: DEFAULT_TEXT[type] || '', marks: 0, parts: [newPart(type)] });

// ---- marks -----------------------------------------------------------------
export const partsMarks = (q) => (q.parts || []).reduce((t, p) => t + (parseInt(p.marks) || 0), 0);
// Marks of the main question: the sum of its sub-question marks when any are given, otherwise the typed value.
export const questionMarks = (q) => { const s = partsMarks(q); return s > 0 ? s : (parseInt(q.marks) || 0); };
export const subjectMarks = (s) => (s.questions || []).reduce((t, q) => t + questionMarks(q), 0);
export const paperMarks = (subjects) => (subjects || []).reduce((t, s) => t + subjectMarks(s), 0);

// ---- legacy upgrade ----------------------------------------------------------
export const normalizeQuestion = (q) => {
  if (Array.isArray(q.parts)) return q;
  const { subQuestions, blanks, pairs, showWordBank, type, ...rest } = q;
  let parts = [];
  if (type === 'fillBlanks') {
    let bl = blanks;
    if (!bl) {
      const lines = (q.content || '').split('\n').filter((l) => l.trim() !== '');
      bl = lines.map((line) => ({ id: uid(), text: line, answer: '' }));
    }
    parts = [{ id: uid(), type, text: '', marks: 0, showWordBank: showWordBank !== false, ayat: false, blanks: bl.length ? bl : [{ id: uid(), text: '', answer: '' }] }];
  } else if (type === 'match') {
    parts = [{ id: uid(), type, text: '', marks: 0, pairs: pairs || [] }];
  } else {
    const subs = subQuestions || [{ id: q.id, text: q.questionText || '', lines: q.lines || 3 }];
    parts = subs.map((sq) => ({ id: sq.id ?? uid(), type: 'subjective', text: sq.text || '', lines: sq.lines ?? 3, marks: sq.marks || 0 }));
  }
  return { id: q.id ?? uid(), text: q.text || '', marks: q.marks || 0, parts };
};

export const normalizeSubjects = (subjects) =>
  (subjects || []).map((s) => ({ ...s, questions: (s.questions || []).map(normalizeQuestion) }));

// ---- blank parsing -----------------------------------------------------------
// A sentence is split into words and blanks. "*" is a one-word blank, "**" is a
// double-width blank (room for two words) and so on.
export const parseBlankText = (text) => {
  const tokens = [];
  String(text || '').split(/(\*+)/).forEach((chunk) => {
    if (!chunk) return;
    if (/^\*+$/.test(chunk)) tokens.push({ kind: 'blank', size: chunk.length });
    else chunk.split(/\s+/).filter(Boolean).forEach((w) => tokens.push({ kind: 'word', text: w }));
  });
  return tokens;
};

// Answers for one sentence: several answers are separated with "|" (one per blank, in order).
export const splitAnswers = (answer) => String(answer || '').split(/[|｜]/).map((a) => a.trim());
export const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

export const wordBankFor = (part) =>
  (part.blanks || []).flatMap((b) => splitAnswers(b.answer)).filter(Boolean).sort((a, b) => a.localeCompare(b, 'ar'));

// Gives every blank token its width multiplier and its answer.
export const resolveBlanks = (blank) => {
  const answers = splitAnswers(blank.answer);
  let k = 0;
  return parseBlankText(blank.text).map((t) => {
    if (t.kind !== 'blank') return t;
    const answer = answers[k++] || '';
    return { ...t, answer, size: Math.max(t.size, wordCount(answer) || 1) };
  });
};

export const sampleSubjects = () => normalizeSubjects([{
  id: 's1', title: 'حفظ القرآن', questions: [
    { id: 'q1', text: 'نیچے اپیلی آیات اعراب ساتھے تمام کرو!', marks: 0, parts: [
      { id: 'p1', type: 'fillBlanks', text: '', marks: 3, showWordBank: false, ayat: true, blanks: [
        { id: 'b1', text: 'كَلَّآ * كِتَٰبَ * لَفِى *', answer: 'إِنَّ | ٱلْأَبْرَارِ | عِلِّيِّينَ', ayah: 18 },
        { id: 'b2', text: 'وَمَآ * مَا *', answer: 'أَدْرَىٰكَ | عِلِّيُّونَ', ayah: 19 },
        { id: 'b3', text: 'كِتَٰبٌ *', answer: 'مَّرْقُومٌ', ayah: 20 },
      ] },
      { id: 'p2', type: 'fillBlanks', text: '', marks: 2, showWordBank: false, ayat: true, blanks: [
        { id: 'b4', text: 'يَشْهَدُهُ *', answer: 'ٱلْمُقَرَّبُونَ', ayah: 21 },
        { id: 'b5', text: 'إِنَّ * لَفِى **', answer: 'ٱلْأَبْرَارَ | نَعِيمٍ', ayah: 22 },
      ] },
    ] },
    { id: 'q2', text: 'سورة "الفيل" بالتمام اعراب ساتھے لکھو:', marks: 5, parts: [{ id: 'p3', type: 'subjective', text: '', marks: 0, lines: 3 }] },
    { id: 'q3', text: 'خالي جگه نے صحيح كلمة سي پُركرو :', marks: 4, parts: [
      { id: 'p4', type: 'fillBlanks', text: '', marks: 0, showWordBank: true, ayat: false, blanks: [
        { id: 'b6', text: 'الله * واحد', answer: 'ٱلصَّمَدُ' }, { id: 'b7', text: 'محمد * الله', answer: 'رسول' },
      ] },
    ] },
  ],
}]);
