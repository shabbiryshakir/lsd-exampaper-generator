// Illustrations for the Guide and the What's new window. Everything is inline SVG so it stays sharp
// on every screen and works offline. Quran text inside the pictures is the real thing (QuranRun).
import { QuranRun } from '../QuranText'

const C = { brand: '#18625d', brandMid: '#27968b', brandLight: '#effaf8', brand100: '#d6f2ed', brand200: '#ade4da', ink: '#0f172a', slate: '#475569', mute: '#94a3b8', line: '#cbd5e1', soft: '#f1f5f9', amber: '#d97706', amberLight: '#fef3c7', white: '#fff' };
const SANS = '"Plus Jakarta Sans Variable", system-ui, sans-serif';

const tok = (s, from, to = from, blanks = [], numbers = true) => ({ s, from, to, blanks: new Set(blanks), numbers });

// ---- building blocks ----
const Fig = ({ w, h, label, children, className = '' }) => (
  <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={`w-full h-auto ${className}`} fontFamily={SANS}>
    <defs>
      <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill={C.brand} /></marker>
      <filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0f172a" floodOpacity="0.14" /></filter>
    </defs>
    {children}
  </svg>
);
const Card = ({ x, y, w, h, r = 14, fill = C.white, stroke = C.line, shadow = true }) => <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={stroke} filter={shadow ? 'url(#sh)' : undefined} />;
const Txt = ({ x, y, size = 13, weight = 600, fill = C.ink, anchor = 'start', children, ...p }) => <text x={x} y={y} fontSize={size} fontWeight={weight} fill={fill} textAnchor={anchor} {...p}>{children}</text>;
const Badge = ({ x, y, n }) => (
  <g><circle cx={x} cy={y} r="13" fill={C.brand} stroke="#fff" strokeWidth="2" /><text x={x} y={+y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff">{n}</text></g>
);
const Arrow = ({ d }) => <path d={d} fill="none" stroke={C.brand} strokeWidth="2.5" strokeLinecap="round" markerEnd="url(#arr)" />;
const Pill = ({ x, y, w, h = 30, label, on, fill }) => (
  <g><rect x={x} y={y} width={w} height={h} rx={h / 2.4} fill={fill || (on ? C.brand : C.soft)} /><Txt x={+x + +w / 2} y={+y + +h / 2 + 4.5} size="12" weight="700" anchor="middle" fill={on || fill ? '#fff' : C.slate}>{label}</Txt></g>
);
const Select = ({ x, y, w, label, value }) => (
  <g>
    <Txt x={x} y={+y - 6} size="11" weight="700" fill={C.slate}>{label}</Txt>
    <rect x={x} y={y} width={w} height="34" rx="9" fill="#fff" stroke={C.line} />
    <Txt x={+x + 10} y={+y + 22} size="13" weight="600">{value}</Txt>
    <path d={`M${+x + +w - 22} ${+y + 14}l5 5 5-5`} fill="none" stroke={C.slate} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </g>
);
// Real Quran text inside a picture.
const Q = ({ x, y, w, h, token, size = 22, font = 'mushaf', align = 'center', reveal = false }) => (
  <foreignObject x={x} y={y} width={w} height={h}>
    <div className={`quran-scope qf-${font}`} style={{ fontSize: size, lineHeight: 1.7, textAlign: align, color: C.ink, direction: 'rtl' }}><QuranRun token={token} reveal={reveal} /></div>
  </foreignObject>
);
// A sheet of paper.
const Page = ({ x, y, w, h, children }) => (
  <g>
    <rect x={x} y={y} width={w} height={h} rx="4" fill="#fff" stroke={C.line} filter="url(#sh)" />
    <rect x={+x + 8} y={+y + 8} width={+w - 16} height={+h - 16} fill="none" stroke="#111" strokeWidth="1.2" opacity="0.55" />
    {children}
  </g>
);
const Lines = ({ x, y, w, n, gap = 14 }) => Array.from({ length: n }, (_, i) => <line key={i} x1={x} x2={+x + +w} y1={+y + i * gap} y2={+y + i * gap} stroke="#9ca3af" strokeDasharray="1.5 3" strokeWidth="1.4" />);
const Bars = ({ x, y, w, rows, gap = 9, h = 5, op = 0.25 }) => rows.map((rw, i) => <rect key={i} x={x} y={+y + i * gap} width={+w * rw} height={h} rx="2.5" fill="#0f172a" opacity={op} />);

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

// The five steps of a first paper.
export function FigStart() {
  const steps = [
    ['New paper', 'Tap “New paper”, choose the language and class.'],
    ['Add a question', 'Tap “Add question”, pick a type, type your question.'],
    ['Check the preview', 'Preview shows the real A4 pages.'],
    ['Fill the answers', 'Switch on “Answer key” and fill the yellow boxes.'],
    ['Print or PDF', 'Tap PDF to download, or Print.'],
  ];
  return (
    <Fig w={760} h={210} label="Five steps: new paper, add a question, check the preview, fill the answers, print or download the PDF">
      {steps.map(([t, d], i) => {
        const x = 8 + i * 150;
        return (
          <g key={t}>
            <Card x={x} y="20" w="136" h="170" />
            <Badge x={x + 24} y="20" n={i + 1} />
            <rect x={x + 18} y="48" width="100" height="60" rx="8" fill={C.brandLight} stroke={C.brand200} />
            {i === 0 && <g><rect x={x + 34} y="64" width="68" height="28" rx="14" fill={C.brand} /><Txt x={x + 68} y="83" anchor="middle" size="11" fill="#fff" weight="800">+ New paper</Txt></g>}
            {i === 1 && <g><rect x={x + 30} y="58" width="76" height="14" rx="4" fill="#fff" stroke={C.line} /><rect x={x + 30} y="76" width="76" height="14" rx="4" fill="#fff" stroke={C.line} /><rect x={x + 30} y="94" width="76" height="8" rx="4" fill={C.brand} opacity=".8" /></g>}
            {i === 2 && <g><rect x={x + 44} y="54" width="48" height="50" rx="2" fill="#fff" stroke={C.mute} /><Bars x={x + 50} y="62" w={36} rows={[1, .8, 1, .6, .9]} /></g>}
            {i === 3 && <g><rect x={x + 30} y="60" width="76" height="16" rx="5" fill={C.amberLight} stroke="#fbbf24" /><rect x={x + 30} y="82" width="76" height="16" rx="5" fill={C.amberLight} stroke="#fbbf24" /></g>}
            {i === 4 && <g><rect x={x + 36} y="56" width="64" height="46" rx="8" fill={C.brand} /><path d={`M${x + 68} 66v20m-8-8l8 8 8-8`} stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></g>}
            <Txt x={x + 68} y="132" size="13" weight="800" anchor="middle">{t}</Txt>
            <foreignObject x={x + 8} y="138" width="120" height="50"><div style={{ fontSize: 11, lineHeight: 1.3, color: C.slate, textAlign: 'center', fontWeight: 500 }}>{d}</div></foreignObject>
            {i < 4 && <path d={`M${x + 138} 105h10`} stroke={C.brand} strokeWidth="2.5" markerEnd="url(#arr)" />}
          </g>
        );
      })}
    </Fig>
  );
}

// The ayah picker with numbered callouts.
export function FigPicker({ compact }) {
  return (
    <Fig w={700} h={470} label="The ayah picker: choose the surah and ayat, choose whether to hide words, check the preview, tap Add to question">
      <Card x="14" y="10" w="410" h="450" r="22" />
      <Txt x="36" y="46" size="17" weight="800">Add ayat</Txt>
      <rect x="36" y="58" width="366" height="34" rx="10" fill={C.soft} />
      <rect x="40" y="62" width="180" height="26" rx="8" fill="#fff" /><Txt x="130" y="80" size="12" weight="800" anchor="middle" fill={C.brand}>Choose surah &amp; ayat</Txt>
      <Txt x="311" y="80" size="12" weight="800" anchor="middle" fill={C.mute}>Search by words</Txt>
      <Select x="36" y="116" w="366" label="Surah" value="112. Al-Ikhlās (4 ayat)" />
      <Select x="36" y="176" w="176" label="From ayah" value="1" />
      <Select x="226" y="176" w="176" label="To ayah" value="2" />
      <rect x="36" y="232" width="150" height="30" rx="9" fill="#fff" /><rect x="36" y="232" width="86" height="30" rx="9" fill="#fff" stroke={C.line} />
      <Pill x="36" y="232" w="106" label="Show the ayat" on />
      <Pill x="146" y="232" w="150" label="Hide words to fill in" />
      <rect x="310" y="238" width="18" height="18" rx="4" fill={C.brand} /><path d="M314 247l3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <Txt x="336" y="252" size="12" weight="700" fill={C.slate}>Numbers</Txt>
      <rect x="36" y="280" width="366" height="106" rx="16" fill="#fff" stroke={C.brand200} strokeWidth="2" />
      <Txt x="219" y="298" size="10.5" weight="700" fill={C.mute} anchor="middle">Al-Ikhlās · 112:1–2</Txt>
      <Q x="46" y="302" w="346" h="80" token={tok(112, 1, 2)} size={26} />
      <rect x="36" y="400" width="86" height="42" rx="14" fill="#fff" stroke={C.line} /><Txt x="79" y="426" size="13" weight="800" anchor="middle" fill={C.slate}>Cancel</Txt>
      <rect x="132" y="400" width="270" height="42" rx="14" fill={C.brand} /><Txt x="267" y="426" size="14" weight="800" anchor="middle" fill="#fff">✓  Add to question</Txt>
      {!compact && (
        <g>
          <Badge x="432" y="132" n={1} /><Txt x="456" y="130" size="13" weight="800">Choose the surah</Txt><Txt x="456" y="148" size="12" fill={C.slate} weight="500">Names are in English and Arabic,</Txt><Txt x="456" y="164" size="12" fill={C.slate} weight="500">with the number of ayat.</Txt>
          <Badge x="432" y="192" n={2} /><Txt x="456" y="190" size="13" weight="800">Choose the ayat</Txt><Txt x="456" y="208" size="12" fill={C.slate} weight="500">One ayah, or a range such as 1 to 4.</Txt>
          <Badge x="432" y="247" n={3} /><Txt x="456" y="245" size="13" weight="800">Show or hide words</Txt><Txt x="456" y="263" size="12" fill={C.slate} weight="500">“Hide words” makes a fill-in-the-blanks.</Txt>
          <Badge x="432" y="332" n={4} /><Txt x="456" y="330" size="13" weight="800">Check the preview</Txt><Txt x="456" y="348" size="12" fill={C.slate} weight="500">This is exactly how it prints,</Txt><Txt x="456" y="364" size="12" fill={C.slate} weight="500">colours included.</Txt>
          <Badge x="432" y="421" n={5} /><Txt x="456" y="419" size="13" weight="800">Add it</Txt><Txt x="456" y="437" size="12" fill={C.slate} weight="500">It lands where your cursor was.</Txt>
        </g>
      )}
    </Fig>
  );
}

// Hide words in the picker -> blanks on the paper -> answers in the key.
export function FigBlanks() {
  return (
    <Fig w={720} h={330} label="Tap words in the picker. On the paper they become blank lines. In the answer key they are filled in.">
      <Card x="8" y="10" w="220" h="300" r="18" />
      <Txt x="24" y="38" size="13" weight="800">Hide words to fill in</Txt>
      <rect x="22" y="48" width="192" height="28" rx="8" fill={C.amberLight} stroke="#fcd34d" /><Txt x="118" y="66" size="11" weight="700" anchor="middle" fill="#92400e">2 words hidden · 6 in all</Txt>
      <rect x="22" y="88" width="192" height="104" rx="12" fill="#fff" stroke="#fcd34d" strokeWidth="2" />
      <foreignObject x="26" y="92" width="184" height="98"><div className="quran-scope qf-mushaf" style={{ fontSize: 24, lineHeight: 1.7, textAlign: 'center', direction: 'rtl' }}><QuranRun token={tok(112, 1, 2, [])} onWord={() => {}} marked={new Set([4, 6])} /></div></foreignObject>
      <Badge x="226" y="30" n={1} />
      <Txt x="118" y="222" size="12" weight="500" fill={C.slate} anchor="middle">Tap a word to hide it.</Txt>
      <Txt x="118" y="240" size="12" weight="500" fill={C.slate} anchor="middle">Tap again to show it.</Txt>
      <Txt x="118" y="266" size="11" weight="700" fill={C.brand} anchor="middle">Quick tools: every 2nd word,</Txt>
      <Txt x="118" y="282" size="11" weight="700" fill={C.brand} anchor="middle">last 3 words, second half…</Txt>
      <Arrow d="M236 150h34" />
      <Page x="278" y="10" w="200" h="300">
        <Txt x="294" y="44" size="12" weight="800" fill={C.ink}>Q1. Fill in the blanks:</Txt>
        <line x1="294" x2="388" y1="48" y2="48" stroke="#111" />
        <Q x="288" y="58" w="180" h="100" token={tok(112, 1, 2, [4, 6])} size={22} />
        <Txt x="294" y="190" size="10" weight="700" fill={C.mute}>Word bank</Txt>
        <rect x="292" y="196" width="172" height="26" rx="3" fill="#f9fafb" stroke="#111" />
        <foreignObject x="294" y="198" width="168" height="24"><div className="quran-scope qf-mushaf" style={{ fontSize: 15, textAlign: 'center', direction: 'rtl', lineHeight: 1.6 }}><span className="quran">أَحَدٌ &nbsp; ٱلصَّمَدُ</span></div></foreignObject>
        <Bars x="294" y="240" w={160} rows={[1, .7]} />
      </Page>
      <Badge x="470" y="30" n={2} />
      <Arrow d="M486 150h30" />
      <Page x="522" y="10" w="190" h="300">
        <Txt x="536" y="44" size="12" weight="800">Answer key</Txt>
        <line x1="536" x2="600" y1="48" y2="48" stroke="#111" />
        <Q x="530" y="58" w="172" h="100" token={tok(112, 1, 2, [4, 6])} size={21} reveal />
        <Bars x="536" y="190" w={150} rows={[.9, .6]} />
      </Page>
      <Badge x="704" y="30" n={3} />
    </Fig>
  );
}

// An ayah in a heading, a table cell and multiple-choice options.
export function FigAnywhere() {
  return (
    <Fig w={720} h={440} label="Ayat can sit in a question heading, in a table cell, in multiple-choice options and in a fill-in-the-blanks sentence">
      <Page x="150" y="8" w="420" h="424">
        <Txt x="172" y="40" size="13" weight="800">Q1.</Txt>
        <Txt x="198" y="40" size="13" weight="800">Translate:</Txt><line x1="198" x2="258" y1="44" y2="44" stroke="#111" />
        <Q x="264" y="14" w="290" h="40" token={tok(1, 2)} size={21} align="right" />
        <Lines x="172" y="72" w="380" n={2} />
        <Txt x="172" y="118" size="13" weight="800">Q2.</Txt><Txt x="198" y="118" size="13" weight="800">Complete the table:</Txt><line x1="198" x2="320" y1="122" y2="122" stroke="#111" />
        <rect x="172" y="130" width="380" height="84" fill="none" stroke="#111" />
        <line x1="172" x2="552" y1="158" y2="158" stroke="#111" /><line x1="172" x2="552" y1="186" y2="186" stroke="#111" /><line x1="362" x2="362" y1="130" y2="214" stroke="#111" />
        <rect x="172" y="130" width="380" height="28" fill="#f3f4f6" />
        <Txt x="267" y="149" size="12" weight="800" anchor="middle">Ayah</Txt><Txt x="457" y="149" size="12" weight="800" anchor="middle">Meaning</Txt>
        <Q x="176" y="158" w="182" h="28" token={tok(112, 1)} size={15} />
        <Q x="176" y="186" w="182" h="28" token={tok(112, 2)} size={15} />
        <Lines x="380" y="176" w="160" n={1} /><Lines x="380" y="204" w="160" n={1} />
        <Txt x="172" y="244" size="13" weight="800">Q3.</Txt><Txt x="198" y="244" size="13" weight="800">Choose the correct ayah:</Txt><line x1="198" x2="352" y1="248" y2="248" stroke="#111" />
        {[tok(112, 1), tok(112, 2), tok(112, 3)].map((t, i) => (
          <g key={i}><circle cx="188" cy={272 + i * 30} r="7" fill="none" stroke="#111" strokeWidth="2" /><Q x="200" y={256 + i * 30} w="330" h="34" token={t} size={18} align="left" /></g>
        ))}
        <Txt x="172" y="392" size="12.5" weight="500">4)  The surah of Ikhlas has ________ ayat.</Txt>
      </Page>
      <Badge x="140" y="40" n={1} /><Txt x="132" y="76" size="12" weight="800" anchor="end">Heading</Txt>
      <Badge x="140" y="150" n={2} /><Txt x="132" y="186" size="12" weight="800" anchor="end">Table cell</Txt>
      <Badge x="140" y="272" n={3} /><Txt x="132" y="308" size="12" weight="800" anchor="end">Options</Txt>
      <foreignObject x="582" y="30" width="136" height="300"><div style={{ fontSize: 12, lineHeight: 1.45, color: C.slate, fontWeight: 500 }}><b style={{ color: C.ink }}>Every</b> text box has a small <b style={{ color: C.brand }}>book button</b>. Tap it to put an ayah right where your cursor is — in any question, option, cell or answer.</div></foreignObject>
    </Fig>
  );
}

// Fonts and colours.
export function FigStyle() {
  const t = tok(1, 1);
  return (
    <Fig w={720} h={250} label="The same ayah in the Mushaf font with tajweed colours, in the clear Naskh font, and in black and white">
      {[['Mushaf + tajweed colours', 'mushaf', false], ['Clear Naskh + colours', 'naskh', false], ['Mushaf, black & white', 'mushaf', true]].map(([label, font, plain], i) => {
        const x = 8 + i * 238;
        return (
          <g key={label}>
            <Card x={x} y="14" w="226" h="190" r="16" />
            <foreignObject x={x + 6} y="22" width="214" height="150"><div className={`quran-scope qf-${font} ${plain ? 'q-plain' : ''}`} style={{ fontSize: 28, lineHeight: 1.9, textAlign: 'center', direction: 'rtl', color: C.ink }}><QuranRun token={t} /></div></foreignObject>
            <Txt x={x + 113} y="226" size="12.5" weight="800" anchor="middle">{label}</Txt>
          </g>
        );
      })}
      <Txt x="360" y="246" size="11.5" weight="500" fill={C.slate} anchor="middle">Change it in Page style → Quran text (ayat). Choose black & white when your school prints without colour.</Txt>
    </Fig>
  );
}

// Question page and key.
export function FigKey() {
  return (
    <Fig w={720} h={356} label="A question page with blank lines next to its answer key page with the answers filled in">
      <Page x="40" y="10" w="270" h="310">
        <Txt x="58" y="42" size="13" weight="800">Q1. Complete the ayah:</Txt><line x1="58" x2="190" y1="46" y2="46" stroke="#111" />
        <Q x="52" y="54" w="246" h="90" token={tok(1, 1, 1, [2, 3])} size={23} />
        <Txt x="58" y="176" size="13" weight="800">Q2. Who is “Ar-Rahman”?</Txt><Lines x="58" y="200" w="236" n={3} gap={18} />
      </Page>
      <Arrow d="M322 160h46" />
      <Txt x="345" y="150" size="11.5" weight="800" fill={C.brand} anchor="middle">Answers</Txt>
      <Page x="380" y="10" w="270" h="310">
        <Txt x="398" y="42" size="13" weight="800">Answer key</Txt><line x1="398" x2="470" y1="46" y2="46" stroke="#111" />
        <Txt x="398" y="72" size="13" weight="800">Q1.</Txt>
        <Q x="392" y="76" w="246" h="90" token={tok(1, 1, 1, [2, 3])} size={23} reveal />
        <Txt x="398" y="196" size="13" weight="800">Q2.</Txt>
        <rect x="428" y="182" width="190" height="20" rx="3" fill={C.amberLight} /><Txt x="436" y="197" size="12" weight="800" fill="#92400e">A name of Allah, the Most Merciful.</Txt>
      </Page>
      <Badge x="52" y="338" n={1} /><Txt x="72" y="342" size="11.5" weight="600" fill={C.slate}>Students see lines</Txt>
      <Badge x="392" y="338" n={2} /><Txt x="412" y="342" size="11.5" weight="600" fill={C.slate}>You get every answer</Txt>
    </Fig>
  );
}

// The three page presets.
export function FigPageStyle() {
  const items = [['Full exam', 'Cover page with marks table'], ['Class test', 'Name strip, no cover page'], ['Simple sheet', 'Just the questions']];
  return (
    <Fig w={720} h={260} label="Three page styles: full exam with cover page, class test with a name strip, and a simple sheet with just the questions">
      {items.map(([t, d], i) => {
        const x = 20 + i * 232;
        return (
          <g key={t}>
            <Page x={x + 56} y="10" w="100" h="140">
              {i === 0 && <g><circle cx={x + 106} cy="38" r="9" fill={C.brand200} /><Bars x={x + 76} y="54" w={60} rows={[1, .7]} h={4} gap={8} /><rect x={x + 70} y="80" width="72" height="40" fill="none" stroke="#111" opacity=".5" /><line x1={x + 70} x2={x + 142} y1="92" y2="92" stroke="#111" opacity=".5" /><line x1={x + 70} x2={x + 142} y1="104" y2="104" stroke="#111" opacity=".5" /></g>}
              {i === 1 && <g><rect x={x + 68} y="22" width="76" height="22" fill="none" stroke="#111" opacity=".5" /><Bars x={x + 68} y="54" w={76} rows={[1, .8, 1, .6, .9, .7, 1, .5]} h={3.5} gap={8.5} /></g>}
              {i === 2 && <Bars x={x + 68} y="22" w={76} rows={[1, .8, 1, .6, .9, .7, 1, .5, .9, .8, .6]} h={3.5} gap={10} />}
            </Page>
            <Txt x={x + 106} y="182" size="14" weight="800" anchor="middle">{t}</Txt>
            <Txt x={x + 106} y="200" size="11.5" weight="500" fill={C.slate} anchor="middle">{d}</Txt>
          </g>
        );
      })}
      <Txt x="360" y="240" size="11.5" weight="500" fill={C.slate} anchor="middle">Open a paper → Page style → tap one. You can still change the border, footer and numbering.</Txt>
    </Fig>
  );
}

// Share a copy / work together.
export function FigShare() {
  const phone = (x, y, children) => (<g><rect x={x} y={y} width="170" height="250" rx="22" fill="#fff" stroke={C.ink} strokeWidth="3" filter="url(#sh)" /><rect x={x + 60} y={y + 8} width="50" height="6" rx="3" fill={C.line} />{children}</g>);
  return (
    <Fig w={720} h={300} label="Share a paper: you get a code, send it to a colleague, they enter it and get their own copy">
      {phone(30, 24, <g>
        <Txt x="115" y="78" size="12" weight="800" anchor="middle" fill={C.brand}>CODE</Txt>
        <rect x="48" y="90" width="134" height="52" rx="12" fill={C.brandLight} stroke={C.brand200} /><Txt x="115" y="126" size="24" weight="800" anchor="middle" letterSpacing="3">K7M-4QX</Txt>
        <Pill x="48" y="160" w="62" h="30" label="Copy" /><Pill x="116" y="160" w="66" h="30" label="Send" on />
        <Txt x="115" y="226" size="11" weight="600" fill={C.slate} anchor="middle">Your colleague</Txt><Txt x="115" y="242" size="11" weight="600" fill={C.slate} anchor="middle">gets their own copy</Txt>
      </g>)}
      <Arrow d="M214 150h122" />
      <Txt x="275" y="138" size="12" weight="800" fill={C.brand} anchor="middle">WhatsApp, SMS…</Txt>
      {phone(350, 24, <g>
        <Txt x="435" y="76" size="14" weight="800" anchor="middle">Enter a code</Txt>
        <rect x="368" y="92" width="134" height="40" rx="10" fill="#fff" stroke={C.brand} strokeWidth="2" /><Txt x="435" y="120" size="18" weight="800" anchor="middle" letterSpacing="2">K7M-4QX</Txt>
        <rect x="368" y="146" width="134" height="40" rx="12" fill={C.brand} /><Txt x="435" y="171" size="13" weight="800" anchor="middle" fill="#fff">Open</Txt>
        <rect x="368" y="200" width="134" height="30" rx="8" fill={C.soft} /><Txt x="435" y="220" size="11" weight="700" anchor="middle" fill={C.slate}>Save to my papers</Txt>
      </g>)}
      <foreignObject x="548" y="40" width="166" height="230"><div style={{ fontSize: 12, lineHeight: 1.5, color: C.slate, fontWeight: 500 }}><b style={{ color: C.ink, fontSize: 13 }}>Two ways to share</b><br /><br /><b style={{ color: C.brand }}>Share a copy</b> — a one-time copy. Changes afterwards stay separate.<br /><br /><b style={{ color: C.brand }}>Work together</b> — you and colleagues edit the same paper; each subject can have its own writer.</div></foreignObject>
    </Fig>
  );
}

// Menu -> feedback form -> the owner's inbox.
export function FigFeedback() {
  return (
    <Fig w={720} h={290} label="Open the menu, choose Send feedback, write your message and tap Send. It arrives with the app owner.">
      <Card x="14" y="14" w="190" h="262" r="20" />
      <Txt x="32" y="46" size="14" weight="800">Menu</Txt>
      {['Enter a code', 'School name & logo', 'App settings', 'Guide', 'Send feedback', 'Help & about'].map((l, i) => (
        <g key={l}><rect x="26" y={60 + i * 34} width="166" height="30" rx="9" fill={l === 'Send feedback' ? C.brandLight : '#fff'} stroke={l === 'Send feedback' ? C.brand : 'none'} strokeWidth="2" /><Txt x="38" y={80 + i * 34} size="12" weight={l === 'Send feedback' ? 800 : 600} fill={l === 'Send feedback' ? C.brand : C.ink}>{l}</Txt></g>
      ))}
      <Badge x="204" y="196" n={1} />
      <Arrow d="M214 200h34" />
      <Card x="256" y="14" w="230" h="262" r="20" />
      <Txt x="272" y="46" size="14" weight="800">Send feedback</Txt>
      <Pill x="272" y="58" w="100" label="Problem" on h="28" /><Pill x="378" y="58" w="96" label="Idea" h="28" />
      <rect x="272" y="98" width="198" height="92" rx="12" fill="#fff" stroke={C.line} /><Bars x="284" y="112" w={170} rows={[1, .9, .5]} gap={12} h={6} />
      <rect x="274" y="204" width="14" height="14" rx="3" fill={C.brand} /><Txt x="294" y="215" size="10.5" weight="600" fill={C.slate}>Include technical details</Txt>
      <rect x="272" y="228" width="198" height="34" rx="12" fill={C.brand} /><Txt x="371" y="250" size="13" weight="800" anchor="middle" fill="#fff">Send</Txt>
      <Badge x="270" y="14" n={2} /><Badge x="470" y="244" n={3} />
      <Arrow d="M494 150h34" />
      <Card x="536" y="14" w="170" h="262" r="20" />
      <circle cx="621" cy="92" r="30" fill={C.brand100} /><path d="M603 84l18 14 18-14M603 84h36v22h-36z" fill="none" stroke={C.brand} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <Txt x="621" y="152" size="13" weight="800" anchor="middle">It reaches us</Txt>
      <foreignObject x="548" y="162" width="146" height="100"><div style={{ fontSize: 11.5, lineHeight: 1.45, color: C.slate, textAlign: 'center', fontWeight: 500 }}>As an email and in the app’s own inbox. If we need more, we write back to your email.</div></foreignObject>
    </Fig>
  );
}

// A friendly hero for the What's new window.
export function ArtHero() {
  return (
    <svg viewBox="0 0 560 190" className="w-full h-auto" role="img" aria-label="A page with Quran ayat in tajweed colours and a blank to fill in" fontFamily={SANS}>
      <defs>
        <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#18625d" /><stop offset="1" stopColor="#072625" /></linearGradient>
        <filter id="hsh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000" floodOpacity="0.3" /></filter>
      </defs>
      <rect width="560" height="190" rx="24" fill="url(#hero)" />
      <circle cx="500" cy="20" r="90" fill="#27968b" opacity=".25" /><circle cx="40" cy="190" r="70" fill="#27968b" opacity=".18" />
      <rect x="150" y="26" width="260" height="190" rx="8" fill="#fff" filter="url(#hsh)" />
      <rect x="160" y="36" width="240" height="170" fill="none" stroke="#111" strokeWidth="1.5" opacity=".5" />
      <text x="174" y="62" fontSize="12" fontWeight="800" fill={C.ink}>Q1. Complete the ayah:</text>
      <foreignObject x="164" y="68" width="232" height="100"><div className="quran-scope qf-mushaf" style={{ fontSize: 25, lineHeight: 1.75, textAlign: 'center', direction: 'rtl', color: '#000' }}><QuranRun token={tok(1, 2, 2, [2, 3])} /></div></foreignObject>
    </svg>
  );
}
