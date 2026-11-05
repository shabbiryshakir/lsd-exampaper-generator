// English → Lisan ud-Dawat DRAFT for people who can't type Arabic script.
// Ported from the IzanVite invitation maker (lib/lisan-draft.ts) so both tools spell the same way.
//
// It is a starting point, never an authority: common names and words come from a small dictionary,
// everything else is spelled out phonetically. The teacher always sees the result in an editable box and
// checks the spelling. Pure functions, no dependencies. Add words to WORDS as you meet them.

export const WORDS = {
  // people
  murtaza: 'مرتضى', fatema: 'فاطمة', fatima: 'فاطمة', husain: 'حسين', hussain: 'حسين', hasan: 'حسن', hassan: 'حسن',
  ali: 'علي', abbas: 'عباس', zainab: 'زينب', sakina: 'سكينة', sakinah: 'سكينة', huzaifa: 'حذيفة', huzefa: 'حذيفة',
  shabbir: 'شبير', taher: 'طاهر', tahir: 'طاهر', mustafa: 'مصطفى', mohammed: 'محمد', mohammad: 'محمد', muhammad: 'محمد',
  yusuf: 'يوسف', ibrahim: 'ابراهيم', ismail: 'اسماعيل', idris: 'ادريس', hatim: 'حاتم', khuzaima: 'خزيمة',
  mufaddal: 'مفضل', saifuddin: 'سيف الدين', burhanuddin: 'برهان الدين', qutbuddin: 'قطب الدين', fakhruddin: 'فخر الدين',
  aliasgar: 'علي اصغر', aliakbar: 'علي اكبر', ammar: 'عمار', juzer: 'جزر', quresh: 'قريش', aziz: 'عزيز',
  tasneem: 'تسنيم', rashida: 'رشيدة', insiya: 'انسية', arwa: 'اروى', nafisa: 'نفيسة', batool: 'بتول', rukaiya: 'رقية',
  rukaiyah: 'رقية', maria: 'مارية', zahra: 'زهراء', sarrah: 'سارة', sara: 'سارة', sarah: 'سارة', amatullah: 'امة الله',
  umme: 'ام', kulsum: 'كلثوم', munira: 'منيرة', nuqayya: 'نقية', alefiya: 'اليفية', shirin: 'شيرين',
  shakir: 'شاكر', kapadia: 'كپاڈيا',
  // titles & joiners
  bhai: 'بھائي', bhen: 'بھن', bhaisaheb: 'بھائي صاحب', saheb: 'صاحب', mulla: 'ملا', shaikh: 'شيخ', sheikh: 'شيخ',
  and: 'و', '&': 'و', family: 'عائلة', of: 'نا',
  // occasions
  shitabi: 'شتابي', darees: 'دريس', waras: 'ورس', shadi: 'شادي', shaadi: 'شادي', walima: 'وليمة', majlis: 'مجلس',
  mubarak: 'مبارك',
};

// Spellings teachers taught the app (shared dictionary in Firestore + this device). They win over WORDS.
let LEARNED = {};
export const setLearnedWords = (map) => { LEARNED = { ...map }; };
export const learnedWord = (key) => LEARNED[String(key).toLowerCase()];
/** The draft for one English word, and where it came from: 'learned', 'dictionary' or 'guess'. */
export function draftWord(word) {
  const key = String(word ?? '').toLowerCase().replace(/[^a-z&]/g, '');
  if (!key) return { key, lisan: '', source: 'guess' };
  if (LEARNED[key]) return { key, lisan: LEARNED[key], source: 'learned' };
  if (WORDS[key]) return { key, lisan: WORDS[key], source: 'dictionary' };
  return { key, lisan: phonetic(key), source: 'guess' };
}

const DIGRAPHS = [
  ['sh', 'ش'], ['kh', 'خ'], ['gh', 'غ'], ['ch', 'چ'], ['th', 'ت'], ['dh', 'ذ'], ['zh', 'ژ'], ['ph', 'ف'],
  ['bh', 'بھ'], ['jh', 'جھ'],
  ['aa', 'ا'], ['ee', 'ي'], ['ii', 'ي'], ['oo', 'و'], ['ou', 'و'], ['ai', 'ي'], ['ay', 'ي'], ['ei', 'ي'],
];

const LETTERS = {
  b: 'ب', p: 'پ', t: 'ت', j: 'ج', d: 'د', r: 'ر', z: 'ز', s: 'س', f: 'ف', q: 'ق', k: 'ك', c: 'ك', g: 'گ',
  l: 'ل', m: 'م', n: 'ن', h: 'ه', w: 'و', v: 'و', y: 'ي', x: 'كس',
};

/** One word, spelled out: consonants and long vowels are written, short vowels inside a word are dropped
 *  (as Lisan writes them), an opening vowel takes an alif, a closing "a" becomes ه and a closing "i/e/y" becomes ي. */
function phonetic(word) {
  const w = word.toLowerCase();
  let out = '';
  let i = 0;
  while (i < w.length) {
    const dg = DIGRAPHS.find(([k]) => k === w.slice(i, i + 2));
    if (dg) { out += dg[1]; i += 2; continue; }
    const ch = w[i];
    const first = i === 0, last = i === w.length - 1;
    if ('aeiou'.includes(ch)) {
      if (first) out += 'ا';
      else if (last) out += ch === 'a' ? 'ه' : ch === 'i' || ch === 'e' ? 'ي' : 'و';
      else if (ch === 'o' || ch === 'u') out += 'و';
      i += 1;
      continue;
    }
    out += LETTERS[ch] ?? '';
    i += 1;
  }
  return out;
}

/** Draft Lisan for a line of English (names, titles, short phrases). Keeps line breaks; drops punctuation it can't place. */
export function draftLisan(english) {
  return String(english ?? '')
    .split('\n')
    .map((line) =>
      line
        .split(/\s+/)
        .map((raw) => raw.toLowerCase().replace(/[^a-z&]/g, ''))
        .filter((key) => key && key !== 'the')
        .map((key) => LEARNED[key] ?? WORDS[key] ?? phonetic(key))
        .filter(Boolean)
        .join(' '))
    .join('\n');
}

// Quran tokens such as {{q 2:255 b=3}} contain Latin letters that must never be touched.
const TOKEN_SPLIT = /(\{\{[^}]*\}\})/;

/** Converts only the English words in a text, keeping any Lisan script, numbers, blanks (*) and Quran tokens
 *  already there — so a teacher can type "Murtaza bhai" straight into a Lisan box and convert it in one tap. */
export function draftLisanInPlace(text) {
  return String(text ?? '')
    .split(TOKEN_SPLIT)
    .map((chunk, i) => (i % 2 ? chunk : chunk
      .split('\n')
      .map((line) => line.replace(/[A-Za-z&][A-Za-z&'.\s-]*/g, (run) => {
        const lead = /^\s*/.exec(run)[0], trail = /\s*$/.exec(run)[0];
        const d = draftLisan(run.trim());
        return d ? lead + d + trail : run;
      }))
      .join('\n')))
    .join('');
}

/** Does this text hold English words that could be converted (outside Quran tokens)? */
export const hasEnglish = (text) => String(text ?? '').split(TOKEN_SPLIT).some((chunk, i) => i % 2 === 0 && /[A-Za-z]{2,}/.test(chunk));
