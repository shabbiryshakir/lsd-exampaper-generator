import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../Icon'
import { QUESTION_TYPES } from '../../lib/paper'
import { useQuran } from '../../lib/quran'
import { BRAND } from '../../lib/brand'
import { FigStart, FigPicker, FigBlanks, FigAnywhere, FigStyle, FigKey, FigPageStyle, FigShare, FigFeedback } from './Art'

// ---- small writing blocks ----
const H3 = ({ id, children }) => <h3 id={id ? `g-${id}` : undefined} className="text-lg font-extrabold text-slate-900 mt-7 mb-2 scroll-mt-24">{children}</h3>;
const P = ({ children }) => <p className="text-slate-700 leading-relaxed mb-3">{children}</p>;
const Steps = ({ items }) => <ol className="space-y-2.5 mb-4">{items.map((c, i) => <Step key={i} n={i + 1}>{c}</Step>)}</ol>;
const Step = ({ n, children }) => (
  <li className="flex gap-3 text-slate-700 leading-relaxed">
    <span className="w-7 h-7 rounded-full bg-brand-700 text-white text-sm font-extrabold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
    <span className="min-w-0">{children}</span>
  </li>
);
const Tip = ({ children, kind = 'tip' }) => (
  <div className={`flex gap-3 rounded-2xl px-4 py-3 mb-4 text-sm leading-relaxed ${kind === 'warn' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-brand-50 text-brand-900 border border-brand-100'}`}>
    <Icon name={kind === 'warn' ? 'Info' : 'Lightbulb'} size={18} className="mt-0.5" /><div>{children}</div>
  </div>
);
const Figure = ({ children, caption }) => (
  <figure className="my-5 bg-white border border-slate-200 rounded-3xl p-3 sm:p-5 shadow-card">
    {children}
    {caption && <figcaption className="text-sm text-slate-500 text-center mt-3">{caption}</figcaption>}
  </figure>
);
const Key = ({ children }) => <kbd className="px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-800 text-[0.85em] font-bold">{children}</kbd>;
const Code = ({ children }) => <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-800 text-[0.88em] font-mono" dir="ltr">{children}</code>;
const Faq = ({ q, children }) => (
  <details className="group border border-slate-200 rounded-2xl bg-white mb-2 open:shadow-card">
    <summary className="cursor-pointer list-none flex items-center gap-3 px-4 py-3 font-bold text-slate-800"><Icon name="ChevronRight" size={18} className="text-slate-400 transition group-open:rotate-90" />{q}</summary>
    <div className="px-4 pb-4 text-slate-700 leading-relaxed text-[0.97rem]">{children}</div>
  </details>
);

const TYPE_USE = {
  quran: 'Recitation, “complete the ayah”, translation or tafseer questions on chosen ayat.',
  subjective: 'Normal questions with answer lines: “Explain…”, “Write about…”.',
  fillBlanks: 'Sentences with a gap. Add * where the blank goes; answers become the word bank.',
  match: 'Two columns. Type the right pairs; the second column is jumbled for you.',
  mcq: 'Several questions, each with options to tick. Mark the right one for the key.',
  trueFalse: 'Statements to mark true or false, with a box or ( True / False ).',
  whoSaid: 'A quotation: who said it, and to whom.',
  wordList: 'Meanings, opposites or plurals in 1–4 columns.',
  textBlock: 'A passage, poem or any text, followed by answer lines if you like.',
  table: 'Any grid you design. Leave cells empty for students to fill.',
  image: 'A diagram, map or photo from your phone, with a caption and answer lines.',
};

// ---- the guide itself ----
// `keywords` makes the search box find a section by words that are not in its title.
const SECTIONS = [
  {
    id: 'start', icon: 'Rocket', title: 'Make your first paper', keywords: 'new paper begin create language class subject question preview pdf',
    render: () => (
      <>
        <P>A paper has <b>subjects</b> (such as Hifz or Grammar), and each subject has <b>questions</b>. You build it in <b>Edit</b>, check it in <b>Preview</b>, and print or download it as a PDF. Everything saves by itself — even without internet.</P>
        <Figure caption="The five steps, from a blank page to a printed paper."><FigStart /></Figure>
        <H3>Step by step</H3>
        <Steps items={[
          <>On the home screen tap <b>New paper</b>. Choose <b>Lisan ud Dawat</b> (right to left) or <b>English</b> (left to right), then a ready-made template or a blank paper.</>,
          <>Open <b>Paper details</b> and set the class, exam name, year and duration. Your school name and logo come from <b>Menu → School name &amp; logo</b>.</>,
          <>Tap <b>Add question</b>. Choose a type (see “Question types”), type the instruction, set the <b>Marks</b>, and fill in the question.</>,
          <>Tap <b>Done</b> to fold the question. Add more questions, or <b>Add another subject</b> for the next subject.</>,
          <>Tap <b>Preview</b> to see the real A4 pages. Tap any question in the preview to jump back and edit it.</>,
          <>Tap <b>PDF</b> to download, or <b>⋮ → Print</b>.</>,
        ]} />
        <Tip>Marks add up for you. Each subject shows its total, and the cover page shows the grand total.</Tip>
        <Tip>Made a mistake? Use the <b>Undo</b> arrow at the top (or <Key>Ctrl</Key> + <Key>Z</Key>). <b>⋮ → Version history</b> brings back earlier versions.</Tip>
      </>
    ),
  },
  {
    id: 'layout', icon: 'Palette', title: 'Page style, cover page & printing', keywords: 'cover border footer text size student boxes print a4 pdf black white',
    render: () => (
      <>
        <P>Open a paper and tap <b>Page style</b>. The three big buttons set everything at once.</P>
        <Figure caption="Full exam, Class test, Simple sheet — tap one, then fine-tune."><FigPageStyle /></Figure>
        <H3>Fine-tuning</H3>
        <ul className="list-disc ps-5 text-slate-700 space-y-1.5 mb-4 leading-relaxed">
          <li><b>Text size on paper</b> — small, normal or large. Pages are re-measured instantly, so nothing gets cut.</li>
          <li><b>Customise…</b> — the first page (cover, name strip or none), the boxes students fill in (Name, ITS No, Roll No, Date…), question numbers (<b>Q1</b> or <b>1.</b>), sub-question numbers (a, b, c or 1, 2, 3), the page border and the footer.</li>
          <li><b>Use this style for all my new papers</b> saves your choices for next time.</li>
        </ul>
        <H3>Printing well</H3>
        <ul className="list-disc ps-5 text-slate-700 space-y-1.5 mb-4 leading-relaxed">
          <li><b>PDF</b> makes an A4 file that looks the same on every phone and computer. Best for sharing with the printing office.</li>
          <li><b>Print</b> uses your device’s printer dialog. Choose <b>A4</b>, margins <b>None</b>, scale <b>100%</b>.</li>
          <li>Printing in black and white? Switch off <b>Tajweed colours</b> (Page style → Quran text) for the cleanest result.</li>
          <li>On a shared paper your page style is <b>yours alone</b>; colleagues print their own way.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'types', icon: 'ListChecks', title: 'Question types — which to use', keywords: 'written fill blanks match mcq true false who said word list passage table picture image',
    render: () => (
      <>
        <P>Tap <b>Add question</b> and choose from {QUESTION_TYPES.length} types. You can mix them freely in one paper.</P>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
          {QUESTION_TYPES.map(t => (
            <div key={t.type} className="bg-white border border-slate-200 rounded-2xl p-3.5 flex gap-3">
              <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name={t.icon} size={20} /></span>
              <span><span className="block font-bold text-slate-900">{t.label}</span><span className="block text-sm text-slate-600 leading-snug">{TYPE_USE[t.type]}</span></span>
            </div>
          ))}
        </div>
        <Tip><b>More options</b> inside a question lets you start it on a new page, hide its number, or hide its marks.</Tip>
        <Tip>Made a question you will use again? Open it and tap <b>Template</b>. Your templates appear under <b>Add question → Templates</b>.</Tip>
      </>
    ),
  },
  {
    id: 'quran', icon: 'BookOpenText', title: 'Quran ayat — the complete guide', keywords: 'quran ayat ayah surah tajweed mushaf font fill blanks hide words search colours',
    subs: [['quran-pick', 'Choose ayat'], ['quran-blanks', 'Hide words (blanks)'], ['quran-anywhere', 'Use ayat anywhere'], ['quran-style', 'Fonts & colours'], ['quran-key', 'Answer key'], ['quran-ideas', 'Ideas to copy'], ['quran-help', 'If something looks wrong']],
    render: () => (
      <>
        <P>You never type Quran text. You <b>pick</b> the ayat, and the app writes them perfectly in a Mushaf-style font, with tajweed colours and the ayah-number ornament. Because ayat are inserted into ordinary text boxes, you can use them <b>anywhere</b> a question can hold text.</P>
        <Tip>The Quran is stored inside the app, so it works <b>offline</b> too. The very first time, open the picker once while online so it can be saved on your device.</Tip>

        <H3 id="quran-pick">1. Choose ayat</H3>
        <Steps items={[
          <>Add a <b>Quran Ayat</b> question (Add question → Quran Ayat) and tap <b>Add ayat</b>. Or, in <b>any</b> text box, tap the small <b>book button</b> at its corner.</>,
          <>Choose the <b>Surah</b>, then <b>From ayah</b> and <b>To ayah</b>. For one ayah choose the same number twice.</>,
          <>Not sure of the number? Tap <b>Search by words</b> and type a few Arabic words from the ayah. Vowel marks don’t matter. Tap the right result.</>,
          <>Check the preview — it is exactly how the ayah prints. Tap <b>Add to question</b>.</>,
        ]} />
        <Figure caption="The ayah picker."><FigPicker /></Figure>
        <P>Below the text box you will see a green card with the real ayah, <b>Change</b> and ✕. Tap <b>Change</b> to pick different ayat or different hidden words. You can write your own words before and after the ayah in the same text box.</P>
        <Tip kind="warn">In the text box the ayah appears as a short code like <Code>{'{{q 112:1-2}}'}</Code>. Leave it as it is — it turns into the Quran text on the paper. Use <b>Change</b> instead of editing it by hand.</Tip>

        <H3 id="quran-blanks">2. Hide words to make a fill-in-the-blanks</H3>
        <Steps items={[
          <>In the picker choose <b>Hide words to fill in</b>.</>,
          <><b>Tap the words</b> you want students to complete; they turn yellow. Tap again to bring one back.</>,
          <>In a hurry? Use the quick tools: <b>every 2nd or 3rd word</b>, <b>last 3 words</b>, <b>second half</b> (a great “complete the ayah”), or <b>3 random words</b>.</>,
          <>Tap <b>Add to question</b>. On the paper each hidden word is a line as wide as the word itself; in the <b>Answer key</b> the words are filled in.</>,
        ]} />
        <Figure caption="Tap words → blank lines on the paper → answers in the key."><FigBlanks /></Figure>
        <Tip>Inside a <b>Fill in the Blanks</b> question the hidden words also join the <b>word bank</b> automatically (if “Show the answers as a word bank” is on). Turn the bank off for a harder test.</Tip>

        <H3 id="quran-anywhere">3. Use ayat anywhere</H3>
        <P>The book button is in every text box, so ayat can be:</P>
        <ul className="list-disc ps-5 text-slate-700 space-y-1.5 mb-4 leading-relaxed">
          <li>in the <b>question heading</b> — “Translate: ﴾…﴿”;</li>
          <li>in a <b>table cell</b> — tap a cell, then <b>Ayat in cell</b>;</li>
          <li>as <b>multiple-choice options</b>, or in a <b>match</b> column;</li>
          <li>inside a <b>fill-in-the-blanks sentence</b>, next to your own <Code>*</Code> blanks;</li>
          <li>in a <b>true/false</b> statement, a <b>who said</b> quote, a passage, a picture caption — and even in the <b>model answer</b>.</li>
        </ul>
        <Figure caption="A heading, a table and options, all holding ayat."><FigAnywhere /></Figure>
        <P>You can put several ayat in one text box (tap the book button again), and mix them with your own words. In <b>English</b> papers the ayah is still written right to left, correctly, inside the English line.</P>

        <H3 id="quran-style">4. Fonts, size and colours</H3>
        <P>Open <b>Page style</b> → <b>Quran text (ayat)</b>:</P>
        <ul className="list-disc ps-5 text-slate-700 space-y-1.5 mb-4 leading-relaxed">
          <li><b>Mushaf (Madani)</b> — the classic Madani-Mushaf look (KFGQPC Hafs). <b>Clear Naskh</b> — a rounder, easier font for young children (Scheherazade New).</li>
          <li><b>Size</b> — small, normal, large or extra large. Younger classes usually need large.</li>
          <li><b>Tajweed colours</b> — on for colour printing and screens, off for black-and-white. These settings are yours alone on a shared paper.</li>
        </ul>
        <Figure caption="Same ayah, three looks."><FigStyle /></Figure>

        <H3 id="quran-key">5. The answer key</H3>
        <P>You do nothing extra: hidden words appear filled in (dotted underline) in <b>Answers</b>. If you also want a note — for a translation question, say — switch on <b>Answer key</b> in the editor and type it in the yellow box; ayat work there too.</P>
        <Figure caption="Students see lines; you see every answer."><FigKey /></Figure>

        <H3 id="quran-ideas">6. Ideas to copy</H3>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-4">
          {[
            ['Complete the ayah', 'Quran Ayat → pick the ayah → Hide words → “Second half”.'],
            ['Missing words with a word bank', 'Fill in the Blanks → book button in the sentence → hide 2–3 words.'],
            ['Recite and translate', 'Quran Ayat → add the ayah → set 3 answer lines for the translation.'],
            ['Match ayah to meaning', 'Match the Columns → Column A: ayah (book button), Column B: the meaning.'],
            ['Which surah is it?', 'Written Answer → question: ayah from the book button + “Name the surah”.'],
            ['Ayah, meaning, lesson', 'Table → ayah in the first column, empty cells for the rest.'],
          ].map(([t, d]) => <div key={t} className="bg-white border border-slate-200 rounded-2xl p-3.5"><div className="font-bold text-slate-900 mb-0.5">{t}</div><div className="text-sm text-slate-600 leading-snug">{d}</div></div>)}
        </div>

        <H3 id="quran-help">7. If something looks wrong</H3>
        <Faq q="It says “Loading the Quran…” and nothing appears">Connect to the internet once and try again. After the first load the Quran is saved on your device and works offline.</Faq>
        <Faq q="I see a grey ﴾ Quran 2:255 … ﴿ instead of the ayah">The Quran is still loading. It appears within a moment; if not, check your internet and reopen the paper.</Faq>
        <Faq q="I see {{q 2:255}} on the paper">The code is mistyped (a missing bracket or number). Delete it and use the book button instead.</Faq>
        <Faq q="A hidden word line is too long or too short">The line is exactly as wide as the hidden word — that is intentional, so students can count letters. If you prefer it less obvious, hide the neighbouring words too.</Faq>
        <Faq q="Colours look odd in my black-and-white print">Switch off <b>Tajweed colours</b> in Page style → Quran text.</Faq>
        <Faq q="I want to type the code myself (advanced)">
          <div className="space-y-1.5 mt-1" dir="ltr">
            <div><Code>{'{{q 2:255}}'}</Code> — Surah 2, ayah 255</div>
            <div><Code>{'{{q 112:1-4}}'}</Code> — ayat 1 to 4</div>
            <div><Code>{'{{q 2:282 b=3,7-9}}'}</Code> — hide words 3, 7, 8 and 9 (counted from the first word of the first ayah)</div>
            <div><Code>{'{{q 1:1-7 n=0}}'}</Code> — without the ayah-number ornaments</div>
          </div>
        </Faq>
      </>
    ),
  },
  {
    id: 'keys', icon: 'KeyRound', title: 'Answer keys', keywords: 'answers model marking note yellow',
    render: () => (
      <>
        <P>Switch on <b>Answer key</b> at the top of the editor. Yellow boxes appear: type the model answer, tap the correct option, or choose True / False. <b>Answers</b> (bottom bar) shows the finished key, ready to print.</P>
        <ul className="list-disc ps-5 text-slate-700 space-y-1.5 mb-4 leading-relaxed">
          <li>Objective questions are listed in compact lines; written questions show your model answer or marking points.</li>
          <li>Written questions without a model answer get a marking note (“Answers may vary…”). Change that wording in the page style, or switch it off.</li>
          <li>The key can repeat each question’s wording, or show answers only.</li>
          <li>The bar shows how many questions you have answered so far.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'together', icon: 'Users', title: 'Share & work together', keywords: 'share code invite colleague copy collaborate',
    render: () => (
      <>
        <Figure caption="Send the code in WhatsApp, SMS or anything you like."><FigShare /></Figure>
        <H3>Share a copy</H3>
        <Steps items={[<>Open the paper and tap <b>Share → Share a copy</b>.</>, <>Send the code (or link) to your colleague.</>, <>They choose <b>Menu → Enter a code</b>, look at the paper, and tap <b>Save to my papers</b>. They get their own copy to edit and print with their school’s name.</>]} />
        <H3>Work together on one paper</H3>
        <Steps items={[<>Tap <b>Share → Work together</b> and send the invitation code.</>, <>Colleagues join with <b>Enter a code</b>. Everyone edits the same paper; changes are merged question by question, so two people never overwrite each other.</>, <>On each subject you can choose <b>who writes it</b>.</>]} />
        <Tip>You can stop sharing at any time. A colleague can leave a paper from <b>⋮ → Leave this paper</b>.</Tip>
      </>
    ),
  },
  {
    id: 'tools', icon: 'History', title: 'Templates, history & trash', keywords: 'template undo version history trash delete restore duplicate copy',
    render: () => (
      <ul className="list-disc ps-5 text-slate-700 space-y-2 mb-4 leading-relaxed">
        <li><b>Templates</b> — save a question (<b>Template</b> button) or a whole paper (<b>⋮ → Save as template</b>) and reuse it.</li>
        <li><b>Copy</b> on the home screen duplicates a paper, perfect for “Paper 2”.</li>
        <li><b>Undo / Redo</b> — arrows at the top. Typing within a second counts as one step.</li>
        <li><b>Version history</b> — <b>⋮ → Version history</b> lists earlier versions saved on this device.</li>
        <li><b>Trash</b> — deleted papers stay 30 days; restore them from the home screen.</li>
      </ul>
    ),
  },
  {
    id: 'offline', icon: 'Smartphone', title: 'Install, offline & updates', keywords: 'install app phone home screen offline update classic old version',
    render: ({ onClassic }) => (
      <>
        <ul className="list-disc ps-5 text-slate-700 space-y-2 mb-4 leading-relaxed">
          <li><b>Install it like an app</b>: Menu → <b>Install the app</b> (Android Chrome), or in Safari tap <b>Share → Add to Home Screen</b> (iPhone).</li>
          <li><b>Works offline</b>: your papers, the Quran and the fonts are kept on your device. Changes you make offline upload by themselves when you are back online.</li>
          <li><b>Updates install by themselves</b>. If a bar says “A new version is ready”, tap <b>Update</b>.</li>
        </ul>
        <Tip>Prefer the way it used to be? The earlier version of {BRAND.name} is still available as the <b>classic version</b>.{onClassic && <> <button type="button" onClick={onClassic} className="font-bold underline">Open the classic version</button>.</>}</Tip>
      </>
    ),
  },
  {
    id: 'feedback', icon: 'MessageSquarePlus', title: 'Send feedback or report a problem', keywords: 'bug issue problem idea suggestion contact help support',
    render: ({ onFeedback }) => (
      <>
        <P>This app is made by one person for the community of teachers, and your messages shape it.</P>
        <Figure caption="Menu → Send feedback."><FigFeedback /></Figure>
        <Steps items={[<>Open <b>Menu → Send feedback</b>{onFeedback && <> (or <button type="button" onClick={onFeedback} className="font-bold underline">tap here</button>)</>}.</>, <>Choose <b>Something is wrong</b>, <b>I have an idea</b>, <b>I have a question</b> or <b>Say thanks</b>.</>, <>Write what happened — what you tapped, and what you expected. Leave <b>Include technical details</b> on so we can reproduce it.</>, <>Tap <b>Send</b>. If you are offline it is sent when you reconnect.</>]} />
        <Tip>Your papers are never attached. We reply to your Google email address.</Tip>
      </>
    ),
  },
  {
    id: 'faq', icon: 'CircleHelp', title: 'Quick answers', keywords: 'faq question help trouble problem',
    render: () => (
      <>
        <Faq q="My work disappeared!">It didn’t: papers save on your device and in the cloud. Check the home screen and <b>Trash</b>; open <b>⋮ → Version history</b> inside the paper.</Faq>
        <Faq q="The PDF has a blank page at the end">Reduce the last page’s content slightly or switch <b>Text size</b> to Small; pages are measured, so this is rare.</Faq>
        <Faq q="Can I use two languages in one paper?">The paper’s language sets the layout direction. English and Arabic text can still be mixed inside a line, and Quran ayat are always written right to left.</Faq>
        <Faq q="Sign-in does not finish on my phone">Allow pop-ups for the site, or install the app to the home screen and sign in there. Still stuck? Send feedback from a different device.</Faq>
        <Faq q="Can colleagues see my school logo?">No. School name, logo and print style are personal to each teacher, even on a shared paper.</Faq>
      </>
    ),
  },
];

export default function Guide({ section, onClose, onFeedback, onClassic }) {
  useQuran();
  const [query, setQuery] = useState('');
  const scroller = useRef(null);
  const q = query.trim().toLowerCase();
  const list = useMemo(() => SECTIONS.filter(s => !q || `${s.title} ${s.keywords} ${(s.subs || []).map(x => x[1]).join(' ')}`.toLowerCase().includes(q)), [q]);

  const goTo = (id, smooth = true) => {
    const el = document.getElementById(`g-${id}`);
    const box = scroller.current;
    if (el && box) box.scrollTo({ top: el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8, behavior: smooth ? 'smooth' : 'auto' });
  };
  // Open at the requested part (e.g. "quran-blanks").
  useEffect(() => {
    if (!section) return;
    const t = setTimeout(() => goTo(section, false), 80);
    return () => clearTimeout(t);
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] bg-[#f6f7f5] flex flex-col print:hidden anim-fade" role="dialog" aria-modal="true" aria-label="Guide">
      <header className="bg-white/95 backdrop-blur border-b border-slate-200 shrink-0" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-5xl mx-auto flex items-center gap-2 px-3 h-16">
          <button type="button" onClick={onClose} aria-label="Close guide" className="w-11 h-11 rounded-full hover:bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"><Icon name="ArrowLeft" size={22} /></button>
          <div className="min-w-0 flex-1"><div className="text-lg font-extrabold text-slate-900 leading-tight">Guide</div><div className="text-xs text-slate-500 truncate">Step by step, with pictures</div></div>
          <div className="relative w-40 sm:w-64"><Icon name="Search" size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the guide" className="w-full ps-9 pe-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:border-brand-500 focus:bg-white focus:outline-none" /></div>
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-8">
          <nav className="hidden lg:block sticky top-0 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-1" aria-label="Guide sections">
            {SECTIONS.map(s => (
              <div key={s.id} className="mb-1">
                <button type="button" onClick={() => goTo(s.id)} className="w-full text-start flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white text-sm font-bold text-slate-700"><Icon name={s.icon} size={16} className="text-brand-700" />{s.title}</button>
                {(s.subs || []).map(([id, l]) => <button key={id} type="button" onClick={() => goTo(id)} className="w-full text-start ps-9 pe-2 py-1 text-[13px] text-slate-500 hover:text-brand-700">{l}</button>)}
              </div>
            ))}
          </nav>

          <main className="min-w-0 pb-24">
            <div className="lg:hidden flex gap-2 overflow-x-auto no-scrollbar mb-5 -mx-4 px-4">
              {SECTIONS.map(s => <button key={s.id} type="button" onClick={() => goTo(s.id)} className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white border border-slate-200 text-sm font-bold text-slate-700"><Icon name={s.icon} size={15} className="text-brand-700" />{s.title.split(' — ')[0]}</button>)}
            </div>
            {list.length === 0 && <p className="text-center text-slate-500 py-16">Nothing found for “{query}”. Try another word{onFeedback && <>, or <button type="button" onClick={onFeedback} className="font-bold text-brand-700 underline">ask us</button></>}.</p>}
            {list.map(s => (
              <section key={s.id} id={`g-${s.id}`} className="mb-12 scroll-mt-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-11 h-11 rounded-2xl bg-brand-700 text-white flex items-center justify-center shrink-0"><Icon name={s.icon} size={22} /></span>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">{s.title}</h2>
                </div>
                {s.render({ onFeedback, onClassic })}
              </section>
            ))}
            <div className="text-center text-sm text-slate-500 border-t border-slate-200 pt-6">Still stuck? {onFeedback ? <><button type="button" onClick={onFeedback} className="font-bold text-brand-700 underline">Send us a message</button> and we will help.</> : 'Sign in, then use Menu → Send feedback and we will help.'}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
