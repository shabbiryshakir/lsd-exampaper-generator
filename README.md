# LSD – Exam Paper Generator

A paper maker for Lisan ud Dawat / Arabic–Urdu school exams. Build a paper, preview it as real A4 sheets,
print the **student paper** or the **answer key** to PDF. Sign in with Google; papers are stored in Firebase.

## Features
- **Cover page** with school logo/name, class, subject, marks, name / roll no. / date and the marks table. Questions
  start straight under the table (or tick off "Start questions on the first page" for a cover on its own).
- **Questions → sub-questions**: `س١` with sub-parts labelled الف، ب، ج (or ١، ٢، ٣). Every sub-question has its own
  marks; the question total is calculated.
- Part types: written answer, fill in the blanks, **Quran ayat blanks**, matching, multiple choice, true/false.
- **Blanks**: `*` = blank, `**` = wide blank (two words). Several answers in one line are separated with `|`.
  Quran ayat style lays words and blanks out right-to-left with the ayah-number circle at the end of each line.
- **Answer key** tab (answers in red inside the blanks, correct MCQ option, صح/غلط, match letters).
- Pages pack themselves to fill A4 without overflow (estimates are corrected from the real render).
- **Dashboard**: search, folders, sort, duplicate, delete.
- **Safety nets**: unsaved-changes marker + warning, automatic local draft (restore from the dashboard), paper checks
  panel (empty text, zero marks, blank/answer mismatch …), Ctrl/Cmd+S, friendly error messages, error boundary.

## Develop
```bash
npm ci
npm run dev            # http://localhost:5173
npm test               # unit tests (no browser needed)
npm run build
```
`?demo` (dev server only), e.g. `http://localhost:5173/?demo=preview`, skips Google login and Firebase so the editor,
preview, answer key and dashboard can be tried or tested offline.

### End-to-end tests
```bash
npm run dev -- --port 5199 &
BASE_URL=http://localhost:5199 npm run test:e2e   # needs `playwright` + its Chromium installed
```

## Deploy
`npm run deploy` (builds and publishes to GitHub Pages). Apply `firestore.rules` in the Firebase console so every
teacher can only reach their own papers.

## Data model
`paper = { header, subjects: [{ title, questions: [{ text, marks, parts: [part] }] }], folderId }`.
Older papers (sub-questions / blanks / pairs stored directly on the question) are upgraded automatically on open.
