// The shared English → Lisan dictionary that grows as teachers correct spellings.
//
// Firestore `lisanWords/{englishWord}` = { en, lisan, by, byName, updatedAt }. Every signed-in teacher reads
// it and can add or correct a word (see firestore.rules); the admin can delete. A copy is kept on this device
// so the converter and the editor work offline, and so a teacher's own corrections work even before they reach
// the cloud.
import { db } from '../firebase'
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore'
import { setLearnedWords } from './lisanDraft'
import { logEvent } from './activity'

const KEY = 'qalam.lisanWords';
const MINE = 'qalam.lisanWords.mine';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full or blocked */ } };

let shared = read(KEY);
let mine = read(MINE);
const apply = () => setLearnedWords({ ...shared, ...mine });
apply();

export const cleanKey = (w) => String(w ?? '').toLowerCase().replace(/[^a-z&]/g, '');

/** Loads the shared dictionary (call once after sign-in). Returns the number of words. */
export async function loadDictionary() {
  try {
    const snap = await getDocs(collection(db, 'lisanWords'));
    shared = {};
    snap.forEach((d) => { const x = d.data(); if (x?.lisan) shared[d.id] = x.lisan; });
    write(KEY, shared);
    // Words now in the cloud no longer need the device copy.
    Object.keys(mine).forEach((k) => { if (shared[k] === mine[k]) delete mine[k]; });
    write(MINE, mine);
    apply();
  } catch (e) { console.warn('Dictionary not loaded', e?.code || e); }
  return Object.keys({ ...shared, ...mine }).length;
}

/** Saves a corrected spelling for everyone. Always works on this device; returns true if it reached the cloud. */
export async function teachWord(user, english, lisan) {
  const en = cleanKey(english), li = String(lisan ?? '').trim();
  if (!en || !li) return false;
  mine[en] = li; write(MINE, mine); apply();
  if (!user) return false;
  try {
    await setDoc(doc(db, 'lisanWords', en), { en, lisan: li, by: user.uid, byName: user.displayName || '', updatedAt: new Date().toISOString() });
    shared[en] = li; write(KEY, shared);
    logEvent('word_added', { en, lisan: li });
    return true;
  } catch (e) { console.warn('Word kept on this device only', e?.code || e); return false; }
}

export const listDictionary = async () => {
  const snap = await getDocs(collection(db, 'lisanWords'));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
};
export const forgetWord = async (en) => {
  delete mine[en]; write(MINE, mine); delete shared[en]; write(KEY, shared); apply();
  await deleteDoc(doc(db, 'lisanWords', en));
};

/** Everything the app knows (built-in words + every teacher's corrections), for use in other projects.
 *  JSON is a plain { english: lisan } map, the same shape as WORDS in IzanVite's lib/lisan-draft.ts. */
export async function exportDictionary(format = 'json') {
  const { WORDS } = await import('./lisanDraft');
  let cloud = [];
  try { cloud = await listDictionary(); } catch { /* offline: use the device copy */ }
  const rows = new Map(Object.entries(WORDS).map(([en, lisan]) => [en, { en, lisan, source: 'built-in', by: '', updatedAt: '' }]));
  Object.entries({ ...shared, ...mine }).forEach(([en, lisan]) => rows.set(en, { en, lisan, source: 'teacher', by: '', updatedAt: '' }));
  cloud.forEach((x) => rows.set(x.id, { en: x.id, lisan: x.lisan, source: 'teacher', by: x.byName || '', updatedAt: x.updatedAt || '' }));
  const list = [...rows.values()].sort((a, b) => a.en.localeCompare(b.en));
  const stamp = new Date().toISOString().slice(0, 10);
  let text, type, name;
  if (format === 'csv') {
    const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
    text = '﻿' + ['english,lisan,source,by,updated', ...list.map((r) => [r.en, r.lisan, r.source, r.by, r.updatedAt].map(q).join(','))].join('\n');
    type = 'text/csv'; name = `lisan-dictionary-${stamp}.csv`;
  } else {
    text = JSON.stringify(Object.fromEntries(list.map((r) => [r.en, r.lisan])), null, 2);
    type = 'application/json'; name = `lisan-dictionary-${stamp}.json`;
  }
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return list.length;
}
