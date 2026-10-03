# Qalam — exam papers, beautifully made

Create exam papers and answer keys in Lisan ud Dawat (right to left) and English, work on them
together with colleagues, and print perfect A4 PDFs — on a phone or a computer, online or offline.

## Run it

```bash
npm install
npm run dev          # open http://localhost:5173/?demo to try it without signing in
npm run build        # production build (GitHub Pages base path)
npm run deploy       # build and publish to GitHub Pages
```

## Firebase setup

The app uses Firebase Auth (Google sign-in) and Firestore. Sharing and working together need the
rules in [`firestore.rules`](firestore.rules): publish them in the Firebase console
(Firestore Database → Rules) or with `firebase deploy --only firestore:rules`.

Collections:

| Collection | What it holds |
| --- | --- |
| `users/{uid}` | School name & logo, app settings, templates |
| `papers/{id}` | A paper. `userId` is the owner, `members` everyone who can edit, `printPrefs.{uid}` each teacher's own cover/border/footer/text size/student boxes |
| `shares/{CODE}` | A copy of a paper or template that anyone signed in can open with the code |
| `invites/{CODE}` | An invitation to join a paper and edit it together |

When several teachers edit one paper, saves are merged question by question
(`src/lib/merge.js`), so colleagues working on different subjects never overwrite each other.

## Where things live

- `src/lib/brand.js` — app name and tagline (rename here)
- `src/lib/paper.js` — paper model, languages, question types, page presets
- `src/components/PaperPreview.jsx` — measured A4 pages and the answer key
- `src/components/Editor.jsx`, `QuestionEditor.jsx` — the editor
- `src/lib/cloud.js` — share codes and invites
