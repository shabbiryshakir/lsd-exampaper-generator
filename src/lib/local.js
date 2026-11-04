// On-device storage (IndexedDB): auto-saved drafts and version history.
// Nothing here needs the internet, and it survives the app being closed.
import { get, set, del } from 'idb-keyval';

const MAX_VERSIONS = 20;

// The draft is the latest state of the paper being edited, written a second after every change.
// { paperId, data: {header, subjects, layout}, unsynced, isNew, meta }
export const saveDraft = (draft) => set('draft', { ...draft, savedAt: Date.now() }).catch(() => {});
export const loadDraft = () => get('draft').catch(() => null);
export const clearDraft = () => del('draft').catch(() => {});

// Version history per paper: newest first, a snapshot at most every few minutes.
export async function addVersion(paperKey, data, minGapMs = 3 * 60 * 1000) {
  try {
    const key = `versions:${paperKey}`;
    const list = (await get(key)) || [];
    const json = JSON.stringify(data);
    if (list[0] && (list[0].json === json || Date.now() - list[0].at < minGapMs)) {
      if (list[0].json !== json) list[0] = { at: Date.now(), json };
    } else {
      list.unshift({ at: Date.now(), json });
    }
    await set(key, list.slice(0, MAX_VERSIONS));
  } catch { /* storage unavailable: history is a nice-to-have */ }
}
export const listVersions = async (paperKey) => { try { return (await get(`versions:${paperKey}`)) || []; } catch { return []; } };
