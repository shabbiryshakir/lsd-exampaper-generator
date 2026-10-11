// Builds public/quran/quran.json, the offline Quran data the paper maker uses.
//
//   node scripts/build-quran.mjs <react-native-quran-tajweed dir> <@quran.ws/text data dir>
//
// Text + tajweed rules: react-native-quran-tajweed (MIT; text_uthmani_tajweed from the Quran.com API).
// Surah names:          @quran.ws/text hafs.json (CC BY 4.0).
// Each ayah is one string. A tajweed-coloured stretch is written \u0001<rule letters>\u0002<text>\u0003
// (rule letter = 'A' + index in `rules`); everything else is plain text.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [tajweedDir, hafsDir] = process.argv.slice(2);
if (!tajweedDir || !hafsDir) { console.error('usage: node scripts/build-quran.mjs <tajweed pkg dir> <quran.ws data dir>'); process.exit(1); }

const data = join(tajweedDir, 'src/data');
const { legend } = JSON.parse(readFileSync(join(data, 'index.json'), 'utf8'));
const hafs = JSON.parse(readFileSync(join(hafsDir, 'hafs.json'), 'utf8'));

const surahs = hafs.surahs.map((s) => {
  const file = JSON.parse(readFileSync(join(data, `surah_${String(s.number).padStart(3, '0')}.json`), 'utf8'));
  if (file.ayahs.length !== s.ayah_count) throw new Error(`ayah count mismatch in surah ${s.number}`);
  const ayahs = file.ayahs.map((a, i) => {
    if (a.ayah !== i + 1) throw new Error(`ayah order in surah ${s.number}`);
    return a.s.map(([text, rules]) => (rules.length ? `\u0001${rules.map((r) => String.fromCharCode(65 + r)).join('')}\u0002${text}\u0003` : text)).join('');
  });
  return { n: s.number, ar: s.name_ar, en: s.name_en, type: s.revelation === 'makki' ? 'M' : 'D', a: ayahs };
});

writeFileSync('public/quran/quran.json', JSON.stringify({ v: 1, rules: legend, surahs }));
console.log('wrote public/quran/quran.json', surahs.length, 'surahs', surahs.reduce((t, s) => t + s.a.length, 0), 'ayat');
