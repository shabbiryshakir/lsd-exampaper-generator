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
