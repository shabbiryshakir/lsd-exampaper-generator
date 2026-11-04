// Sample paper used only in local demo mode (/?demo) to exercise every question type and page breaking.
const words = ['الحسب', 'سلف', 'العذل', 'النبل', 'الخول', 'وهن', 'الملل', 'السبل'];
const long = 'وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ مُخَلَّدُونَ إِذَا رَأَيْتَهُمْ حَسِبْتَهُمْ لُؤْلُؤًا مَنْثُورًا وَإِذَا رَأَيْتَ ثَمَّ رَأَيْتَ نَعِيمًا وَمُلْكًا كَبِيرًا';

export default {
  id: 'demo-1',
  lastEdited: new Date().toISOString(),
  header: { className: 'الدرجة الخامسة', examName: 'الامتحان للفصل الأول', hijriYear: '1448', paperNumber: 'Paper 1', time: '2 Hrs' },
  subjects: [
    {
      id: 's1', title: 'الحفظ والفحوى', questions: [
        { id: 'q1', type: 'wordList', marks: 4, text: 'نيححسس الفاظ نا معنى لكهو', columns: 2, items: words.map((w, i) => ({ id: 'w' + i, text: w })) },
        { id: 'q2', type: 'subjective', marks: 6.5, text: 'نيححسس سؤالو نا جوابو لكهو :', subQuestions: [1, 2, 3, 4].map(i => ({ id: 'sq' + i, text: long.slice(0, 30 * i), lines: 5 })) },
        { id: 'q3', type: 'fillBlanks', marks: 3, text: 'خالي جككه ثثوري كرو :', showWordBank: true, blanks: [1, 2, 3].map(i => ({ id: 'b' + i, text: long.slice(0, 40 + i * 10) + ' *', answer: words[i] })) },
      ],
    },
    {
      id: 's2', title: 'تعليم القرآن', questions: [
        { id: 'q4', type: 'match', marks: 4, text: 'جورٌو :', pairs: words.slice(0, 5).map((w, i) => ({ right: w, left: words[(i + 3) % 8] })) },
        { id: 'q5', type: 'mcq', marks: 2.5, text: 'اختر الجواب الصحيح :', optionLayout: 'row', items: [1, 2, 3].map(i => ({ id: 'm' + i, text: long.slice(0, 50), options: words.slice(i, i + 3), answer: i % 3 })) },
        { id: 'q6', type: 'trueFalse', marks: 3, text: 'ضع علامة ✓ أو ✗ :', tfStyle: 'box', items: [1, 2, 3, 4].map(i => ({ id: 't' + i, text: long.slice(0, 35 + i * 8), answer: i % 2 === 0 })) },
        { id: 'q7', type: 'whoSaid', marks: 4, text: 'من قال لمن ؟', saidLabels: { speaker: 'القائل', listener: 'المقول له' }, items: [{ id: 'ws1', text: long.slice(0, 60), options: [] }, { id: 'ws2', text: long.slice(0, 40), options: ['موسى', 'هارون', 'فرعون'] }] },
        { id: 'q8', type: 'textBlock', marks: 5, text: 'اقرأ النص ثم أجب :', content: long + '\n' + long, lines: 12 },
        { id: 'q10', type: 'table', marks: 3, text: 'جدول ثثورو كرو :', headerRow: true, rows: [['المفرد', 'الجمع', 'الضد'], ['كتاب', '', ''], ['قلم', '', '']] },
        { id: 'q11', type: 'image', marks: 2, text: 'تصوير ديكهي نسس جواب آثثو :', src: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="#ddd"/><circle cx="200" cy="100" r="70" fill="#4338ca"/></svg>'), width: 50, caption: 'شكل', lines: 2 },
        { id: 'q9', type: 'subjective', marks: 10, text: 'مضمون لكهو :', subQuestions: [{ id: 'sq9', text: '', lines: 30 }] },
      ],
    },
  ],
};

export const englishPaper = {
  id: 'demo-en',
  lastEdited: new Date(Date.now() - 86400000).toISOString(),
  header: { className: 'Grade 5', examName: 'Unit Test', hijriYear: '2026', paperNumber: 'Paper 2', time: '1 Hr' },
  layout: { language: 'en', coverStyle: 'compact', pageBorder: true, showFooter: true, questionLabel: 'sin', subNumbering: 'abjad', textSize: 'normal', studentFields: ['Name', 'ITS No', 'Roll No'] },
  subjects: [{
    id: 'en1', title: 'English', questions: [
      { id: 'e1', type: 'fillBlanks', marks: 3, text: 'Fill in the blanks:', showWordBank: true, blanks: [{ id: 'eb1', text: 'The sun rises in the *.', answer: 'east' }, { id: 'eb2', text: 'Water boils at * degrees.', answer: '100' }] },
      { id: 'e2', type: 'mcq', marks: 2, text: 'Choose the correct answer:', optionLayout: 'row', items: [{ id: 'em1', text: 'Which is a noun?', options: ['run', 'table', 'quickly'], answer: 1 }] },
      { id: 'e3', type: 'trueFalse', marks: 2, text: 'Write True or False:', tfStyle: 'words', items: [{ id: 'et1', text: 'A week has seven days.', answer: true }, { id: 'et2', text: 'Cats can fly.', answer: false }] },
      { id: 'e4', type: 'subjective', marks: 5, text: 'Answer the following questions:', subQuestions: [{ id: 'es1', text: 'What is your favourite season and why?', lines: 4, answer: 'Any reasoned answer.' }] },
    ],
  }],
};

// Papers saved by older versions of the app, to make sure they still open.
export const legacyPapers = [
  {
    id: 'legacy-1', userId: 'demo', lastEdited: '2026-03-01T10:00:00.000Z', authorName: 'Old',
    header: { className: 'الدرجة الرابعة', examName: 'الامتحان السنوي ١٤٤٦هـ', paperNumber: 'Paper 1', time: '1 Hr 30 Mins' },
    schoolBranding: { nameAr: 'مدرسة', logo: '' },
    subjects: [
      { id: 1711111111111, title: 'تعليم القرآن', questions: [
        { id: 1711111111112, type: 'subjective', marks: '5', questionText: 'سؤال قديم', lines: 4 },
        { id: 1711111111113, type: 'fillBlanks', marks: 3, text: 'خالي جگه', content: 'سطر * اول\nسطر * دوم' },
        { id: 1711111111114, type: 'match', marks: 2, text: 'جوڑو' },
      ] },
    ],
  },
  {
    id: 'legacy-2', userId: 'demo', lastEdited: '2026-04-01T10:00:00.000Z',
    header: { className: 'الدرجة الخامسة', examName: 'اختبار', hijriYear: '1447', paperNumber: 'Paper 2', time: '1 Hr' },
    subjects: [
      { id: 1711111111120, title: 'لسان الدعوة', questions: [
        { id: 1711111111121, type: 'subjective', marks: 4, text: 'لكهو', subQuestions: [{ id: 1711111111122, text: 'الف', lines: '3' }] },
        { id: 1711111111123, type: 'fillBlanks', marks: 2, text: 'ثثوري كرو', blanks: [{ id: 1711111111124, text: 'جملة *', answer: 'جواب' }] },
        { id: 1711111111125, type: 'match', marks: 2, text: 'جوڑو', pairs: [{ right: 'ا', left: 'ب' }, { right: 'ج', left: 'د' }] },
      ] },
      { id: 1711111111126, title: 'فارغ', questions: [] },
    ],
  },
  { id: 'legacy-3', userId: 'demo', lastEdited: '2026-05-01T10:00:00.000Z', header: { examName: null, className: null }, subjects: null },
  { id: 'legacy-4', userId: 'demo', lastEdited: '2026-05-02T10:00:00.000Z', header: { className: 'الدرجة الأولى', examName: 'ج', hijriYear: '1447' }, subjects: [{ title: 'بلا id', questions: [{ type: 'subjective', marks: 1, subQuestions: [{ text: 'x', lines: 2 }] }] }], layout: { language: 'xx', studentFields: 'bad' } },
];

// Quran fill-in-the-blanks, the way teachers use it (regression paper for the ayat layout).
export const quranPaper = {
  id: 'demo-quran',
  lastEdited: new Date(Date.now() - 2 * 86400000).toISOString(),
  header: { className: 'الدرجة العاشرة', examName: 'الامتحان للفصل', hijriYear: '1448', paperNumber: 'Paper 1', time: '1 Hr' },
  layout: { language: 'lsd', coverStyle: 'table', pageBorder: true, showFooter: true, questionLabel: 'sin', subNumbering: 'abjad', textSize: 'normal', studentFields: ['الاسم', 'رول نمبر', 'تاريخ'] },
  subjects: [{
    id: 'qs1', title: 'حفظ القرآن الكريم', questions: [
      { id: 'qq1', type: 'quran', marks: 5, text: 'خالي جگه نے صحيح كلمة سي پُركرو', align: 'start', showLabels: false, items: [
        { id: 'qi1', text: '{{q 74:1 b=2}}', lines: 0, answer: '' }, { id: 'qi2', text: '{{q 74:2 b=1}}', lines: 0, answer: '' },
        { id: 'qi3', text: '{{q 74:3 b=2}}', lines: 0, answer: '' }, { id: 'qi4', text: '{{q 74:4 b=1}}', lines: 0, answer: '' },
        { id: 'qi5', text: '{{q 74:5 b=1}}', lines: 0, answer: '' }, { id: 'qi6', text: '{{q 74:6 b=1,2}}', lines: 0, answer: '' },
        { id: 'qi7', text: '{{q 74:7 b=2}}', lines: 0, answer: '' }, { id: 'qi8', text: '{{q 74:8 b=1,2}}', lines: 0, answer: '' },
      ] },
      { id: 'qq3', type: 'fillBlanks', marks: 0, text: 'خالي جگه نے صحيح كلمة سي پُركرو :', showWordBank: true, blanks: [
        { id: 'qb1', text: 'الله * الصمد', answer: 'أحد', marks: 1 }, { id: 'qb2', text: 'ولم يكن له ** أحد', answer: 'كفوا', marks: 1 }, { id: 'qb3', text: '* لم يلد و * يولد', answer: 'الذي / لم', marks: 1 },
      ] },
      { id: 'qq2', type: 'quran', marks: 5, text: 'نیچے اپیلی آیات اعراب ساتھے تمام کرو!', align: 'center', showLabels: true, items: [
        { id: 'qj1', text: '{{q 83:7 b=2,3}}', lines: 0, answer: '', marks: 1 }, { id: 'qj2', text: '{{q 83:18 b=2,4,6}}', lines: 0, answer: '', marks: 1 },
        { id: 'qj3', text: '{{q 83:19 b=1,3}}', lines: 0, answer: '', marks: 1 }, { id: 'qj4', text: '{{q 83:20-21 b=1,5}}', lines: 0, answer: '', marks: 2 },
      ] },
    ],
  }],
};
