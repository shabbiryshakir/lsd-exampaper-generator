// In-app "What's new" notes. Add a new entry at the top whenever the app is updated:
//  - `highlights` are the big, picture-worthy features (shown to everyone once, right after they sign in)
//  - `items` is the short list shown in Menu -> What's new
// Teachers see a dot on the menu until they open it. `guide` is the Guide section a highlight links to.
export const WHATS_NEW = [
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
