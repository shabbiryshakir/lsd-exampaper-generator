import { useState, useEffect, useRef, useCallback, useDeferredValue, useMemo } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, getDocs, query, where, doc, deleteDoc, getDoc, setDoc, onSnapshot, runTransaction } from 'firebase/firestore'
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Editor from './components/Editor'
import PaperPreview from './components/PaperPreview'
import Icon from './components/Icon'
import { Wordmark, BrandMark } from './components/Brand'
import { BRAND, BUILD_TIME } from './lib/brand'
import { DEFAULT_SCHOOL_INFO, uid, LANGUAGES, langOf, defaultsFor, normalizeSubjects, normalizeHeader, normalizeLayout, paperSizeKb, cloneWithNewIds, pickPrint, answerStats, grandTotal } from './lib/paper'
import { downloadPdf, resizeImage } from './lib/pdf'
import { WHATS_NEW, LATEST_VERSION } from './lib/whatsNew'
import { saveDraft, loadDraft, clearDraft, addVersion, listVersions } from './lib/local'
import { BUILTIN_PAPER_TEMPLATES } from './lib/templates'
import { mergePaper } from './lib/merge'
import { createShare, deleteShare, createInvite, stopInvite, lookupCode, joinPaper, leavePaper, cleanCode, prettyCode } from './lib/cloud'

// Local-only demo mode (npm run dev, then open /?demo) to try the app without signing in.
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

const CLOUD_SAVE_DELAY = 6000;   // auto-save to the cloud this long after the last change
const LOCAL_SAVE_DELAY = 800;    // auto-save on the device almost immediately
const TRASH_DAYS = 30;

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked or full */ } },
  json: (k, fallback) => { try { const v = localStorage.getItem(k); return v && v !== 'undefined' ? JSON.parse(v) : fallback; } catch { return fallback; } },
};
const safeParse = (json) => { try { return json ? JSON.parse(json) : null; } catch { return null; } };
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const DEFAULT_APP_SETTINGS = { uiSize: 'normal', defaultLanguage: 'lsd', defaultLayout: null };
const UI_ZOOM = { normal: 1, large: 1.12, xlarge: 1.25 };
const timeAgo = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const firstName = (n) => (n || '').trim().split(/\s+/)[0] || 'Teacher';
const initials = (n) => (n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const codeLink = (code) => `${window.location.origin}${import.meta.env.BASE_URL}?code=${code}`;

// What the editor shows for a saved paper: shared content + this teacher's own print settings.
const contentOf = (paper, myUid) => ({
  header: normalizeHeader(paper.header),
  subjects: normalizeSubjects(paper.subjects),
  layout: normalizeLayout({ ...(paper.layout || {}), ...((paper.printPrefs || {})[myUid] || {}) }),
});
const metaOf = (paper) => ({
  ownerId: paper.userId, members: paper.members || [], memberInfo: paper.memberInfo || {},
  inviteCode: paper.inviteCode || null, shareCodes: paper.shareCodes || {}, authorName: paper.authorName || '',
});

const useMedia = (q) => {
  const [m, setM] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [q]);
  return m;
};

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const Modal = ({ title, onClose, children, footer, wide }) => (
  <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center print:hidden anim-fade" onClick={onClose}>
    <div className={`bg-white w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col anim-sheet`} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 sm:hidden" />
      <div className="flex justify-between items-center px-5 pt-3 sm:pt-5 pb-2">
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-slate-100 text-slate-500 flex items-center justify-center"><Icon name="X" /></button>
      </div>
      <div className="px-5 pb-5 overflow-y-auto" style={{ paddingBottom: footer ? undefined : 'max(1.25rem, env(safe-area-inset-bottom))' }}>{children}</div>
      {footer && <div className="px-5 pt-3 border-t border-slate-100" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>{footer}</div>}
    </div>
  </div>
);

const MenuItem = ({ icon, label, onClick, dot, danger, hint }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-2 py-3 rounded-2xl hover:bg-slate-50 active:bg-slate-100 text-left ${danger ? 'text-red-600' : 'text-slate-800'}`}>
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-slate-100 text-slate-600'}`}><Icon name={icon} size={20} /></span>
    <span className="flex-1 min-w-0"><span className="block text-base font-semibold">{label}</span>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span>
    {dot && <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />}
  </button>
);

const NavButton = ({ icon, label, active, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={`flex-1 flex flex-col items-center justify-center gap-0.5 pt-2 pb-1.5 disabled:opacity-40 ${active ? 'text-brand-700' : 'text-slate-500'}`}>
    <span className={`h-8 w-14 rounded-full flex items-center justify-center transition ${active ? 'bg-brand-100' : ''}`}><Icon name={icon} size={22} strokeWidth={active ? 2.4 : 2} /></span>
    <span className="text-[11px] font-bold">{label}</span>
  </button>
);

const IconButton = ({ icon, label, onClick, disabled, className = '' }) => (
  <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`w-11 h-11 rounded-full hover:bg-slate-100 text-slate-700 flex items-center justify-center disabled:opacity-30 shrink-0 ${className}`}><Icon name={icon} size={22} /></button>
);

const PrimaryBtn = ({ children, className = '', ...p }) => (
  <button {...p} className={`bg-brand-700 hover:bg-brand-800 active:bg-brand-900 text-white font-bold rounded-2xl inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 ${className}`}>{children}</button>
);
const SecondaryBtn = ({ children, className = '', ...p }) => (
  <button {...p} className={`bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold rounded-2xl inline-flex items-center justify-center gap-2 disabled:opacity-50 ${className}`}>{children}</button>
);

const Avatar = ({ name, size = 32, ring = false }) => (
  <span className={`rounded-full bg-brand-100 text-brand-800 font-bold inline-flex items-center justify-center shrink-0 ${ring ? 'ring-2 ring-white' : ''}`} style={{ width: size, height: size, fontSize: size * 0.38 }} title={name}>{initials(name)}</span>
);

// A big, easy-to-read code with copy and send buttons.
function CodeCard({ code, title, text, onToast }) {
  const link = codeLink(code);
  const copy = async (value, msg) => { try { await navigator.clipboard.writeText(value); onToast(msg); } catch { window.prompt('Copy this:', value); } };
  const share = async () => {
    if (!navigator.share) return copy(link, 'Link copied');
    try { await navigator.share({ title, text: `${text}\nCode: ${prettyCode(code)}`, url: link }); }
    catch (e) { if (e?.name !== 'AbortError') copy(link, 'Link copied'); }
  };
  return (
    <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-100 rounded-3xl p-5 text-center">
      <div className="text-xs font-bold uppercase tracking-widest text-brand-700 mb-2">Code</div>
      <div className="font-mono font-bold text-4xl sm:text-5xl tracking-[0.15em] text-slate-900 select-all" dir="ltr">{prettyCode(code)}</div>
      <div className="grid grid-cols-2 gap-2 mt-5">
        <SecondaryBtn onClick={() => copy(prettyCode(code), 'Code copied')} className="py-3"><Icon name="Copy" size={18} />Copy code</SecondaryBtn>
        <PrimaryBtn onClick={share} className="py-3"><Icon name={navigator.share ? 'Share2' : 'Link'} size={18} />{navigator.share ? 'Send' : 'Copy link'}</PrimaryBtn>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading'); // loading | login | dashboard | editor | preview | shared
  const [previewMode, setPreviewMode] = useState('paper'); // paper | key
  const [savedPapers, setSavedPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [syncState, setSyncState] = useState('idle'); // idle | saving | saved | offline | error
  const [pdfProgress, setPdfProgress] = useState(null);
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [isNewPaper, setIsNewPaper] = useState(false);
  const [paperMeta, setPaperMeta] = useState({ ownerId: null, members: [], memberInfo: {}, inviteCode: null, shareCodes: {} });
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | shared
  const [activeId, setActiveId] = useState(null);
  const [showAnswers, setShowAnswers] = useState(() => store.get('showAnswers') === '1');
  const [pageCount, setPageCount] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installEvent, setInstallEvent] = useState(null);
  const [seenVersion, setSeenVersion] = useState(() => store.get('seenVersion'));
  const [installDismissed, setInstallDismissed] = useState(() => store.get('installDismissed') === '1');
  const [templates, setTemplates] = useState(() => store.json('templates', []));
  const [appSettings, setAppSettings] = useState(() => ({ ...DEFAULT_APP_SETTINGS, ...store.json('appSettings', {}) }));
  const [recoverDraft, setRecoverDraft] = useState(null);
  const [versions, setVersions] = useState([]);
  const [codeInput, setCodeInput] = useState('');
  const [codeResult, setCodeResult] = useState(null); // looked-up share/invite
  const [codeBusy, setCodeBusy] = useState(false);
  const [shownCode, setShownCode] = useState(null);   // { code, title, text, kind }
  const [sharedView, setSharedView] = useState(null); // a shared paper being looked at
  const [panelWidth, setPanelWidth] = useState(600);
  const pagesRef = useRef(null);
  const panelRef = useRef(null);
  const toastTimer = useRef(null);
  const wide = useMedia('(min-width: 1280px)');

  // Updates install by themselves: check when the app opens, when it comes back to the
  // foreground, and every 30 minutes; the new version takes over on the next reload.
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => { if (navigator.onLine) reg.update().catch(() => {}); };
      setInterval(check, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    },
  });

  const [schoolSettings, setSchoolSettings] = useState(() => store.json('schoolSettings', DEFAULT_SCHOOL_INFO));
  const [header, setHeader] = useState(() => defaultsFor('lsd').header);
  const [subjects, setSubjects] = useState(() => defaultsFor('lsd').subjects);
  const [layout, setLayout] = useState(() => defaultsFor('lsd').layout);

  // ---- change tracking ----
  const [savedSnapshot, setSavedSnapshotState] = useState(null);
  const savedRef = useRef(null);      // same as savedSnapshot, readable inside callbacks straight away
  const setSavedSnapshot = (v) => { savedRef.current = v; setSavedSnapshotState(v); };
  const snapshot = JSON.stringify({ header, subjects, layout });
  const latestRef = useRef(snapshot);
  latestRef.current = snapshot;
  const inPaper = appState === 'editor' || appState === 'preview';
  const isDirty = inPaper && savedSnapshot !== null && snapshot !== savedSnapshot;
  const hasNews = seenVersion !== LATEST_VERSION;
  const uiZoom = UI_ZOOM[appSettings.uiSize] || 1;
  const isOwner = !paperMeta.ownerId || paperMeta.ownerId === user?.uid;
  const members = (paperMeta.members || []).map(m => ({ uid: m, name: paperMeta.memberInfo?.[m]?.name || (m === user?.uid ? user?.displayName : 'Teacher') }));
  const isShared = members.length > 1;
  const split = wide && appState === 'editor';

  const showToast = (msg, kind = 'ok') => { setToast({ msg, kind }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2800); };

  // ---- undo / redo (typing within ~0.8s counts as one step) ----
  const history = useRef({ past: [], future: [], last: null, lastAt: 0, applying: false });
  useEffect(() => {
    const h = history.current;
    if (!inPaper) return;
    if (h.applying) { h.applying = false; h.last = snapshot; return; }
    if (h.last === null) { h.last = snapshot; return; }
    if (snapshot === h.last) return;
    const now = Date.now();
    if (now - h.lastAt > 800 || h.past.length === 0) h.past.push(h.last);
    if (h.past.length > 100) h.past.shift();
    h.future = [];
    h.last = snapshot;
    h.lastAt = now;
  }, [snapshot, inPaper]);
  const applyContent = (d) => { setHeader(d.header); setSubjects(d.subjects); setLayout(d.layout); };
  const applySnapshot = (json) => { history.current.applying = true; applyContent(JSON.parse(json)); };
  const undo = () => { const h = history.current; if (!h.past.length) return; h.future.push(h.last); applySnapshot(h.past.pop()); };
  const redo = () => { const h = history.current; if (!h.future.length) return; h.past.push(h.last); applySnapshot(h.future.pop()); };
  useEffect(() => {
    const onKey = (e) => {
      if (!inPaper || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Escape closes any open window.
  useEffect(() => {
    if (!modal) return;
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  // ---- environment listeners ----
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', onPrompt); };
  }, []);

  useEffect(() => {
    if (DEMO) {
      setUser({ uid: 'demo', displayName: 'Demo Teacher', email: 'demo@local' });
      setAppState('dashboard');
      import('./lib/demoPaper').then(m => { setSavedPapers([m.default, m.englishPaper]); setPapersLoading(false); });
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAppState(s => (s === 'loading' || s === 'login' ? 'dashboard' : s));
        loadUserDoc(currentUser.uid);
        loadUserPapers(currentUser.uid);
      } else { setUser(null); setAppState('login'); }
    });
    return () => unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember where the teacher is, so closing and reopening the app lands in the same place.
  useEffect(() => {
    if (appState === 'loading' || appState === 'login' || !restored.current) return;
    store.set('session', JSON.stringify(inPaper && currentPaperId ? { paperId: currentPaperId, view: appState, previewMode, activeId } : null));
  }, [appState, currentPaperId, previewMode, activeId, inPaper]);

  // On start-up: reopen the paper that was open, with any changes that never reached the cloud.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || appState !== 'dashboard' || papersLoading || !user) return;
    restored.current = true;
    const session = store.json('session', null);
    // Opened from a shared link (?code=…): look the code up straight away.
    const linkCode = cleanCode(new URLSearchParams(window.location.search).get('code'));
    if (linkCode) {
      window.history.replaceState(null, '', window.location.pathname);
      openCodeModal(linkCode);
    }
    loadDraft().then(d => {
      const draft = d && d.data && d.unsynced ? d : null;
      const wantedId = session?.paperId || null;
      const cloud = wantedId && savedPapers.find(p => p.id === wantedId && !p.deletedAt);
      const draftForIt = draft && draft.paperId === wantedId ? draft : null;
      const draftNewer = (dr, paper) => dr && (!paper || !paper.lastEdited || new Date(paper.lastEdited).getTime() < dr.savedAt);
      if (!linkCode && wantedId && (cloud || draftForIt)) {
        if (cloud) openSavedPaper(cloud); else loadIntoEditor(draftForIt.paperId, draftForIt.data, { isNew: true, meta: draftForIt.meta });
        if (draftNewer(draftForIt, cloud)) {
          history.current.applying = true;
          applyContent(draftForIt.data);
          if (!cloud) setSavedSnapshot('');
        }
        setAppState(session.view === 'preview' ? 'preview' : 'editor');
        setPreviewMode(session.previewMode === 'key' ? 'key' : 'paper');
        setActiveId(session.activeId || null);
        return;
      }
      if (draft && draftNewer(draft, savedPapers.find(p => p.id === draft.paperId))) setRecoverDraft(draft);
    });
  }, [appState, papersLoading, savedPapers, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) {
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, googleProvider);
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') { console.error(error); alert('Sign-in failed. Please check your internet connection and try again.'); }
    }
  };
  const handleLogout = async () => {
    if (!window.confirm('Sign out of this device?')) return;
    try { await signOut(auth); store.set('session', 'null'); setModal(null); setAppState('login'); } catch (error) { console.error(error); }
  };

  // ---- user document: school settings, app settings, templates ----
  const userDocWrite = (patch) => {
    if (!user || DEMO) return;
    setDoc(doc(db, 'users', user.uid), patch, { merge: true }).catch(error => console.error('Error saving user data:', error));
  };
  const loadUserDoc = async (userId) => {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.schoolSettings) { setSchoolSettings(d.schoolSettings); store.set('schoolSettings', JSON.stringify(d.schoolSettings)); }
      if (Array.isArray(d.templates)) { setTemplates(d.templates); store.set('templates', JSON.stringify(d.templates)); }
      if (d.appSettings) { const s = { ...DEFAULT_APP_SETTINGS, ...d.appSettings }; setAppSettings(s); store.set('appSettings', JSON.stringify(s)); }
    } catch (error) { console.error('Error loading user data:', error); }
  };
  const updateSchoolSettings = (s) => { setSchoolSettings(s); store.set('schoolSettings', JSON.stringify(s)); };
  const updateAppSettings = (patch) => {
    const s = { ...appSettings, ...patch };
    setAppSettings(s); store.set('appSettings', JSON.stringify(s));
    userDocWrite({ appSettings: s });
  };
  const updateTemplates = (list) => {
    if (paperSizeKb({ templates: list, schoolSettings }) > 900) { alert('Your templates are full. Please delete some old templates (pictures take a lot of space).'); return false; }
    setTemplates(list); store.set('templates', JSON.stringify(list));
    userDocWrite({ templates: list });
    return true;
  };
  const saveTemplate = (t, msg = 'Saved to your templates') => {
    const { builtin, ...rest } = t; // eslint-disable-line no-unused-vars
    if (updateTemplates([{ ...rest, id: uid(), createdAt: new Date().toISOString(), data: JSON.parse(JSON.stringify(t.data)) }, ...templates])) showToast(msg);
  };
  const deleteTemplate = (id) => updateTemplates(templates.filter(t => t.id !== id));

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { updateSchoolSettings({ ...schoolSettings, logo: await resizeImage(file) }); }
    catch { alert('Could not read that image. Please try a PNG or JPG.'); }
  };
  const closeSettings = () => { setModal(null); userDocWrite({ schoolSettings }); };

  // ---- papers: the teacher's own, plus papers colleagues invited them to ----
  const loadUserPapers = async (userId) => {
    try {
      const col = collection(db, 'papers');
      const [own, joined] = await Promise.all([
        getDocs(query(col, where('userId', '==', userId))),
        getDocs(query(col, where('members', 'array-contains', userId))).catch(() => null),
      ]);
      const byId = new Map();
      [own, joined].forEach(snap => snap?.forEach(d => byId.set(d.id, { id: d.id, ...d.data() })));
      const papers = [...byId.values()].sort((a, b) => (b.lastEdited || '').localeCompare(a.lastEdited || ''));
      // Empty the trash of anything older than 30 days.
      const cutoff = Date.now() - TRASH_DAYS * 86400000;
      const expired = (p) => p.deletedAt && new Date(p.deletedAt).getTime() < cutoff;
      papers.filter(p => expired(p) && p.userId === userId).forEach(p => deleteDoc(doc(db, 'papers', p.id)).catch(() => {}));
      setSavedPapers(papers.filter(p => !expired(p)));
    } catch (error) { console.error('Error loading papers:', error); }
    setPapersLoading(false);
  };

  const cloudSave = useCallback(async ({ manual = false } = {}) => {
    if (!user || !currentPaperId) return;
    const thisSnapshot = latestRef.current;
    const content = JSON.parse(thisSnapshot);
    const ownerId = paperMeta.ownerId || user.uid;
    const payloadFor = (c) => ({
      userId: ownerId,
      header: c.header, subjects: c.subjects, layout: c.layout,
      printPrefs: { [user.uid]: pickPrint(c.layout) },
      lastEdited: new Date().toISOString(),
      lastEditedBy: { uid: user.uid, name: user.displayName || '' },
      ...(isNewPaper ? { authorName: user.displayName || '', deletedAt: null } : {}),
    });
    if (paperSizeKb(payloadFor(content)) > 950) {
      setSyncState('error');
      if (manual) alert('This paper is too big to save online (pictures take a lot of space). It is kept on this device. Please remove a picture or use smaller ones.');
      return;
    }
    setSyncState('saving');
    const ref = doc(db, 'papers', currentPaperId);
    let written = content;
    try {
      if (!DEMO) {
        if (isShared && navigator.onLine) {
          // Several teachers: read the latest version, fold in their changes, then write — all at once.
          await runTransaction(db, async (tx) => {
            written = content;
            const snap = await tx.get(ref);
            if (snap.exists()) {
              const remote = contentOf(snap.data(), user.uid);
              const base = safeParse(savedRef.current);
              if (base && JSON.stringify(remote) !== savedRef.current) written = mergePaper(base, content, remote);
            }
            tx.set(ref, payloadFor(written), { merge: true });
          });
        } else {
          const write = setDoc(ref, payloadFor(content), { merge: true });
          // Offline: Firestore keeps the write on the device and uploads it automatically later.
          if (navigator.onLine) await write; else write.catch(err => console.error(err));
        }
      }
      const writtenJson = JSON.stringify(written);
      setSavedSnapshot(writtenJson);
      if (writtenJson !== thisSnapshot) {
        // Colleagues' changes came in: show them, keeping anything typed while saving.
        const now = latestRef.current;
        applyContent(now === thisSnapshot ? written : mergePaper(content, JSON.parse(now), written));
      }
      setIsNewPaper(false);
      setPaperMeta(m => ({ ...m, ownerId }));
      setSyncState(navigator.onLine || DEMO ? 'saved' : 'offline');
      setSavedPapers(list => {
        const old = list.find(p => p.id === currentPaperId) || {};
        return [{ ...old, id: currentPaperId, ...payloadFor(written), printPrefs: { ...(old.printPrefs || {}), [user.uid]: pickPrint(written.layout) }, members: paperMeta.members, memberInfo: paperMeta.memberInfo, deletedAt: old.deletedAt || null }, ...list.filter(p => p.id !== currentPaperId)];
      });
      saveDraft({ paperId: currentPaperId, data: written, unsynced: !navigator.onLine && !DEMO, meta: { ...paperMeta, ownerId } });
      addVersion(currentPaperId, written);
      if (manual) showToast(navigator.onLine || DEMO ? 'Saved' : 'Saved on this device — will upload when online');
    } catch (error) {
      console.error(error);
      setSyncState('error');
      if (manual) alert('Could not save online. Your work is safe on this device; we will keep trying.');
    }
  }, [user, currentPaperId, isNewPaper, paperMeta, isShared]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- auto-save: device first (fast), then cloud (a few seconds after typing stops) ----
  useEffect(() => {
    if (!inPaper || !currentPaperId || !isDirty) return;
    const local = setTimeout(() => saveDraft({ paperId: currentPaperId, data: JSON.parse(snapshot), unsynced: true, meta: paperMeta }), LOCAL_SAVE_DELAY);
    const cloud = setTimeout(() => cloudSave(), CLOUD_SAVE_DELAY);
    return () => { clearTimeout(local); clearTimeout(cloud); };
  }, [snapshot, inPaper, currentPaperId, isDirty, cloudSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save when the app is hidden (switching apps, locking the phone) and warn before closing with unsaved work.
  useEffect(() => {
    if (!isDirty) return;
    const onHide = () => { if (document.visibilityState === 'hidden') { saveDraft({ paperId: currentPaperId, data: JSON.parse(latestRef.current), unsynced: true, meta: paperMeta }); cloudSave(); } };
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', warn);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', warn); };
  }, [isDirty, currentPaperId, cloudSave, paperMeta]);

  // Retry once the connection comes back.
  useEffect(() => { if (online && isDirty && (syncState === 'offline' || syncState === 'error')) cloudSave(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates while a paper is open: colleagues' changes appear without reloading.
  useEffect(() => {
    if (!inPaper || !currentPaperId || isNewPaper || DEMO || !user) return;
    let first = true;
    return onSnapshot(doc(db, 'papers', currentPaperId), (snap) => {
      if (snap.metadata.hasPendingWrites || !snap.exists()) return;
      const d = snap.data();
      setPaperMeta(metaOf(d));
      const remote = contentOf(d, user.uid);
      const remoteJson = JSON.stringify(remote);
      const base = savedRef.current;
      const wasFirst = first;
      first = false;
      if (remoteJson === base || !base) return;
      const now = latestRef.current;
      applyContent(now === base ? remote : mergePaper(JSON.parse(base), JSON.parse(now), remote));
      setSavedSnapshot(remoteJson);
      if (!wasFirst && d.lastEditedBy?.uid && d.lastEditedBy.uid !== user.uid) showToast(`${firstName(d.lastEditedBy.name)} made changes`);
    }, (err) => console.warn('Live updates unavailable:', err?.code));
  }, [inPaper, currentPaperId, isNewPaper, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadIntoEditor = (id, content, { isNew = false, meta = null } = {}) => {
    const paperId = id || doc(collection(db, 'papers')).id;
    const c = { header: normalizeHeader(content.header), subjects: normalizeSubjects(content.subjects), layout: normalizeLayout(content.layout) };
    setCurrentPaperId(paperId);
    setIsNewPaper(isNew);
    setPaperMeta(meta || { ownerId: user?.uid, members: [], memberInfo: {}, inviteCode: null, shareCodes: {} });
    applyContent(c);
    // A brand-new paper only gets saved once the teacher changes something.
    setSavedSnapshot(JSON.stringify(c));
    history.current = { past: [], future: [], last: null, lastAt: 0, applying: false };
    setActiveId(null);
    setPageCount(null);
    setSyncState('idle');
    setPreviewMode('paper');
    setModal(null);
    setAppState('editor');
    window.scrollTo(0, 0);
  };

  // tpl: undefined (default language) | 'lsd' | 'en' | a built-in template ({build}) | a saved template ({data})
  const startPaper = (tpl) => {
    const lang = typeof tpl === 'string' ? tpl : appSettings.defaultLanguage;
    const savedStyle = appSettings.defaultLayout?.language === lang ? appSettings.defaultLayout : {};
    const d = !tpl || typeof tpl === 'string' ? defaultsFor(lang, savedStyle) : tpl.build ? tpl.build() : cloneWithNewIds(tpl.data);
    loadIntoEditor(null, d, { isNew: true });
  };
  const openSavedPaper = (paper) => loadIntoEditor(paper.id, contentOf(paper, user?.uid), { meta: metaOf(paper) });
  const duplicatePaper = (paper, msg = 'Copy created') => {
    // A copy keeps this teacher's own print settings for the original.
    const c = paper.id ? contentOf(paper, user?.uid) : paper;
    loadIntoEditor(null, { ...c, subjects: cloneWithNewIds(c.subjects || []).map(s => ({ ...s, assignee: null })) }, { isNew: true });
    setSavedSnapshot(''); // a copy is "changed" from the start so it gets saved
    showToast(msg);
  };

  const trashPaper = async (paper) => {
    if (!window.confirm(`Move "${paper.header?.examName || 'this paper'}" (${paper.header?.className || ''}) to the trash? You can restore it for ${TRASH_DAYS} days.`)) return false;
    const deletedAt = new Date().toISOString();
    if (!DEMO) setDoc(doc(db, 'papers', paper.id), { deletedAt }, { merge: true }).catch(err => console.error(err));
    setSavedPapers(list => list.map(p => (p.id === paper.id ? { ...p, deletedAt } : p)));
    showToast('Moved to trash');
    return true;
  };
  const restorePaper = (paper) => {
    if (!DEMO) setDoc(doc(db, 'papers', paper.id), { deletedAt: null }, { merge: true }).catch(err => console.error(err));
    setSavedPapers(list => list.map(p => (p.id === paper.id ? { ...p, deletedAt: null } : p)));
    showToast('Paper restored');
  };
  const deleteForever = async (paper) => {
    if (!window.confirm('Delete this paper forever? This cannot be undone.')) return;
    try { if (!DEMO) await deleteDoc(doc(db, 'papers', paper.id)); setSavedPapers(list => list.filter(p => p.id !== paper.id)); }
    catch (error) { console.error(error); alert('Failed to delete.'); }
  };
  const leaveSharedPaper = async (paper) => {
    if (!window.confirm('Leave this paper? It disappears from your list; your colleagues keep it.')) return false;
    try { if (!DEMO) await leavePaper(paper.id, user.uid); setSavedPapers(list => list.filter(p => p.id !== paper.id)); showToast('You left the paper'); return true; }
    catch (error) { console.error(error); alert('Could not leave the paper. Please check your internet connection.'); return false; }
  };

  const backToDashboard = () => {
    if (isDirty) cloudSave();
    if (currentPaperId && !isNewPaper) addVersion(currentPaperId, JSON.parse(snapshot));
    setAppState('dashboard');
    setModal(null);
    window.scrollTo(0, 0);
  };

  const goTo = (state, mode) => {
    if (mode) setPreviewMode(mode);
    if (state !== appState) { setAppState(state); if (state === 'preview' || !activeId) window.scrollTo(0, 0); }
    else if (mode && mode !== previewMode) window.scrollTo(0, 0);
  };

  const handleDownloadPdf = async () => {
    if (appState !== 'preview' && !split) { goTo('preview'); showToast('Here are your pages — tap PDF again to download'); return; }
    if (!pagesRef.current) return;
    const suffix = previewMode === 'key' ? ` - ${langOf(layout).t.answerKey}` : '';
    try {
      // Browsers refuse right-to-left characters in download names, so LSD papers get an English name.
      const rtl = /[֐-ࣿ]/;
      const named = `${header.className} - ${header.examName} ${header.hijriYear}`;
      const base = rtl.test(named) ? `${previewMode === 'key' ? 'Answer Key' : 'Paper'} - ${header.hijriYear} - ${header.paperNumber || ''} - ${new Date().toISOString().slice(0, 10)}` : `${named}${suffix}`;
      await downloadPdf(pagesRef.current, `${base.replace(/\s+-\s+-/g, ' -')}.pdf`, (i, n) => setPdfProgress(`${i}/${n}`));
    } catch (error) { console.error(error); alert('Could not create the PDF. Please try "Print" instead.'); }
    setPdfProgress(null);
  };

  const handleInstall = async () => {
    if (installEvent) {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === 'accepted') { setInstallEvent(null); showToast('App installed'); }
      setModal(null);
    } else setModal('install');
  };

  const openWhatsNew = () => { setModal('whatsNew'); setSeenVersion(LATEST_VERSION); store.set('seenVersion', LATEST_VERSION); };
  const openHistory = async () => { setVersions(await listVersions(currentPaperId)); setModal('history'); };

  // ---- sharing & working together ----
  const needOnline = () => { if (navigator.onLine && !DEMO) return true; alert(DEMO ? 'Sharing needs a real account (not available in demo mode).' : 'You need internet for this. Please connect and try again.'); return false; };
  const ensureSaved = async () => { if (isNewPaper || isDirty) await cloudSave(); };

  const sharePaperCopy = async () => {
    if (!needOnline()) return;
    setModal('shareBusy');
    try {
      await ensureSaved();
      const existing = paperMeta.shareCodes?.[user.uid];
      const title = `${header.examName} — ${header.className}`;
      const data = JSON.parse(latestRef.current);
      const code = await createShare(user, { kind: 'paper', title, data, existingCode: existing });
      if (!existing) {
        setDoc(doc(db, 'papers', currentPaperId), { shareCodes: { [user.uid]: code } }, { merge: true }).catch(() => {});
        setPaperMeta(m => ({ ...m, shareCodes: { ...(m.shareCodes || {}), [user.uid]: code } }));
      }
      setShownCode({ code, kind: 'paper', title, text: `${firstName(user.displayName)} shared a paper with you on ${BRAND.name}: ${title}` });
      setModal('shareCode');
    } catch (error) { console.error(error); setModal(null); alert('Could not create a share code. Please try again.'); }
  };
  const stopSharingCopy = async () => {
    const code = paperMeta.shareCodes?.[user.uid];
    if (!code || !window.confirm('Stop sharing? The code will no longer work.')) return;
    try {
      await deleteShare(code);
      setDoc(doc(db, 'papers', currentPaperId), { shareCodes: { [user.uid]: null } }, { merge: true }).catch(() => {});
      setPaperMeta(m => ({ ...m, shareCodes: { ...(m.shareCodes || {}), [user.uid]: null } }));
      setModal(null); showToast('Sharing stopped');
    } catch { alert('Could not stop sharing. Please check your internet connection.'); }
  };
  const shareTemplate = async (t) => {
    if (!needOnline()) return;
    try {
      const code = await createShare(user, { kind: 'template', title: t.name, data: t });
      setShownCode({ code, kind: 'template', title: t.name, text: `${firstName(user.displayName)} shared a template with you on ${BRAND.name}: ${t.name}` });
      setModal('shareCode');
    } catch (error) { console.error(error); alert('Could not create a share code. Please try again.'); }
  };

  const createInviteCode = async () => {
    if (!needOnline()) return;
    setCodeBusy(true);
    try {
      await ensureSaved();
      const code = await createInvite(user, currentPaperId, `${header.examName} — ${header.className}`);
      setPaperMeta(m => ({ ...m, inviteCode: code, members: [...new Set([...(m.members || []), user.uid])], memberInfo: { ...(m.memberInfo || {}), [user.uid]: { name: user.displayName || '' } } }));
    } catch (error) { console.error(error); alert('Could not create an invite code. Please try again.'); }
    setCodeBusy(false);
  };
  const stopInviteCode = async () => {
    if (!window.confirm('Turn off the invite code? People who already joined stay on the paper.')) return;
    try { await stopInvite(currentPaperId, paperMeta.inviteCode); setPaperMeta(m => ({ ...m, inviteCode: null })); }
    catch { alert('Could not turn off the code. Please check your internet connection.'); }
  };
  const removeMember = async (m) => {
    if (!window.confirm(`Remove ${m.name} from this paper?`)) return;
    try { await leavePaper(currentPaperId, m.uid); setPaperMeta(p => ({ ...p, members: p.members.filter(x => x !== m.uid) })); }
    catch { alert('Could not remove. Please check your internet connection.'); }
  };

  const openCodeModal = (prefill = '') => { setCodeInput(prefill ? prettyCode(prefill) : ''); setCodeResult(null); setModal('code'); if (prefill) runLookup(prefill); };
  const runLookup = async (raw) => {
    const code = cleanCode(raw ?? codeInput);
    if (code.length < 6) { setCodeResult({ error: 'Codes have 6 letters and numbers, like ABC-234.' }); return; }
    if (!needOnline()) return;
    setCodeBusy(true);
    try { setCodeResult((await lookupCode(code)) || { error: 'No paper or template has this code. Please check it and try again.' }); }
    catch (error) { console.error(error); setCodeResult({ error: 'Could not check the code. Please try again.' }); }
    setCodeBusy(false);
  };
  const acceptCode = async () => {
    const r = codeResult;
    if (!r) return;
    if (r.type === 'share' && r.kind === 'template') { saveTemplate({ ...r.data, kind: r.data?.kind || 'question' }, 'Template added to your templates'); setModal(null); return; }
    if (r.type === 'share') { setSharedView(r); setPreviewMode('paper'); setModal(null); setAppState('shared'); window.scrollTo(0, 0); return; }
    // Invitation to work together.
    setCodeBusy(true);
    try {
      const paperId = await joinPaper(user, r);
      const snap = await getDoc(doc(db, 'papers', paperId));
      const paper = { id: paperId, ...snap.data() };
      setSavedPapers(list => [paper, ...list.filter(p => p.id !== paperId)]);
      openSavedPaper(paper);
      showToast(`You joined “${r.title}”`);
    } catch (error) { console.error(error); alert('Could not join this paper. The code may have been turned off.'); }
    setCodeBusy(false);
  };

  // Desktop: keep the live preview panel sized to its column.
  useEffect(() => {
    if (!split || !panelRef.current) return;
    const ro = new ResizeObserver(([e]) => setPanelWidth(Math.round(e.contentRect.width)));
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [split]);
  // The live preview follows a moment behind typing so the editor stays quick.
  const deferredSnapshot = useDeferredValue(snapshot);
  const live = useMemo(() => JSON.parse(deferredSnapshot), [deferredSnapshot]);

  // ---------------------------------------------------------------------------
  if (appState === 'loading') {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-5"><Wordmark size="lg" subtitle={BRAND.tagline} /><Icon name="Loader2" size={28} className="text-brand-600" /></div>;
  }

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-brand-950 text-white relative overflow-hidden flex items-center justify-center p-6">
        <div className="absolute -top-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[24rem] h-[24rem] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative max-w-md w-full">
          <div className="flex justify-center mb-8"><Wordmark size="lg" subtitle={BRAND.tagline} light /></div>
          <ul className="space-y-3 mb-10 text-brand-50">
            {[['FileText', 'Exam papers in Lisan ud Dawat and English'], ['KeyRound', 'Complete answer keys in one tap'], ['Users', 'Share and write papers together with colleagues'], ['Download', 'Perfect A4 PDFs, even offline']].map(([ic, t]) => (
              <li key={t} className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center"><Icon name={ic} size={18} /></span><span className="font-medium">{t}</span></li>
            ))}
          </ul>
          <button onClick={handleLogin} className="w-full bg-white text-slate-900 font-bold text-lg py-4 px-4 rounded-2xl hover:bg-brand-50 shadow-lg inline-flex items-center justify-center gap-3">
            <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
          {!online && <p className="text-amber-300 text-sm mt-4 text-center">You are offline. Connect to the internet to sign in.</p>}
          <p className="text-brand-200/70 text-xs text-center mt-6">A free community tool for teachers · Your papers stay private unless you share them</p>
        </div>
      </div>
    );
  }

  const activePapers = savedPapers.filter(p => !p.deletedAt);
  const trashedPapers = savedPapers.filter(p => p.deletedAt && (!p.userId || p.userId === user?.uid));
  const isSharedPaper = (p) => (p.members || []).length > 1 || (p.userId && p.userId !== user?.uid);
  const sharedCount = activePapers.filter(isSharedPaper).length;
  const filteredPapers = activePapers.filter(p => {
    if (filter === 'shared' && !isSharedPaper(p)) return false;
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return [p.header?.className, p.header?.examName, p.header?.paperNumber, ...(p.subjects || []).map(s => s.title)].join(' ').toLowerCase().includes(t);
  });
  const L = langOf(layout);
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;
  const status = isNewPaper && !isDirty ? 'New paper — saves automatically'
    : syncState === 'saving' ? 'Saving…'
    : syncState === 'offline' ? 'Saved on device · uploads when online'
    : syncState === 'error' ? 'Not saved online yet — will retry'
    : isDirty ? 'Editing…' : 'All changes saved';
  const keyStats = answerStats(subjects);
  const myShareCode = paperMeta.shareCodes?.[user?.uid];
  const allTemplates = [...templates.filter(t => t.kind === 'paper'), ...BUILTIN_PAPER_TEMPLATES];
  const editFromPreview = (qid) => { setActiveId(qid); if (previewMode === 'key') { setShowAnswers(true); store.set('showAnswers', '1'); } };

  // Answer-key options, shown above the key preview.
  const keyBar = (
    <div className="max-w-3xl mx-auto mb-3 print:hidden">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-card p-3">
        <div className="flex items-center gap-3 mb-2.5">
          <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Icon name="KeyRound" size={18} /></span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-slate-800 text-sm">{keyStats.done} of {keyStats.total} questions have answers</div>
            <div className="h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden"><div className="h-full bg-amber-400 rounded-full" style={{ width: `${keyStats.total ? Math.round(keyStats.done / keyStats.total * 100) : 0}%` }} /></div>
          </div>
          <button onClick={() => { setShowAnswers(true); store.set('showAnswers', '1'); goTo('editor'); }} className="text-sm font-bold text-brand-700 bg-brand-50 px-3 py-2 rounded-xl whitespace-nowrap">Add answers</button>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[['keyQuestions', 'Show questions'], ['keyAll', 'List every question']].map(([k, label]) => {
            const on = layout[k] !== false;
            return <button key={k} onClick={() => setLayout({ ...layout, [k]: !on })} className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${on ? 'bg-brand-700 text-white border-brand-700' : 'bg-white text-slate-600 border-slate-200'}`}><Icon name={on ? 'Check' : 'Plus'} size={14} />{label}</button>;
          })}
        </div>
        {layout.keyAll !== false && (
          <label className="block mt-3">
            <span className="block text-xs font-bold text-slate-500 mb-1">Note printed where answers may vary</span>
            <input value={layout.keyNote || ''} onChange={(e) => setLayout({ ...layout, keyNote: e.target.value })} placeholder={L.keyNote} dir="auto" className={`w-full border border-slate-200 rounded-xl px-3 py-2 ${L.fontClass} text-lg focus:border-brand-500 focus:outline-none`} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24 sm:pb-10 print:pb-0 print:min-h-0 print:bg-white">

      {toast && <div role="status" className={`fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-xl text-sm font-bold print:hidden max-w-[90vw] text-center anim-sheet ${toast.kind === 'warn' ? 'bg-amber-500 text-white' : 'bg-slate-900 text-white'}`}>{toast.msg}</div>}

      {/* ---------------- TOP BAR ---------------- */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 print:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`${split ? 'max-w-[1600px]' : 'max-w-5xl'} mx-auto flex items-center gap-1 px-2 sm:px-4 h-16`}>
          {inPaper ? (
            <>
              <IconButton icon="ArrowLeft" label="Back to home" onClick={backToDashboard} />
              <div className="flex-1 min-w-0 px-1">
                <div className={`${L.fontClass} text-lg font-bold text-slate-900 truncate leading-tight`} dir={L.dir}>{header.examName} — {header.className}</div>
                <div className={`text-xs flex items-center gap-1 ${syncState === 'error' ? 'text-amber-600' : 'text-slate-500'}`}>
                  <Icon name={syncState === 'saving' ? 'Loader2' : syncState === 'offline' || !online ? 'WifiOff' : isDirty ? 'CloudUpload' : 'CloudCheck'} size={13} />
                  <span className="truncate">{status}{pageCount && (appState === 'preview' || split) ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</span>
                </div>
              </div>
              {isShared && (
                <button onClick={() => setModal('together')} className="hidden sm:flex items-center -space-x-2 me-1" aria-label="People on this paper">
                  {members.slice(0, 3).map(m => <Avatar key={m.uid} name={m.name} size={30} ring />)}
                  {members.length > 3 && <span className="w-[30px] h-[30px] rounded-full bg-slate-100 ring-2 ring-white text-xs font-bold text-slate-600 flex items-center justify-center">+{members.length - 3}</span>}
                </button>
              )}
              <IconButton icon="Undo2" label="Undo" onClick={undo} disabled={!canUndo} />
              <IconButton icon="Redo2" label="Redo" onClick={redo} disabled={!canRedo} className="hidden sm:flex" />
              <div className="hidden sm:flex items-center gap-2 ms-2">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {[['editor', null, 'Pencil', 'Edit'], ['preview', 'paper', 'Eye', 'Preview'], ['preview', 'key', 'KeyRound', 'Answer key']].map(([st, mode, ic, label]) => {
                    const on = appState === st && (!mode || previewMode === mode);
                    return <button key={label} onClick={() => goTo(st, mode)} className={`px-3 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${on ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}><Icon name={ic} size={16} /><span className="hidden md:inline">{label}</span></button>;
                  })}
                </div>
                <SecondaryBtn onClick={() => setModal('share')} className="px-3.5 py-2.5 text-sm rounded-xl"><Icon name="Share2" size={16} /><span className="hidden lg:inline">Share</span></SecondaryBtn>
                <PrimaryBtn onClick={handleDownloadPdf} disabled={!!pdfProgress} className="px-4 py-2.5 text-sm rounded-xl"><Icon name={pdfProgress ? 'Loader2' : 'Download'} size={16} />{pdfProgress ? `PDF ${pdfProgress}` : 'PDF'}</PrimaryBtn>
              </div>
              <IconButton icon="MoreVertical" label="Paper options" onClick={() => setModal('paperMenu')} />
            </>
          ) : appState === 'shared' ? (
            <>
              <IconButton icon="ArrowLeft" label="Back to home" onClick={() => { setSharedView(null); setAppState('dashboard'); }} />
              <div className="flex-1 min-w-0 px-1">
                <div className="text-lg font-bold text-slate-900 truncate leading-tight" dir="auto">{sharedView?.title}</div>
                <div className="text-xs text-slate-500 truncate">Shared by {sharedView?.ownerName} · view only</div>
              </div>
              <PrimaryBtn onClick={() => { duplicatePaper(sharedView.data, 'Saved to your papers'); setSharedView(null); }} className="px-4 py-2.5 text-sm rounded-xl"><Icon name="Plus" size={16} /><span className="hidden sm:inline">Save to my papers</span><span className="sm:hidden">Save</span></PrimaryBtn>
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0 ps-1"><Wordmark /></div>
              {!online && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full shrink-0 inline-flex items-center gap-1"><Icon name="WifiOff" size={12} />Offline</span>}
              <SecondaryBtn onClick={() => openCodeModal()} className="hidden sm:inline-flex px-3.5 py-2.5 text-sm rounded-xl me-1"><Icon name="Ticket" size={16} />Enter code</SecondaryBtn>
              <button onClick={() => setModal('menu')} aria-label="Menu" className="w-11 h-11 rounded-full hover:bg-slate-100 shrink-0 relative flex items-center justify-center">
                <Avatar name={user?.displayName} size={34} />{hasNews && <span className="absolute top-1 right-1 w-3 h-3 bg-amber-500 rounded-full ring-2 ring-white" />}
              </button>
            </>
          )}
        </div>
      </header>

      {needRefresh && (
        <div className="bg-brand-700 text-white px-4 py-3 flex items-center justify-between gap-3 print:hidden">
          <span className="text-sm font-bold inline-flex items-center gap-2"><Icon name="Sparkles" size={16} />A new version of {BRAND.name} is ready.</span>
          <button onClick={() => updateServiceWorker(true)} className="bg-white text-brand-800 font-bold text-sm px-4 py-2 rounded-xl">Update</button>
        </div>
      )}

      {/* ---------------- HOME ---------------- */}
      {appState === 'dashboard' && (
        <main className="max-w-5xl mx-auto px-4 pt-6" style={{ zoom: uiZoom }}>
          <section className="relative overflow-hidden rounded-3xl bg-brand-900 text-white p-5 sm:p-7 mb-6 shadow-lift">
            <div className="absolute -right-16 -top-20 w-64 h-64 rounded-full bg-brand-500/30 blur-2xl" />
            <div className="absolute right-6 bottom-4 opacity-15 hidden sm:block"><BrandMark size={120} /></div>
            <div className="relative">
              <div className="text-brand-200 text-sm font-medium">Salaam, {firstName(user?.displayName)}</div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 mb-5">What are we making today?</h1>
              <div className="flex flex-wrap gap-2.5">
                <button onClick={() => setModal('newPaper')} className="bg-white text-brand-900 font-bold px-5 py-3 rounded-2xl inline-flex items-center gap-2 shadow-sm hover:bg-brand-50"><Icon name="Plus" size={20} />New paper</button>
                <button onClick={() => openCodeModal()} className="bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold px-5 py-3 rounded-2xl inline-flex items-center gap-2"><Icon name="Ticket" size={20} />Enter a code</button>
              </div>
            </div>
          </section>

          {recoverDraft && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-center gap-3">
              <Icon name="RotateCcw" size={24} className="text-amber-600" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800">Continue where you left off?</div>
                <div className="text-sm text-slate-600 truncate">{recoverDraft.data?.header?.examName} — {recoverDraft.data?.header?.className} · {timeAgo(recoverDraft.savedAt)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => { const d = recoverDraft; const cloud = savedPapers.find(p => p.id === d.paperId); loadIntoEditor(d.paperId, d.data, { isNew: !cloud, meta: cloud ? metaOf(cloud) : d.meta }); setSavedSnapshot(cloud ? JSON.stringify(contentOf(cloud, user.uid)) : ''); setRecoverDraft(null); }} className="bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm">Open</button>
                <button onClick={() => { clearDraft(); setRecoverDraft(null); }} className="text-xs text-slate-500">Discard</button>
              </div>
            </div>
          )}

          {!isStandalone() && (installEvent || isIOS()) && !installDismissed && (
            <div className="bg-white border border-slate-200 shadow-card rounded-2xl p-4 mb-5 flex items-center gap-3">
              <BrandMark size={44} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800">Install {BRAND.name}</div>
                <div className="text-sm text-slate-500">Opens like an app, works without internet.</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={handleInstall} className="bg-brand-700 text-white font-bold px-4 py-2 rounded-xl text-sm">Install</button>
                <button onClick={() => { store.set('installDismissed', '1'); setInstallDismissed(true); }} className="text-xs text-slate-400">Not now</button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Papers <span className="text-slate-400 font-semibold">{activePapers.length}</span></h2>
            {sharedCount > 0 && (
              <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
                {[['all', 'All'], ['shared', `Shared · ${sharedCount}`]].map(([v, l]) => <button key={v} onClick={() => setFilter(v)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${filter === v ? 'bg-brand-700 text-white' : 'text-slate-500'}`}>{l}</button>)}
              </div>
            )}
          </div>
          {activePapers.length > 3 && (
            <div className="relative mb-4">
              <Icon name="Search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class, exam or subject" className="w-full h-12 pl-10 pr-4 rounded-2xl border border-slate-200 bg-white focus:border-brand-500 focus:outline-none" dir="auto" />
            </div>
          )}

          {papersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="h-36 bg-white rounded-2xl animate-pulse" />)}</div>
          ) : filteredPapers.length === 0 ? (
            <div className="text-center py-12 px-6 bg-white rounded-3xl border border-dashed border-slate-300">
              <span className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-700 inline-flex items-center justify-center mb-3"><Icon name="FileText" size={26} /></span>
              <div className="font-bold text-slate-800">{search ? 'No papers match your search' : 'No papers yet'}</div>
              {!search && <p className="text-sm text-slate-500 mt-1 mb-4">Make your first paper, or enter a code a colleague sent you.</p>}
              {!search && <PrimaryBtn onClick={() => setModal('newPaper')} className="px-5 py-3"><Icon name="Plus" size={18} />New paper</PrimaryBtn>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPapers.map(paper => {
                const PL = langOf(paper.layout);
                const mine = !paper.userId || paper.userId === user?.uid;
                const team = (paper.members || []).length;
                return (
                  <div key={paper.id} className="bg-white rounded-2xl border border-slate-200 shadow-card hover:shadow-lift hover:border-brand-200 transition overflow-hidden flex flex-col">
                    <button onClick={() => openSavedPaper(paper)} className="p-4 text-start flex-1" dir={PL.dir}>
                      <span className="flex items-center gap-1.5 mb-2 flex-wrap" dir="ltr">
                        <span className={`bg-brand-50 text-brand-800 ${PL.fontClass} text-sm font-bold px-2.5 py-0.5 rounded-lg`} dir={PL.dir}>{paper.header?.className || '—'}</span>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{paper.layout?.language === 'en' ? 'EN' : 'LSD'}</span>
                        {(team > 1 || !mine) && <span className="text-[11px] font-bold text-brand-700 bg-brand-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1"><Icon name="Users" size={12} />{mine ? `${team} teachers` : `From ${firstName(paper.memberInfo?.[paper.userId]?.name || paper.authorName)}`}</span>}
                      </span>
                      <span className={`block text-xl font-bold ${PL.fontClass} text-slate-900 leading-snug`}>{paper.header?.examName || 'Untitled'} {PL.num(paper.header?.hijriYear || '')}{PL.yearSuffix}</span>
                      <span className={`block text-base text-slate-500 ${PL.fontClass} truncate`}>{(paper.subjects || []).map(s => s.title).join(PL.dir === 'rtl' ? ' ، ' : ', ') || '—'}</span>
                    </button>
                    <div className="flex items-center border-t border-slate-100 text-sm">
                      <span className="flex-1 px-4 text-slate-400 text-xs">{paper.lastEdited ? timeAgo(new Date(paper.lastEdited).getTime()) : ''} · {grandTotal(paper.subjects)} marks</span>
                      <button onClick={() => duplicatePaper(paper)} aria-label="Make a copy" className="px-3.5 py-3 text-slate-500 hover:bg-slate-50 inline-flex items-center gap-1.5 font-bold"><Icon name="Copy" size={16} />Copy</button>
                      {mine
                        ? <button onClick={() => trashPaper(paper)} aria-label="Move to trash" className="px-3.5 py-3 text-slate-400 hover:text-red-600 hover:bg-red-50"><Icon name="Trash2" size={18} /></button>
                        : <button onClick={() => leaveSharedPaper(paper)} aria-label="Leave paper" title="Leave paper" className="px-3.5 py-3 text-slate-400 hover:text-red-600 hover:bg-red-50"><Icon name="LogOut" size={18} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {trashedPapers.length > 0 && (
            <button onClick={() => setModal('trash')} className="mt-6 mx-auto flex items-center gap-2 text-sm text-slate-500 font-bold px-4 py-2 rounded-xl hover:bg-white"><Icon name="Trash2" size={16} />Trash ({trashedPapers.length})</button>
          )}
        </main>
      )}

      {/* ---------------- SHARED COPY (view only) ---------------- */}
      {appState === 'shared' && sharedView && (
        <main className="p-3 sm:p-5">
          <div className="max-w-3xl mx-auto mb-3 flex justify-center">
            <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
              {[['paper', 'Question paper'], ['key', 'Answer key']].map(([m, label]) => (
                <button key={m} onClick={() => setPreviewMode(m)} className={`px-4 py-1.5 rounded-lg text-sm font-bold ${previewMode === m ? 'bg-brand-700 text-white' : 'text-slate-500'}`}>{label}</button>
              ))}
            </div>
          </div>
          <PaperPreview mode={previewMode} school={schoolSettings} header={normalizeHeader(sharedView.data?.header)} subjects={normalizeSubjects(sharedView.data?.subjects)} layout={normalizeLayout(sharedView.data?.layout)} />
          <p className="text-center text-sm text-slate-500 mt-2 px-4">Save it to your papers to edit it and print it with your own school name and logo.</p>
        </main>
      )}

      {/* ---------------- EDITOR / PREVIEW ---------------- */}
      {inPaper && (
        <main className={`p-3 sm:p-5 print:p-0 ${split ? 'max-w-[1600px] mx-auto grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-5 items-start' : ''}`}>
          {appState === 'preview' ? (
            <>
              {previewMode === 'key' ? keyBar : <p className="text-center text-sm text-slate-500 mb-2 print:hidden">Tap any question to edit it.</p>}
              <PaperPreview mode={previewMode} school={schoolSettings} pagesRef={pagesRef} onPageCount={setPageCount}
                header={header} subjects={subjects} layout={layout} focusQuestionId={activeId}
                onEditQuestion={(qid) => { editFromPreview(qid); setAppState('editor'); }} />
            </>
          ) : (
            <>
              <div className="print:hidden" style={{ zoom: uiZoom }}>
                <Editor header={header} setHeader={setHeader} subjects={subjects} setSubjects={setSubjects} layout={layout} setLayout={setLayout}
                  activeId={activeId} setActiveId={setActiveId}
                  showAnswers={showAnswers} setShowAnswers={(v) => { setShowAnswers(v); store.set('showAnswers', v ? '1' : '0'); }}
                  templates={templates.filter(t => (t.language || 'lsd') === (layout.language || 'lsd'))} onSaveTemplate={saveTemplate} onDeleteTemplate={deleteTemplate}
                  members={members} myUid={user?.uid} hideJump={split}
                  onMakeDefaultStyle={(l) => { updateAppSettings({ defaultLayout: { ...l }, defaultLanguage: l.language || 'lsd' }); showToast('New papers will use this style'); }} />
              </div>
              {split && (
                <aside className="sticky top-[5rem] h-[calc(100vh-6rem)] flex flex-col bg-slate-200/50 rounded-3xl border border-slate-200 overflow-hidden print:hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-white/70 border-b border-slate-200">
                    <span className="text-sm font-bold text-slate-600 inline-flex items-center gap-2"><Icon name="Eye" size={16} />Live preview{pageCount ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg">
                      {[['paper', 'Paper'], ['key', 'Answer key']].map(([m, label]) => <button key={m} onClick={() => setPreviewMode(m)} className={`px-3 py-1 rounded-md text-xs font-bold ${previewMode === m ? 'bg-white shadow-sm text-brand-700' : 'text-slate-500'}`}>{label}</button>)}
                    </div>
                  </div>
                  <div ref={panelRef} className="flex-1 overflow-y-auto">
                    <PaperPreview mode={previewMode} school={schoolSettings} pagesRef={pagesRef} onPageCount={setPageCount}
                      header={live.header} subjects={live.subjects} layout={live.layout} focusQuestionId={activeId} fitWidth={panelWidth} scrollRef={panelRef}
                      onEditQuestion={(qid) => { editFromPreview(qid); requestAnimationFrame(() => document.getElementById(`qcard-${qid}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })); }} />
                  </div>
                </aside>
              )}
            </>
          )}
        </main>
      )}

      {/* ---------------- BOTTOM NAV (phones) ---------------- */}
      {inPaper && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 flex print:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <NavButton icon="Pencil" label="Edit" active={appState === 'editor'} onClick={() => goTo('editor')} />
          <NavButton icon="Eye" label="Preview" active={appState === 'preview' && previewMode === 'paper'} onClick={() => goTo('preview', 'paper')} />
          <NavButton icon="KeyRound" label="Answers" active={appState === 'preview' && previewMode === 'key'} onClick={() => goTo('preview', 'key')} />
          <NavButton icon="Share2" label="Share" onClick={() => setModal('share')} />
          <NavButton icon={pdfProgress ? 'Loader2' : 'Download'} label={pdfProgress || 'PDF'} onClick={handleDownloadPdf} disabled={!!pdfProgress} />
        </nav>
      )}

      {/* ---------------- MODALS ---------------- */}
      {modal === 'menu' && (
        <Modal title="Menu" onClose={() => setModal(null)}>
          <div className="flex items-center gap-3 p-3 mb-2 bg-slate-50 rounded-2xl">
            <Avatar name={user?.displayName} size={44} />
            <div className="min-w-0"><div className="font-bold text-slate-900 truncate">{user?.displayName}</div><div className="text-xs text-slate-500 truncate">{user?.email}</div></div>
          </div>
          <MenuItem icon="Ticket" label="Enter a code" hint="Open a shared paper or join a colleague" onClick={() => openCodeModal()} />
          <MenuItem icon="School" label="School name & logo" hint="Printed on your papers" onClick={() => setModal('settings')} />
          <MenuItem icon="Settings" label="App settings" hint="Text size, default language" onClick={() => setModal('appSettings')} />
          <MenuItem icon="Bell" label="What's new" onClick={openWhatsNew} dot={hasNews} />
          {!isStandalone() && <MenuItem icon="Smartphone" label="Install the app" onClick={handleInstall} />}
          <MenuItem icon="Info" label="Help & about" onClick={() => setModal('about')} />
          <MenuItem icon="LogOut" label="Sign out" onClick={handleLogout} danger />
        </Modal>
      )}

      {modal === 'paperMenu' && (
        <Modal title="Paper options" onClose={() => setModal(null)}>
          <MenuItem icon="Users" label="Work together" hint={isShared ? `${members.length} teachers on this paper` : 'Invite colleagues to write this paper with you'} onClick={() => setModal('together')} />
          <MenuItem icon="Share2" label="Share a copy" hint="Send a code; they get their own copy" onClick={() => setModal('share')} />
          <MenuItem icon="History" label="Version history" hint="Go back to an earlier version" onClick={openHistory} />
          <MenuItem icon="BookmarkPlus" label="Save as template" hint="Reuse this paper's layout" onClick={() => {
            const name = window.prompt('Template name', `${header.examName} — ${header.className}`);
            if (name && name.trim()) { saveTemplate({ kind: 'paper', name: name.trim(), language: layout.language, data: { header, subjects, layout } }); setModal(null); }
          }} />
          <MenuItem icon="Copy" label="Make a copy" onClick={() => duplicatePaper({ header, subjects, layout })} />
          <MenuItem icon="Printer" label="Print" onClick={() => { setModal(null); if (appState !== 'preview') goTo('preview'); setTimeout(() => window.print(), 600); }} />
          {!isNewPaper && (isOwner
            ? <MenuItem icon="Trash2" label="Move to trash" danger onClick={async () => { const p = savedPapers.find(x => x.id === currentPaperId); if (p && await trashPaper(p)) { setModal(null); setAppState('dashboard'); } }} />
            : <MenuItem icon="LogOut" label="Leave this paper" danger onClick={async () => { if (await leaveSharedPaper({ id: currentPaperId })) { setModal(null); setAppState('dashboard'); } }} />)}
        </Modal>
      )}

      {modal === 'share' && (
        <Modal title="Share" onClose={() => setModal(null)}>
          <div className="grid gap-3">
            <button onClick={sharePaperCopy} className="text-start rounded-3xl border-2 border-slate-100 hover:border-brand-300 p-4 flex gap-4">
              <span className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center shrink-0"><Icon name="Send" size={22} /></span>
              <span><span className="block font-bold text-slate-900">{myShareCode ? 'Update the shared copy' : 'Send a copy'}</span><span className="block text-sm text-slate-500 mt-0.5">Your colleague opens it with a code and saves their own copy. Your paper stays yours.</span></span>
            </button>
            <button onClick={() => setModal('together')} className="text-start rounded-3xl border-2 border-slate-100 hover:border-brand-300 p-4 flex gap-4">
              <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0"><Icon name="Users" size={22} /></span>
              <span><span className="block font-bold text-slate-900">Work on it together</span><span className="block text-sm text-slate-500 mt-0.5">Colleagues join this paper and edit the same questions. Each one prints with their own school, logo and cover page.</span></span>
            </button>
          </div>
          {myShareCode && <button onClick={stopSharingCopy} className="mt-4 text-sm font-bold text-red-600">Stop sharing the copy ({prettyCode(myShareCode)})</button>}
        </Modal>
      )}

      {modal === 'shareBusy' && (
        <Modal title="Share" onClose={() => setModal(null)}><div className="py-10 flex flex-col items-center gap-3 text-slate-500"><Icon name="Loader2" size={28} />Creating a code…</div></Modal>
      )}

      {modal === 'shareCode' && shownCode && (
        <Modal title={shownCode.kind === 'template' ? 'Template shared' : 'Paper shared'} onClose={() => setModal(null)}>
          <p className="text-slate-600 mb-4">Send this code to a colleague. In {BRAND.name} they tap <b>Enter a code</b> and get their own copy{shownCode.kind === 'paper' ? ', printed with their own school name and logo' : ''}.</p>
          <CodeCard code={shownCode.code} title={shownCode.title} text={shownCode.text} onToast={showToast} />
          {shownCode.kind === 'paper' && <p className="text-xs text-slate-500 mt-3">The copy is a snapshot. If you change your paper later, tap Share → <b>Update the shared copy</b> to send the new version under the same code.</p>}
        </Modal>
      )}

      {modal === 'together' && (
        <Modal title="Work together" onClose={() => setModal(null)}>
          <p className="text-slate-600 mb-4">Everyone on this paper edits the same questions, and changes appear for all. Assign each subject to a teacher to divide the work. <b>Cover page, border, text size, school name and logo stay each teacher’s own</b>, so everyone prints their own way.</p>
          {paperMeta.inviteCode ? (
            <>
              <CodeCard code={paperMeta.inviteCode} title={`${header.examName} — ${header.className}`} text={`${firstName(user?.displayName)} invited you to work on a paper together on ${BRAND.name}.`} onToast={showToast} />
              {isOwner && <button onClick={stopInviteCode} className="mt-3 text-sm font-bold text-slate-500">Turn off this code</button>}
            </>
          ) : isOwner ? (
            <PrimaryBtn onClick={createInviteCode} disabled={codeBusy} className="w-full py-3.5"><Icon name={codeBusy ? 'Loader2' : 'UserPlus'} size={20} />Create an invite code</PrimaryBtn>
          ) : (
            <p className="text-sm bg-slate-50 rounded-xl p-3 text-slate-600">Ask the paper’s owner for an invite code to add more teachers.</p>
          )}
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mt-6 mb-2">On this paper</h3>
          <div className="divide-y divide-slate-100">
            {(members.length ? members : [{ uid: user?.uid, name: user?.displayName }]).map(m => (
              <div key={m.uid} className="flex items-center gap-3 py-2.5">
                <Avatar name={m.name} size={36} />
                <span className="flex-1 min-w-0"><span className="block font-bold text-slate-800 truncate">{m.name}{m.uid === user?.uid ? ' (you)' : ''}</span><span className="block text-xs text-slate-500 truncate">{m.uid === (paperMeta.ownerId || user?.uid) ? 'Owner' : 'Can edit'} · {subjects.filter(s => s.assignee === m.uid).map(s => s.title).join(', ') || 'No subject assigned'}</span></span>
                {isOwner && m.uid !== user?.uid && <button onClick={() => removeMember(m)} aria-label={`Remove ${m.name}`} className="w-10 h-10 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center"><Icon name="UserMinus" size={18} /></button>}
              </div>
            ))}
          </div>
          {!isOwner && <button onClick={async () => { if (await leaveSharedPaper({ id: currentPaperId })) { setModal(null); setAppState('dashboard'); } }} className="mt-4 text-sm font-bold text-red-600">Leave this paper</button>}
        </Modal>
      )}

      {modal === 'code' && (
        <Modal title="Enter a code" onClose={() => setModal(null)}>
          <p className="text-slate-600 mb-4">Got a code from a colleague? Type it here to open a shared paper or template, or to join a paper you’ll write together.</p>
          <form onSubmit={(e) => { e.preventDefault(); runLookup(); }} className="flex gap-2">
            <input autoFocus value={codeInput} onChange={(e) => { setCodeInput(e.target.value.toUpperCase()); setCodeResult(null); }} placeholder="ABC-234" aria-label="Code" autoCapitalize="characters" autoComplete="off" spellCheck={false} dir="ltr"
              className="flex-1 min-w-0 h-14 border-2 border-slate-200 focus:border-brand-500 focus:outline-none rounded-2xl px-4 font-mono font-bold text-2xl tracking-[0.15em] text-center uppercase" />
            <PrimaryBtn type="submit" disabled={codeBusy} className="px-5 h-14" aria-label="Look up code"><Icon name={codeBusy ? 'Loader2' : 'ArrowRight'} size={22} /></PrimaryBtn>
          </form>
          {codeResult?.error && <p className="text-red-600 text-sm mt-3">{codeResult.error}</p>}
          {codeResult && !codeResult.error && (
            <div className="mt-5 border border-slate-200 rounded-3xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${codeResult.type === 'invite' ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700'}`}><Icon name={codeResult.type === 'invite' ? 'Users' : codeResult.kind === 'template' ? 'Bookmark' : 'FileText'} size={22} /></span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate" dir="auto">{codeResult.title}</div>
                  <div className="text-sm text-slate-500">{codeResult.type === 'invite' ? `${codeResult.ownerName} invited you to work on this paper` : `${codeResult.kind === 'template' ? 'Template' : 'Paper'} shared by ${codeResult.ownerName}`}</div>
                </div>
              </div>
              <PrimaryBtn onClick={acceptCode} disabled={codeBusy} className="w-full py-3.5">
                <Icon name={codeBusy ? 'Loader2' : codeResult.type === 'invite' ? 'UserPlus' : codeResult.kind === 'template' ? 'BookmarkPlus' : 'Eye'} size={20} />
                {codeResult.type === 'invite' ? 'Join this paper' : codeResult.kind === 'template' ? 'Add to my templates' : 'Open paper'}
              </PrimaryBtn>
            </div>
          )}
        </Modal>
      )}

      {modal === 'newPaper' && (
        <Modal title="New paper" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3 mb-6">
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <button key={code} onClick={() => startPaper(code)} className="border-2 border-slate-100 hover:border-brand-500 hover:bg-brand-50/40 rounded-3xl p-4 text-left transition">
                <span className="block text-2xl mb-2 font-bold text-brand-800"><span className={lang.fontClass}>{code === 'lsd' ? 'لسان الدعوة' : 'English'}</span></span>
                <span className="block font-bold text-slate-800">Blank paper</span>
                <span className="block text-xs text-slate-500">{lang.dir === 'rtl' ? 'Right to left' : 'Left to right'}</span>
              </button>
            ))}
          </div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start from a template</h3>
          <div className="space-y-2">
            {allTemplates.map(t => (
              <div key={t.id} className="flex items-center border border-slate-200 rounded-2xl">
                <button onClick={() => startPaper(t)} className="flex-1 flex items-center gap-3 p-3 text-left min-w-0">
                  <span className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.builtin ? 'bg-amber-50 text-amber-600' : 'bg-brand-50 text-brand-700'}`}><Icon name={t.builtin ? 'Sparkles' : 'Bookmark'} size={18} /></span>
                  <span className="min-w-0"><span className="block font-bold text-slate-800 truncate" dir="auto">{t.name}</span><span className="block text-xs text-slate-500">{LANGUAGES[t.language || 'lsd']?.name}{t.builtin ? ' · ready-made' : ' · yours'}</span></span>
                </button>
                {!t.builtin && <button onClick={() => shareTemplate(t)} aria-label="Share template" className="w-11 h-11 text-slate-400 hover:text-brand-700 flex items-center justify-center"><Icon name="Share2" size={18} /></button>}
                {!t.builtin && <button onClick={() => { if (window.confirm(`Delete template "${t.name}"?`)) deleteTemplate(t.id); }} aria-label="Delete template" className="w-11 h-11 text-slate-400 hover:text-red-600 flex items-center justify-center"><Icon name="Trash2" size={18} /></button>}
              </div>
            ))}
          </div>
          <button onClick={() => openCodeModal()} className="mt-4 w-full text-sm font-bold text-brand-700 bg-brand-50 rounded-2xl py-3 inline-flex items-center justify-center gap-2"><Icon name="Ticket" size={16} />Have a code from a colleague?</button>
        </Modal>
      )}

      {modal === 'history' && (
        <Modal title="Version history" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-500 mb-3">Saved automatically on this device. Tap a version to go back to it — you can undo this.</p>
          {versions.length === 0 ? <p className="text-slate-500 py-6 text-center">No earlier versions yet.</p> : versions.map((v, i) => {
            const d = JSON.parse(v.json);
            const qCount = (d.subjects || []).reduce((t, s) => t + (s.questions || []).length, 0);
            return (
              <button key={v.at} onClick={() => { if (window.confirm('Go back to this version?')) { applySnapshot(v.json); history.current.applying = false; setModal(null); showToast('Restored — tap Undo to go back'); } }} className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-slate-50 text-left border-b border-slate-100">
                <Icon name="History" size={20} className="text-slate-400" />
                <span className="flex-1"><span className="block font-bold text-slate-800">{i === 0 ? 'Latest save' : timeAgo(v.at)}</span><span className="block text-xs text-slate-500">{new Date(v.at).toLocaleString()} · {(d.subjects || []).length} subjects · {qCount} questions</span></span>
              </button>
            );
          })}
        </Modal>
      )}

      {modal === 'trash' && (
        <Modal title="Trash" onClose={() => setModal(null)}>
          <p className="text-sm text-slate-500 mb-3">Papers are deleted forever after {TRASH_DAYS} days.</p>
          {trashedPapers.length === 0 ? <p className="text-slate-500 py-6 text-center">Trash is empty.</p> : trashedPapers.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-3 border-b border-slate-100">
              <div className="flex-1 min-w-0" dir={langOf(p.layout).dir}>
                <div className={`font-bold ${langOf(p.layout).fontClass} text-lg truncate`}>{p.header?.examName} — {p.header?.className}</div>
                <div className="text-xs text-slate-500" dir="ltr">Deleted {timeAgo(new Date(p.deletedAt).getTime())}</div>
              </div>
              <button onClick={() => restorePaper(p)} className="px-3 py-2 rounded-xl border border-brand-200 text-brand-700 font-bold text-sm inline-flex items-center gap-1"><Icon name="RotateCcw" size={16} />Restore</button>
              <button onClick={() => deleteForever(p)} aria-label="Delete forever" className="w-10 h-10 rounded-xl text-red-500 flex items-center justify-center"><Icon name="Trash2" size={18} /></button>
            </div>
          ))}
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="School name & logo" onClose={closeSettings} footer={<PrimaryBtn onClick={closeSettings} className="w-full py-3.5 text-lg">Save</PrimaryBtn>}>
          <p className="text-sm text-slate-500 mb-4">Printed on the cover of your papers. On papers you share or write together, each teacher’s own school name and logo is used.</p>
          <label className="block text-sm font-bold text-slate-600 mb-1">School name</label>
          <input type="text" value={schoolSettings?.nameAr || ''} onChange={(e) => updateSchoolSettings({ ...schoolSettings, nameAr: e.target.value })} className="w-full border border-slate-300 px-3 py-2 rounded-xl mb-5 font-arabic text-2xl focus:border-brand-500 focus:outline-none" dir="auto" />
          <label className="block text-sm font-bold text-slate-600 mb-1">Logo</label>
          {schoolSettings?.logo && <div className="mb-3 flex justify-center bg-slate-50 border border-slate-200 p-3 rounded-xl"><img src={schoolSettings.logo} alt="Logo" className="h-20 object-contain" /></div>}
          <div className="flex gap-2">
            <label className="flex-1 text-center border-2 border-dashed border-brand-300 text-brand-700 font-bold py-3 rounded-xl cursor-pointer inline-flex items-center justify-center gap-2">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" /><Icon name="Upload" size={18} />{schoolSettings?.logo ? 'Change logo' : 'Choose logo'}
            </label>
            {schoolSettings?.logo && <button onClick={() => updateSchoolSettings({ ...schoolSettings, logo: '' })} className="px-4 text-red-600 border border-red-200 rounded-xl font-bold">Remove</button>}
          </div>
        </Modal>
      )}

      {modal === 'appSettings' && (
        <Modal title="App settings" onClose={() => setModal(null)}>
          <div className="py-3 border-b border-slate-100">
            <div className="font-bold text-slate-800 mb-1">App text size</div>
            <div className="text-sm text-slate-500 mb-3">Makes buttons and text bigger in the app (the printed paper does not change).</div>
            <div className="grid grid-cols-3 gap-2">
              {[['normal', 'Normal', 'text-sm'], ['large', 'Large', 'text-base'], ['xlarge', 'Extra large', 'text-lg']].map(([v, label, size]) => (
                <button key={v} onClick={() => updateAppSettings({ uiSize: v })} className={`py-3 rounded-xl border-2 font-bold ${size} ${appSettings.uiSize === v ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="py-3 border-b border-slate-100">
            <div className="font-bold text-slate-800 mb-3">Language for new papers</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(LANGUAGES).map(([code, lang]) => (
                <button key={code} onClick={() => updateAppSettings({ defaultLanguage: code })} className={`py-3 rounded-xl border-2 font-bold ${appSettings.defaultLanguage === code ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-200'}`}><span className={lang.fontClass}>{code === 'lsd' ? 'لسان الدعوة' : 'English'}</span></button>
              ))}
            </div>
          </div>
          <div className="py-3">
            <div className="font-bold text-slate-800 mb-1">Default page style</div>
            <div className="text-sm text-slate-500 mb-3">{appSettings.defaultLayout ? 'Your saved style is used for new papers.' : 'Open a paper → Page style → "Use this style for all my new papers".'}</div>
            {appSettings.defaultLayout && <button onClick={() => updateAppSettings({ defaultLayout: null })} className="text-sm font-bold text-red-600">Reset to standard style</button>}
          </div>
        </Modal>
      )}

      {modal === 'whatsNew' && (
        <Modal title="What's new" onClose={() => setModal(null)}>
          {WHATS_NEW.map(rel => (
            <div key={rel.version} className="mb-5">
              <div className="flex items-center gap-3 mb-4">
                <BrandMark size={48} />
                <div><div className="font-extrabold text-slate-900 text-lg">{rel.title || `Version ${rel.version}`}</div><div className="text-sm text-slate-500">Version {rel.version} · {rel.date}</div></div>
              </div>
              <ul className="space-y-2.5">{rel.items.map(it => <li key={it} className="flex gap-2.5 text-slate-700"><span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mt-0.5 shrink-0"><Icon name="Check" size={13} strokeWidth={3} /></span>{it}</li>)}</ul>
            </div>
          ))}
        </Modal>
      )}

      {modal === 'install' && (
        <Modal title="Install the app" onClose={() => setModal(null)}>
          {isIOS() ? (
            <ol className="space-y-3 text-slate-700 text-lg list-decimal pl-6">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button at the bottom.</li>
              <li>Choose <b>Add to Home Screen</b>.</li>
            </ol>
          ) : (
            <ol className="space-y-3 text-slate-700 text-lg list-decimal pl-6">
              <li>Open this page in <b>Chrome</b>.</li>
              <li>Tap the <b>⋮</b> menu at the top right.</li>
              <li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
            </ol>
          )}
        </Modal>
      )}

      {modal === 'about' && (
        <Modal title="Help & about" onClose={() => setModal(null)}>
          <div className="flex justify-center mb-4"><Wordmark size="lg" subtitle={BRAND.tagline} /></div>
          <p className="text-slate-600 leading-relaxed mb-5 text-center">{BRAND.description}</p>
          <h3 className="font-bold text-slate-800 mb-2">Quick help</h3>
          <ul className="text-slate-600 space-y-2 mb-5 list-disc pl-5">
            <li>Your work <b>saves automatically</b>, even without internet, and reopens where you left off.</li>
            <li><b>Edit</b>: tap a question to open it, tap <b>Done</b> to fold it.</li>
            <li><b>Preview</b>: the real A4 pages. Tap a question there to edit it.</li>
            <li><b>Answers</b>: switch on “Answer key” in the editor and fill the yellow boxes. Written questions can have a model answer or marking points.</li>
            <li><b>Share</b>: send a copy with a code, or invite colleagues to write the paper together.</li>
            <li>Made a mistake? Tap <b>Undo</b>, or ⋮ → <b>Version history</b>.</li>
          </ul>
          <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 text-center">Made with care by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noreferrer" className="underline">S. Shakir</a> · {BRAND.name} v{LATEST_VERSION} beta{BUILD_TIME ? ` · built ${new Date(BUILD_TIME).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</div>
        </Modal>
      )}
    </div>
  );
}

export default App
