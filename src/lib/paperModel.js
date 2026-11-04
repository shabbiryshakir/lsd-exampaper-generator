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
// Label of sub-question / option number i. Style 'numbers' gives ١ ٢ ٣ instead of الف ب ج.
export const partLabel = (i, style = 'abjad') => (style === 'numbers' ? toArabicNumerals(i + 1) : abjad(i));
export const TRUE_LABEL = 'صح';
export const FALSE_LABEL = 'غلط';

export const DEFAULT_HIJRI_YEAR = '1448';

export const DEFAULT_HEADER = {
  className: 'الدرجة الرابعة',
  examName: 'الامتحان السنوي',
  hijriYear: DEFAULT_HIJRI_YEAR,
  paperNumber: 'Paper 1',
  time: '1 Hr 30 Mins',
  coverMode: 'compact', // 'compact' = questions start right under the cover table, 'separate' = cover page alone
  labelStyle: 'abjad',  // 'abjad' = الف ب ج, 'numbers' = ١ ٢ ٣
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
  ayat: 'نیچے اپیلی آیات اعراب ساتھے تمام کرو!',
  match: 'صحيح جوڑ ملاؤ :',
  mcq: 'صحيح جواب پر گول دائرہ لگاؤ :',
  trueFalse: 'صح یا غلط لکھو :',
};

export const newPart = (type) => {
  const base = { id: uid(), type, text: '', marks: 0 };
  if (type === 'subjective') return { ...base, lines: 3 };
  if (type === 'fillBlanks') return { ...base, showWordBank: true, ayat: false, blanks: [{ id: uid(), text: '', answer: '', ayah: '' }] };
  if (type === 'ayat') return { ...base, type: 'fillBlanks', showWordBank: false, ayat: true, blanks: [{ id: uid(), text: '', answer: '', ayah: '' }] };
  if (type === 'mcq') return { ...base, items: [newMcqItem()] };
  if (type === 'trueFalse') return { ...base, items: [{ id: uid(), text: '', answer: true }] };
  return { ...base, pairs: [{ right: '', left: '' }] };
};
export const newMcqItem = () => ({ id: uid(), text: '', options: ['', '', '', ''], answer: 0 });

export const newQuestion = (type) => ({ id: uid(), text: DEFAULT_TEXT[type] || '', marks: 0, parts: [newPart(type)] });

// Deep copy with fresh ids (used by the duplicate buttons).
const reId = (v) => {
  if (Array.isArray(v)) return v.map(reId);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'id' ? uid() : reId(x)]));
  return v;
};
export const duplicateQuestion = (q) => reId(q);
export const duplicatePart = (p) => reId(p);

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
    { id: 'q4', text: 'صحيح جواب پر گول دائرہ لگاؤ :', marks: 2, parts: [{ id: 'p5', type: 'mcq', text: '', marks: 0, items: [
      { id: 'm1', text: 'سورة الفيل كم آية فيها؟', options: ['٤', '٥', '٦', '٧'], answer: 1 },
      { id: 'm2', text: 'سورة الفيل مكية أم مدنية؟', options: ['مكية', 'مدنية'], answer: 0 },
    ] }] },
    { id: 'q5', text: 'صح یا غلط لکھو :', marks: 2, parts: [{ id: 'p6', type: 'trueFalse', text: '', marks: 0, items: [
      { id: 't1', text: 'القرآن كلام الله', answer: true }, { id: 't2', text: 'عدد أركان الإسلام ستة', answer: false },
    ] }] },
  ],
}]);


// ---- helpers for reliability ----------------------------------------------------
// Firestore rejects `undefined` and class instances; a JSON round trip gives plain data.
export const toPlain = (obj) => JSON.parse(JSON.stringify(obj));

// Human readable problems a teacher would want to know about before printing.
// level 'error' = the paper will print wrong, 'warn' = probably a mistake.
export const validatePaper = (subjects, header = {}) => {
  const out = [];
  const add = (level, where, msg) => out.push({ level, where, msg });
  if (!(subjects || []).length) add('error', 'Paper', 'The paper has no subject.');
  if (paperMarks(subjects) === 0) add('warn', 'Paper', 'Total marks are 0 — give your questions marks.');
  (subjects || []).forEach((s, si) => {
    const sw = `Subject ${si + 1}`;
    if (!(s.title || '').trim()) add('warn', sw, 'Subject name is empty.');
    if (!(s.questions || []).length) add('warn', sw, 'No questions in this subject.');
    (s.questions || []).forEach((q, qi) => {
      const qw = `${sw} · Q${qi + 1}`;
      if (!(q.text || '').trim()) add('warn', qw, 'Main instruction is empty.');
      if (questionMarks(q) === 0) add('warn', qw, 'Marks are 0.');
      (q.parts || []).forEach((p, pi) => {
        const pw = (q.parts.length > 1 ? `${qw} · ${abjad(pi)}` : qw);
        if (p.type === 'subjective') {
          if (!(parseInt(p.lines) > 0)) add('warn', pw, 'Written answer has 0 lines.');
          if (q.parts.length > 1 && !(p.text || '').trim()) add('warn', pw, 'Sub-question text is empty.');
        } else if (p.type === 'fillBlanks') {
          if (!(p.blanks || []).length) add('error', pw, 'No sentences.');
          (p.blanks || []).forEach((b, bi) => {
            const n = (String(b.text).match(/\*+/g) || []).length;
            const a = splitAnswers(b.answer).filter(Boolean).length;
            if (!String(b.text).trim()) add('warn', pw, `Line ${bi + 1} is empty.`);
            else if (n === 0) add('warn', pw, `Line ${bi + 1} has no blank (*).`);
            if (n > 0 && a === 0 && (p.showWordBank || p.ayat)) add('warn', pw, `Line ${bi + 1} has no answer — the answer key will be empty.`);
            else if (n > 0 && a > 0 && a !== n) add('warn', pw, `Line ${bi + 1}: ${n} blank(s) but ${a} answer(s).`);
          });
        } else if (p.type === 'match') {
          if ((p.pairs || []).length < 2) add('warn', pw, 'Matching needs at least 2 pairs.');
          (p.pairs || []).forEach((pr, i) => { if (!String(pr.right).trim() || !String(pr.left).trim()) add('warn', pw, `Pair ${i + 1} is incomplete.`); });
        } else if (p.type === 'mcq') {
          if (!(p.items || []).length) add('error', pw, 'No MCQ items.');
          (p.items || []).forEach((it, i) => {
            if (!String(it.text).trim()) add('warn', pw, `MCQ ${i + 1} has no question.`);
            if ((it.options || []).filter((o) => String(o).trim()).length < 2) add('warn', pw, `MCQ ${i + 1} needs at least 2 options.`);
          });
        } else if (p.type === 'trueFalse') {
          if (!(p.items || []).length) add('error', pw, 'No statements.');
          (p.items || []).forEach((it, i) => { if (!String(it.text).trim()) add('warn', pw, `Statement ${i + 1} is empty.`); });
        }
      });
    });
  });
  return out;
};

// Local draft so a refresh / closed tab / lost connection never loses work.
const draftKey = (uidStr) => `paperDraft:${uidStr || 'anon'}`;
export const saveDraft = (uidStr, data) => { try { localStorage.setItem(draftKey(uidStr), JSON.stringify({ ...data, savedAt: Date.now() })); return true; } catch (e) { return false; } };
export const loadDraft = (uidStr) => { try { const d = localStorage.getItem(draftKey(uidStr)); return d ? JSON.parse(d) : null; } catch (e) { return null; } };
export const clearDraft = (uidStr) => { try { localStorage.removeItem(draftKey(uidStr)); } catch (e) { /* ignore */ } };
