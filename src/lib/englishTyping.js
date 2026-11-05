// "Type in English, it turns into Lisan script" — the automatic part.
//
// In a Lisan box, when a word typed in English letters is finished (the teacher presses space, Enter or a
// punctuation mark) that word is replaced by its Lisan draft right away, and the caret stays where it was.
// The teacher can switch this off; the choice is remembered on this device.
import { useSyncExternalStore } from 'react';
import { draftLisan } from './lisanDraft';

const KEY = 'qalam.englishTyping';
const listeners = new Set();
let enabled = true; // on by default: the feature is useless if nobody finds it
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* private mode: keep the default */ }

export const setEnglishTyping = (on) => {
  enabled = !!on;
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* ignore */ }
  listeners.forEach((l) => l());
};
export const useEnglishTyping = () => useSyncExternalStore(
  (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
  () => enabled,
  () => true,
);

const BOUNDARY = /[\s.,;:!?)\]؟،؛]/;

/** The text has just been typed into (a character now sits before `caret`). If that character ends a word written
 *  in English letters, return the text with that word turned into Lisan and the new caret position; otherwise null.
 *  Words of one letter, anything inside a {{q …}} Quran token, and text that is not English are left alone. */
export function convertFinishedWord(text, caret) {
  const v = String(text ?? '');
  if (caret < 2 || caret > v.length || !BOUNDARY.test(v[caret - 1])) return null;
  const before = v.slice(0, caret - 1);
  if (before.lastIndexOf('{{') > before.lastIndexOf('}}')) return null; // inside a Quran token
  const m = /[A-Za-z&]+$/.exec(before);
  if (!m || (m[0].length < 2 && m[0] !== '&')) return null;
  const lisan = draftLisan(m[0]);
  if (!lisan) return null;
  const start = before.length - m[0].length;
  const head = v.slice(0, start) + lisan;
  return { value: head + v.slice(caret - 1), caret: head.length + 1, word: m[0], lisan };
}
