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
| `feedback/{id}` | Messages teachers send from Menu → Send feedback. Only the admin (see `ADMIN_EMAILS`) can read them |
| `papers/{id}` | A paper. `userId` is the owner, `members` everyone who can edit, `printPrefs.{uid}` each teacher's own cover/border/footer/text size/student boxes |
| `shares/{CODE}` | A copy of a paper or template that anyone signed in can open with the code |
| `invites/{CODE}` | An invitation to join a paper and edit it together |

When several teachers edit one paper, saves are merged question by question
(`src/lib/merge.js`), so colleagues working on different subjects never overwrite each other.

## Quran ayat

Teachers never type Quran text: the book button in every text box (and the *Quran Ayat* question type) opens
a picker, and a small token such as `{{q 2:255 b=3,7-9}}` is stored in the text. When a paper is drawn the token
becomes the real text in a Mushaf font with tajweed colours; `b=` hides words (blank lines on the paper, filled in
the answer key, added to the word bank of a fill-in-the-blanks) and `n=0` hides the ayah-number ornament.

- `src/lib/quran.js` — data loading, token parser, search; `src/components/QuranText.jsx` — drawing;
  `src/components/QuranPicker.jsx` — the picker.
- `public/quran/quran.json` — the offline text (6,236 ayat) with tajweed rules, built by `scripts/build-quran.mjs`
  from [react-native-quran-tajweed](https://www.npmjs.com/package/react-native-quran-tajweed) (MIT, Quran.com data)
  and surah names from [@quran.ws/text](https://www.npmjs.com/package/@quran.ws/text) (CC BY 4.0).
- Fonts in `public/fonts/`: KFGQPC Uthmanic Hafs (Madani mushaf style) and Scheherazade New (SIL OFL).
- Page style → *Quran text* chooses the font, size and tajweed colours (a personal print setting).

## Guide, What's new and feedback

- `src/components/guide/` — the Guide (text in `Guide.jsx`, pictures in `Art.jsx`). Add a section to `SECTIONS`.
- `src/lib/whatsNew.js` — release notes. Add an entry at the top for each release: the newest one is shown to every
  teacher once after sign-in (`highlights`), older ones are short lists (`items`).
- `src/lib/feedback.js` — a report is saved in Firestore (`feedback`) and emailed through
  [FormSubmit](https://formsubmit.co). **One-time setup:** send the first report yourself, then open the confirmation
  email FormSubmit sends to `FEEDBACK_EMAIL` and press *Activate*. Reports also appear in Menu → Admin → Feedback
  (with a dot on the menu when something is new). Publish `firestore.rules` so the `feedback` rules apply.

## Releasing (beta, live, classic)

Three copies can be online at once: live (`/`), `/beta/` and `/classic/` (the version before the Quran update, tag `classic-v1`).

```bash
node scripts/release.mjs beta --push        # publish this checkout to /beta/
node scripts/release.mjs live --push        # make this checkout the live version (beta and classic stay online)
node scripts/release.mjs live --ref classic-v1 --push   # roll everybody back to the classic version
```

Without `--push` the result is only committed to the local `gh-pages` branch so you can look first.

## Where things live

- `src/lib/brand.js` — app name and tagline (rename here)
- `src/lib/paper.js` — paper model, languages, question types, page presets
- `src/components/PaperPreview.jsx` — measured A4 pages and the answer key
- `src/components/Editor.jsx`, `QuestionEditor.jsx` — the editor
- `src/lib/cloud.js` — share codes and invites
