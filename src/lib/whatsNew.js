// In-app "What's new" notes. Add a new entry at the top whenever the app is updated:
//  - `highlights` are the big, picture-worthy features (shown to everyone once, right after they sign in)
//  - `items` is the short list shown in Menu -> What's new
// Teachers see a dot on the menu until they open it. `guide` is the Guide section a highlight links to.
export const WHATS_NEW = [
  {
    version: '1.4',
    date: 'November 2026',
    title: 'Easier Lisan typing, parts of ayat',
    intro: 'Type in English and get Lisan script anywhere, fix spellings for everyone, and use just a part of an ayah for younger classes.',
    highlights: [
      { icon: 'Languages', title: 'English → Lisan converter', text: 'On the home screen tap English → Lisan. Type in English letters, tap any word that is spelled wrong and fix it with the Lisan keyboard. Your fix is saved for every teacher, so the spelling gets better for all of us.', guide: 'types' },
      { icon: 'BookOpenText', title: 'Only a part of an ayah', text: 'In Add ayat tap “Only a part”, then tap the first and the last word. Only those words are printed — ideal for younger classes.', guide: 'quran-pick' },
      { icon: 'Undo2', title: 'Deleted by mistake? Undo', text: 'After deleting a question or a subject, tap Undo in the message at the bottom of the screen.', guide: 'types' },
    ],
    items: [
      'English → Lisan converter on the home screen, with a shared dictionary that learns from teachers’ corrections',
      'Inside a Lisan box, English words turn into Lisan as you press space',
      'Quran: choose only a part of an ayah',
      'Undo after deleting a question or a subject',
      'The Copy button on paper cards is gone (Make a copy is still in the paper’s ⋮ menu)',
    ],
  },
  {
    version: '1.3',
    date: 'November 2026',
    title: 'Cleaner pages, less typing',
    intro: 'Your papers now use the whole first page, every sub-question can carry its own marks, and your papers are easier to find.',
    highlights: [
      { icon: 'ScrollText', title: 'Header + marks table, no wasted page', text: 'The school header, class, subject, marks and the marks table sit at the top of page 1 and the questions start right under them. Choose “Exam paper” in Page style.', guide: 'layout' },
      { icon: 'ListChecks', title: 'Marks for every sub-question', text: 'Give each الف) ب) ج) its own marks. The question’s marks add up by themselves, and so do the subject and paper totals.', guide: 'types' },
      { icon: 'Folder', title: 'Folders and search for your papers', text: 'Make folders (for example “Annual exam” or “Grade 4”), move papers into them and search by class, exam or subject.', guide: 'start' },
      { icon: 'Languages', title: 'Type in English, get Lisan script', text: 'No Arabic keyboard? Click any box in a Lisan paper and type in English letters, for example Murtaza bhai. Each word turns into Lisan script when you press space. It is a draft to check, but it saves a lot of typing, especially on a phone.', guide: 'types' },
      { icon: 'TextCursorInput', title: 'Wider blanks, tidier ayat', text: 'Use ** for a blank that takes two words. Ayat stay lined up and the ayah number never sits alone on a line.', guide: 'quran-blanks' },
    ],
    items: [
      'New first-page style “Exam paper”: header + marks table, questions start on page 1 (new papers use it)',
      'Marks on sub-questions, ayat, sentences, multiple-choice questions and statements; totals add up by themselves',
      'Folders on the home screen, and the search bar is always there',
      'Type in English letters in any Lisan box: each word turns into Lisan script when you press space (a draft to check; A→ع converts the rest, and you can turn it off)',
      '** makes a wider blank; several blanks in one sentence take answers separated by /',
      'Quran ayat start at the normal side by default and keep the ayah number with the last word',
    ],
  },
  {
    version: '1.2',
    date: 'October 2026',
    title: 'The Quran, your way',
    intro: 'Quran ayat are now part of every paper, written perfectly in a Mushaf font with tajweed colours — and you decide where they go.',
    highlights: [
      { icon: 'BookOpenText', title: 'Pick ayat, never type them', text: 'Choose a surah and the ayat — or search by a few words. The Quran text appears perfectly written, with the ayah number ornament.', guide: 'quran-pick' },
      { icon: 'TextCursorInput', title: 'Fill in the blanks inside an ayah', text: 'Tap the words you want students to complete. They print as lines as wide as the word, and the answer key fills them in for you.', guide: 'quran-blanks' },
      { icon: 'Rows3', title: 'Use ayat anywhere', text: 'In a heading, a table, a multiple-choice option, a match column, a fill-in-the-blanks sentence or an answer. Tap the book button in any text box.', guide: 'quran-anywhere' },
      { icon: 'Paintbrush', title: 'Mushaf fonts & tajweed colours', text: 'Madani-Mushaf style or clear Naskh, four sizes, and tajweed colours you can switch off for black-and-white printing.', guide: 'quran-style' },
      { icon: 'Compass', title: 'A step-by-step Guide', text: 'Pictures and short steps for everything the app can do, from your first paper to sharing with colleagues. Open it any time from the menu.', guide: 'start' },
      { icon: 'MessageSquarePlus', title: 'Tell us what you think', text: 'Found a problem or have an idea? Menu → Send feedback goes straight to the person who makes the app.', guide: 'feedback' },
    ],
    items: [
      'New question type “Quran Ayat”, and an ayat button in every text box',
      'Pick by surah and ayah number or search by words; ayat are always written correctly',
      'Hide words of an ayah to make a fill-in-the-blanks; the answer key and word bank follow automatically',
      'Two Quran fonts (Mushaf and Naskh), four sizes, tajweed colours on or off',
      'A full Guide with pictures, and this What’s new window',
      'Send feedback or report a problem from the menu',
      'The earlier version stays available as the “classic” version',
    ],
  },
  {
    version: '1.1',
    date: 'Beta',
    title: 'LSD Paper Maker',
    items: [
      'Back to our name: LSD Paper Maker, with a simple new look',
      'New versions now install by themselves — no need to reinstall or clear anything',
      'The version and build date are shown in Menu → Help & about',
    ],
  },
  {
    version: '1.0',
    date: 'Beta',
    title: 'Big update',
    items: [
      'Make exam papers in Lisan ud Dawat (right to left) and English (left to right)',
      '10 question types: written answers, fill in the blanks, match, multiple choice, true/false, who said, word lists, passages, tables and pictures',
      'Pages are measured exactly, so what you see is what prints. Download an A4 PDF or print',
      'Complete answer keys: model answers or marking points for written questions, and a marking note where answers vary',
      'Work together: invite colleagues with a code, divide the subjects, and see each other’s changes',
      'Every teacher prints their own way, with their own cover page, logo, school name and border',
      'Share a copy of any paper or template with a code; your colleague opens it in their own account',
      'Quick page styles: Full exam, Class test or Simple sheet in one tap',
      'Everything saves automatically, even without internet, and the app reopens right where you left off',
      'Undo, version history and a 30-day trash',
      'Your own templates for questions and whole papers',
      'Side-by-side live preview on computers; installs like an app on phones',
    ],
  },
];

export const LATEST_VERSION = WHATS_NEW[0].version;
