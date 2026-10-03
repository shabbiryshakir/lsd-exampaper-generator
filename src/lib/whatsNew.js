// In-app "What's new" notes. Add a new entry at the top whenever the app is updated;
// teachers see a dot on the menu until they open it.
export const WHATS_NEW = [
  {
    version: '1.0',
    date: 'Beta',
    title: 'Welcome to Qalam',
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
