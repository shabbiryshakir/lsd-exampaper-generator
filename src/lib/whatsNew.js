// In-app "What's new" notes. Add a new entry at the top whenever the app is updated;
// teachers see a red dot on the bell until they open it.
export const WHATS_NEW = [
  {
    version: '2.0',
    date: '2026-10',
    items: [
      'Install the app on your phone — works without internet too',
      'Questions fold up so the editor stays short — tap one to edit it',
      'Tap any question in the Preview to jump straight to it',
      'New question types: Table and Picture',
      'Rename or add boxes on the cover (Name, ITS, Roll no, Date…)',
      'Hide the number or marks of any question',
      'Logo now always appears in Download PDF',
    ],
  },
  {
    version: '1.5',
    date: '2026-09',
    items: [
      'Pages are measured exactly — what you see is what prints',
      'Download PDF button',
      'Multiple Choice, True/False, Who said to whom, Word list, Free text',
      'Compact first page, page border, footer for photocopies, half marks',
    ],
  },
];

export const LATEST_VERSION = WHATS_NEW[0].version;
