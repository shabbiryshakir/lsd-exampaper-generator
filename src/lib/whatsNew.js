// In-app "What's new" notes. Add a new entry at the top whenever the app is updated;
// teachers see a red dot on the menu until they open it.
export const WHATS_NEW = [
  {
    version: '3.0',
    date: '2026-10',
    items: [
      'New look: LSD Teacher Tools, with clear icons',
      'Your work saves automatically — even without internet',
      'Undo, version history and a 30-day trash for deleted papers',
      'English papers (left to right) as well as Lisan ud Dawat',
      'Answer key: type answers and download a printable key',
      'Templates: save any question or paper and reuse it',
      'App settings: bigger text for easier reading',
    ],
  },
  {
    version: '2.0',
    date: '2026-10',
    items: [
      'Install the app on your phone',
      'Questions fold up so the editor stays short',
      'Tap any question in the Preview to jump straight to it',
      'Table and Picture question types; editable student boxes',
      'Logo always appears in Download PDF',
    ],
  },
  {
    version: '1.5',
    date: '2026-09',
    items: [
      'Pages are measured exactly — what you see is what prints',
      'Download PDF; Multiple Choice, True/False, Who said to whom, Word list',
      'Compact first page, page border, footer, half marks',
    ],
  },
];

export const LATEST_VERSION = WHATS_NEW[0].version;
