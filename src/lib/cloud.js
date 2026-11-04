// Sharing and working together.
//   shares/{CODE}  — a copy of a paper or template anyone with the code can open and save.
//   invites/{CODE} — lets a colleague join a paper; members edit the same questions together.
// Papers keep `userId` (owner) and `members` (everyone who can edit, owner included).
import { db } from '../firebase'
import { toCloud, fromCloud } from './paper'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore'

// No 0/O or 1/I, so codes are easy to read out loud and type.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = (n = 6) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => ALPHABET[b % ALPHABET.length]).join('');
export const cleanCode = (s) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/O/g, '0').slice(0, 12);
export const prettyCode = (c) => (c && c.length === 6 ? `${c.slice(0, 3)}-${c.slice(3)}` : c || '');

const who = (user) => ({ name: user.displayName || user.email || 'Teacher', email: user.email || '' });

const freshCode = async (collectionName) => {
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    if (!(await getDoc(doc(db, collectionName, code))).exists()) return code;
  }
  throw new Error('Could not create a code, please try again.');
};

// ---- share a copy ----
export async function createShare(user, { kind, title, data, existingCode }) {
  const code = existingCode || await freshCode('shares');
  await setDoc(doc(db, 'shares', code), { kind, title, data: toCloud(JSON.parse(JSON.stringify(data))), ownerId: user.uid, ownerName: who(user).name, updatedAt: new Date().toISOString() });
  return code;
}
export const deleteShare = (code) => deleteDoc(doc(db, 'shares', code));

// ---- work together ----
export async function createInvite(user, paperId, title) {
  const code = await freshCode('invites');
  await setDoc(doc(db, 'invites', code), { paperId, ownerId: user.uid, ownerName: who(user).name, title, createdAt: new Date().toISOString() });
  await setDoc(doc(db, 'papers', paperId), { inviteCode: code, members: arrayUnion(user.uid), memberInfo: { [user.uid]: who(user) } }, { merge: true });
  return code;
}
export async function stopInvite(paperId, code) {
  await updateDoc(doc(db, 'papers', paperId), { inviteCode: null });
  await deleteDoc(doc(db, 'invites', code)).catch(() => {});
}

// Looks a code up as a shared copy first, then as an invitation.
export async function lookupCode(raw) {
  const code = cleanCode(raw);
  if (code.length < 6) return null;
  const share = await getDoc(doc(db, 'shares', code));
  if (share.exists()) return fromCloud({ type: 'share', code, ...share.data() });
  const invite = await getDoc(doc(db, 'invites', code));
  if (invite.exists()) return { type: 'invite', code, ...invite.data() };
  return null;
}

export async function joinPaper(user, invite) {
  if (invite.ownerId === user.uid) return invite.paperId;
  await updateDoc(doc(db, 'papers', invite.paperId), { members: arrayUnion(user.uid), [`memberInfo.${user.uid}`]: who(user), joinCode: invite.code });
  return invite.paperId;
}
export const leavePaper = (paperId, uid) => updateDoc(doc(db, 'papers', paperId), { members: arrayRemove(uid), [`memberInfo.${uid}`]: deleteField() });
