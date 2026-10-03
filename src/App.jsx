import { useState, useEffect, useRef, useCallback } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, getDocs, query, where, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Editor from './components/Editor'
import PaperPreview from './components/PaperPreview'
import Icon from './components/Icon'
import { Wordmark, BrandMark } from './components/Brand'
import { DEFAULT_SCHOOL_INFO, uid, LANGUAGES, langOf, defaultsFor, normalizeSubjects, normalizeHeader, normalizeLayout, paperSizeKb, cloneWithNewIds } from './lib/paper'
import { downloadPdf, resizeImage } from './lib/pdf'
import { WHATS_NEW, LATEST_VERSION } from './lib/whatsNew'
import { saveDraft, loadDraft, clearDraft, addVersion, listVersions } from './lib/local'
import { BUILTIN_PAPER_TEMPLATES } from './lib/templates'

// Local-only demo mode (npm run dev, then open /?demo) to try the app without signing in.
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

const CLOUD_SAVE_DELAY = 8000;   // auto-save to the cloud this long after the last change
const LOCAL_SAVE_DELAY = 1200;   // auto-save to the phone almost immediately
const TRASH_DAYS = 30;

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked or full */ } },
  json: (k, fallback) => { try { const v = localStorage.getItem(k); return v && v !== 'undefined' ? JSON.parse(v) : fallback; } catch { return fallback; } },
};
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

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const Modal = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center print:hidden" onClick={onClose}>
    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mt-3 sm:hidden" />
      <div className="flex justify-between items-center px-5 pt-3 sm:pt-5 pb-2">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 flex items-center justify-center"><Icon name="X" /></button>
      </div>
      <div className="px-5 pb-5 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 pb-6 pt-2 border-t border-gray-100">{footer}</div>}
    </div>
  </div>
);

const MenuItem = ({ icon, label, onClick, dot, danger, hint }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-2 py-3.5 rounded-xl hover:bg-gray-50 text-left ${danger ? 'text-red-600' : 'text-gray-800'}`}>
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-50' : 'bg-gray-100 text-gray-600'}`}><Icon name={icon} size={20} /></span>
    <span className="flex-1 min-w-0"><span className="block text-base font-medium">{label}</span>{hint && <span className="block text-xs text-gray-500">{hint}</span>}</span>
    {dot && <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
  </button>
);

const NavButton = ({ icon, label, active, onClick, disabled }) => (
  <button onClick={onClick} disabled={disabled} className={`flex-1 flex flex-col items-center justify-center gap-1 pt-2 pb-1.5 disabled:opacity-40 ${active ? 'text-indigo-700' : 'text-gray-500'}`}>
    <span className={`h-8 w-14 rounded-full flex items-center justify-center ${active ? 'bg-indigo-100' : ''}`}><Icon name={icon} size={22} strokeWidth={active ? 2.4 : 2} /></span>
    <span className="text-xs font-bold">{label}</span>
  </button>
);

const IconButton = ({ icon, label, onClick, disabled, className = '' }) => (
  <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`w-11 h-11 rounded-full hover:bg-gray-100 text-gray-700 flex items-center justify-center disabled:opacity-30 shrink-0 ${className}`}><Icon name={icon} size={22} /></button>
);

const TOOLS = [
  { id: 'papers', icon: 'FileText', name: 'Paper Maker', desc: 'Exam papers & answer keys', ready: true },
  { id: 'marks', icon: 'BarChart3', name: 'Marks Register', desc: 'Enter marks, get results', ready: false },
  { id: 'worksheets', icon: 'ClipboardList', name: 'Worksheets', desc: 'Quick class worksheets', ready: false },
  { id: 'more', icon: 'LayoutGrid', name: 'More tools', desc: 'Tell us what you need', ready: false },
];

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading'); // loading | login | dashboard | editor | preview
  const [previewMode, setPreviewMode] = useState('paper'); // paper | key
  const [savedPapers, setSavedPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [syncState, setSyncState] = useState('idle'); // idle | saving | saved | offline | error
  const [pdfProgress, setPdfProgress] = useState(null);
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [isNewPaper, setIsNewPaper] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
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
  const pagesRef = useRef(null);

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  const [schoolSettings, setSchoolSettings] = useState(() => store.json('schoolSettings', DEFAULT_SCHOOL_INFO));
  const [header, setHeader] = useState(() => defaultsFor('lsd').header);
  const [subjects, setSubjects] = useState(() => defaultsFor('lsd').subjects);
  const [layout, setLayout] = useState(() => defaultsFor('lsd').layout);

  // ---- change tracking ----
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const snapshot = JSON.stringify({ header, subjects, layout });
  const inPaper = appState === 'editor' || appState === 'preview';
  const isDirty = inPaper && savedSnapshot !== null && snapshot !== savedSnapshot;
  const hasNews = seenVersion !== LATEST_VERSION;
  const uiZoom = UI_ZOOM[appSettings.uiSize] || 1;

  const showToast = (msg, kind = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2800); };

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
  const applySnapshot = (json) => {
    const d = JSON.parse(json);
    history.current.applying = true;
    setHeader(d.header); setSubjects(d.subjects); setLayout(d.layout);
  };
  const undo = () => { const h = history.current; if (!h.past.length) return; h.future.push(h.last); applySnapshot(h.past.pop()); };
  const redo = () => { const h = history.current; if (!h.future.length) return; h.past.push(h.last); applySnapshot(h.future.pop()); };
  const [, forceTick] = useState(0);
  useEffect(() => { forceTick(t => t + 1); }, [snapshot]);
  useEffect(() => {
    const onKey = (e) => {
      if (!inPaper || !(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'z') return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

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
  }, []);

  // Offer to continue a paper whose latest changes never reached the cloud (closed app, no internet…).
  useEffect(() => {
    if (appState !== 'dashboard' || papersLoading) return;
    loadDraft().then(d => {
      if (!d || !d.unsynced || !d.data) return setRecoverDraft(null);
      const cloud = savedPapers.find(p => p.id === d.paperId);
      if (cloud && cloud.lastEdited && new Date(cloud.lastEdited).getTime() >= d.savedAt) return setRecoverDraft(null);
      setRecoverDraft(d);
    });
  }, [appState, papersLoading, savedPapers]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) {
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') return signInWithRedirect(auth, googleProvider);
      if (error?.code !== 'auth/popup-closed-by-user' && error?.code !== 'auth/cancelled-popup-request') { console.error(error); alert('Sign-in failed. Please check your internet connection and try again.'); }
    }
  };
  const handleLogout = async () => {
    if (!window.confirm('Sign out of this device?')) return;
    try { await signOut(auth); setModal(null); setAppState('login'); } catch (error) { console.error(error); }
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
  const saveTemplate = (t) => { if (updateTemplates([{ id: uid(), createdAt: new Date().toISOString(), ...t, data: JSON.parse(JSON.stringify(t.data)) }, ...templates])) showToast('Saved to your templates'); };
  const deleteTemplate = (id) => updateTemplates(templates.filter(t => t.id !== id));

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { updateSchoolSettings({ ...schoolSettings, logo: await resizeImage(file) }); }
    catch { alert('Could not read that image. Please try a PNG or JPG.'); }
  };
  const closeSettings = () => { setModal(null); userDocWrite({ schoolSettings }); };

  // ---- papers ----
  const loadUserPapers = async (userId) => {
    try {
      const snap = await getDocs(query(collection(db, 'papers'), where('userId', '==', userId)));
      const papers = [];
      snap.forEach((d) => papers.push({ id: d.id, ...d.data() }));
      papers.sort((a, b) => (b.lastEdited || '').localeCompare(a.lastEdited || ''));
      // Empty the trash of anything older than 30 days.
      const cutoff = Date.now() - TRASH_DAYS * 86400000;
      papers.filter(p => p.deletedAt && new Date(p.deletedAt).getTime() < cutoff).forEach(p => deleteDoc(doc(db, 'papers', p.id)).catch(() => {}));
      setSavedPapers(papers.filter(p => !(p.deletedAt && new Date(p.deletedAt).getTime() < cutoff)));
    } catch (error) { console.error('Error loading papers:', error); }
    setPapersLoading(false);
  };

  const cloudSave = useCallback(async ({ manual = false } = {}) => {
    if (!user || !currentPaperId) return;
    const payload = { userId: user.uid, authorName: user.displayName, header, subjects, layout, schoolBranding: schoolSettings, lastEdited: new Date().toISOString(), deletedAt: null };
    if (paperSizeKb(payload) > 950) {
      setSyncState('error');
      if (manual) alert('This paper is too big to save online (pictures take a lot of space). It is kept on this phone. Please remove a picture or use smaller ones.');
      return;
    }
    const thisSnapshot = snapshot;
    setSyncState('saving');
    try {
      if (!DEMO) {
        const write = setDoc(doc(db, 'papers', currentPaperId), payload);
        // Offline: Firestore keeps the write on the phone and uploads it automatically later.
        if (navigator.onLine) await write; else write.catch(err => console.error(err));
      }
      setSavedSnapshot(thisSnapshot);
      setIsNewPaper(false);
      setSyncState(navigator.onLine || DEMO ? 'saved' : 'offline');
      setSavedPapers(list => [{ id: currentPaperId, ...payload }, ...list.filter(p => p.id !== currentPaperId)]);
      saveDraft({ paperId: currentPaperId, data: JSON.parse(thisSnapshot), unsynced: !navigator.onLine && !DEMO });
      addVersion(currentPaperId, JSON.parse(thisSnapshot));
      if (manual) showToast(navigator.onLine || DEMO ? 'Saved' : 'Saved on this phone — will upload when online');
    } catch (error) {
      console.error(error);
      setSyncState('error');
      if (manual) alert('Could not save online. Your work is safe on this phone; we will keep trying.');
    }
  }, [user, currentPaperId, header, subjects, layout, schoolSettings, snapshot]);

  // ---- auto-save: phone first (fast), then cloud (a few seconds after typing stops) ----
  useEffect(() => {
    if (!inPaper || !currentPaperId || !isDirty) return;
    const local = setTimeout(() => saveDraft({ paperId: currentPaperId, data: JSON.parse(snapshot), unsynced: true }), LOCAL_SAVE_DELAY);
    const cloud = setTimeout(() => cloudSave(), CLOUD_SAVE_DELAY);
    return () => { clearTimeout(local); clearTimeout(cloud); };
  }, [snapshot, inPaper, currentPaperId, isDirty, cloudSave]);

  // Save when the app is hidden (switching apps, locking the phone) and warn before closing with unsaved work.
  useEffect(() => {
    if (!isDirty) return;
    const onHide = () => { if (document.visibilityState === 'hidden') { saveDraft({ paperId: currentPaperId, data: JSON.parse(snapshot), unsynced: true }); cloudSave(); } };
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', warn);
    return () => { document.removeEventListener('visibilitychange', onHide); window.removeEventListener('beforeunload', warn); };
  }, [isDirty, snapshot, currentPaperId, cloudSave]);

  // Retry once the connection comes back.
  useEffect(() => { if (online && isDirty && (syncState === 'offline' || syncState === 'error')) cloudSave(); }, [online]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadIntoEditor = (id, h, s, l, { isNew = false } = {}) => {
    const paperId = id || doc(collection(db, 'papers')).id;
    setCurrentPaperId(paperId);
    setIsNewPaper(isNew);
    setHeader(h); setSubjects(s); setLayout(l);
    // A brand-new paper only gets saved once the teacher changes something.
    setSavedSnapshot(JSON.stringify({ header: h, subjects: s, layout: l }));
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
    loadIntoEditor(null, normalizeHeader(d.header), normalizeSubjects(d.subjects), normalizeLayout(d.layout), { isNew: true });
  };
  const openSavedPaper = (paper) => loadIntoEditor(paper.id, normalizeHeader(paper.header), normalizeSubjects(paper.subjects), normalizeLayout(paper.layout));
  const duplicatePaper = (paper) => {
    loadIntoEditor(null, normalizeHeader(paper.header), normalizeSubjects(cloneWithNewIds(paper.subjects || [])), normalizeLayout(paper.layout), { isNew: true });
    setSavedSnapshot(''); // a copy is "changed" from the start so it gets saved
    showToast('Copy created');
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

  const backToDashboard = () => {
    if (isDirty) { cloudSave(); }
    if (currentPaperId && !isNewPaper) addVersion(currentPaperId, JSON.parse(snapshot));
    setAppState('dashboard');
    window.scrollTo(0, 0);
  };

  const goTo = (state, mode) => {
    if (mode) setPreviewMode(mode);
    if (state !== appState) { setAppState(state); if (state === 'preview' || !activeId) window.scrollTo(0, 0); }
    else if (mode && mode !== previewMode) window.scrollTo(0, 0);
  };

  const handleDownloadPdf = async () => {
    if (appState !== 'preview') { goTo('preview'); showToast('Showing the pages — tap PDF again to download'); return; }
    if (!pagesRef.current) return;
    const suffix = previewMode === 'key' ? ` - ${langOf(layout).t.answerKey}` : '';
    try {
      // Browsers refuse right-to-left characters in download names, so LSD papers get an English name.
      const rtl = /[\u0590-\u08FF]/;
      const named = `${header.className} - ${header.examName} ${header.hijriYear}`;
      const base = rtl.test(named) ? `LSD ${previewMode === 'key' ? 'Answer Key' : 'Paper'} - ${header.hijriYear} - ${header.paperNumber || ''} - ${new Date().toISOString().slice(0, 10)}` : `${named}${suffix}`;
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

  // ---------------------------------------------------------------------------
  if (appState === 'loading') {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-5"><Wordmark size="lg" subtitle="Teacher Tools" /><Icon name="Loader2" size={28} className="text-indigo-600" /></div>;
  }

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          <div className="flex justify-center mb-6"><Wordmark size="lg" subtitle="Teacher Tools" /></div>
          <p className="text-gray-600 mb-8">Make beautiful exam papers and answer keys, and print them as A4 PDFs — on your phone.</p>
          <button onClick={handleLogin} className="w-full bg-indigo-600 text-white font-bold text-lg py-4 px-4 rounded-2xl hover:bg-indigo-700 shadow-md">Sign in with Google</button>
          {!online && <p className="text-amber-600 text-sm mt-4">You are offline. Connect to the internet to sign in.</p>}
        </div>
      </div>
    );
  }

  const activePapers = savedPapers.filter(p => !p.deletedAt);
  const trashedPapers = savedPapers.filter(p => p.deletedAt);
  const filteredPapers = activePapers.filter(p => {
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return [p.header?.className, p.header?.examName, p.header?.paperNumber, ...(p.subjects || []).map(s => s.title)].join(' ').toLowerCase().includes(t);
  });
  const L = langOf(layout);
  const canUndo = history.current.past.length > 0;
  const canRedo = history.current.future.length > 0;
  const status = isNewPaper && !isDirty ? 'New paper — saves automatically'
    : syncState === 'saving' ? 'Saving…'
    : syncState === 'offline' ? 'Saved on phone · will upload when online'
    : syncState === 'error' ? 'Not saved online yet — will retry'
    : isDirty ? 'Editing…' : 'All changes saved';

  return (
    <div className="min-h-screen bg-gray-100 pb-24 sm:pb-10 print:pb-0 print:min-h-0 print:bg-white">

      {toast && <div className={`fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-xl text-base font-bold print:hidden max-w-[90vw] text-center ${toast.kind === 'warn' ? 'bg-amber-500 text-white' : 'bg-gray-900 text-white'}`}>{toast.msg}</div>}

      {/* ---------------- TOP BAR ---------------- */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 print:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-5xl mx-auto flex items-center gap-1 px-2 sm:px-3 h-16">
          {inPaper ? (
            <>
              <IconButton icon="ArrowLeft" label="Back to home" onClick={backToDashboard} />
              <div className="flex-1 min-w-0 px-1">
                <div className={`${L.fontClass} text-lg font-bold text-gray-800 truncate leading-tight`} dir={L.dir}>{header.examName} — {header.className}</div>
                <div className={`text-xs flex items-center gap-1 ${syncState === 'error' ? 'text-amber-600' : 'text-gray-500'}`}>
                  <Icon name={syncState === 'saving' ? 'Loader2' : syncState === 'offline' || !online ? 'WifiOff' : isDirty ? 'CloudUpload' : 'CloudCheck'} size={13} />
                  <span className="truncate">{status}{pageCount && appState === 'preview' ? ` · ${pageCount} page${pageCount === 1 ? '' : 's'}` : ''}</span>
                </div>
              </div>
              <IconButton icon="Undo2" label="Undo" onClick={undo} disabled={!canUndo} />
              <IconButton icon="Redo2" label="Redo" onClick={redo} disabled={!canRedo} className="hidden sm:flex" />
              <div className="hidden sm:flex items-center gap-2 ms-2">
                <div className="flex bg-gray-100 p-1 rounded-xl">
                  {[['editor', null, 'Pencil', 'Edit'], ['preview', 'paper', 'Eye', 'Preview'], ['preview', 'key', 'KeyRound', 'Answer key']].map(([st, mode, ic, label]) => {
                    const on = appState === st && (!mode || previewMode === mode);
                    return <button key={label} onClick={() => goTo(st, mode)} className={`px-3 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5 ${on ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}><Icon name={ic} size={16} />{label}</button>;
                  })}
                </div>
                <button onClick={handleDownloadPdf} disabled={!!pdfProgress} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-900 text-white inline-flex items-center gap-1.5"><Icon name={pdfProgress ? 'Loader2' : 'Download'} size={16} />{pdfProgress ? `PDF ${pdfProgress}` : 'PDF'}</button>
              </div>
              <IconButton icon="MoreVertical" label="Paper options" onClick={() => setModal('paperMenu')} />
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0 ps-1"><Wordmark subtitle="Teacher Tools" /></div>
              {!online && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full shrink-0 inline-flex items-center gap-1"><Icon name="WifiOff" size={12} />Offline</span>}
              <button onClick={() => setModal('menu')} aria-label="Menu" className="w-11 h-11 rounded-full hover:bg-gray-100 text-gray-700 shrink-0 relative flex items-center justify-center">
                <Icon name="Menu" size={24} />{hasNews && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />}
              </button>
            </>
          )}
        </div>
      </header>

      {needRefresh && (
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between gap-3 print:hidden">
          <span className="text-sm font-bold inline-flex items-center gap-2"><Icon name="Sparkles" size={16} />A new version of the app is ready.</span>
          <button onClick={() => updateServiceWorker(true)} className="bg-white text-indigo-700 font-bold text-sm px-4 py-2 rounded-xl">Update</button>
        </div>
      )}

      {/* ---------------- HOME ---------------- */}
      {appState === 'dashboard' && (
        <main className="max-w-5xl mx-auto px-4 pt-5" style={{ zoom: uiZoom }}>
          <div className="mb-5">
            <div className="text-sm text-gray-500">Salaam,</div>
            <div className="text-2xl font-bold text-gray-900 truncate">{user?.displayName}</div>
          </div>

          {recoverDraft && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5 flex items-center gap-3">
              <Icon name="RotateCcw" size={24} className="text-amber-600" />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800">Continue where you left off?</div>
                <div className="text-sm text-gray-600 truncate">{recoverDraft.data?.header?.examName} — {recoverDraft.data?.header?.className} · {timeAgo(recoverDraft.savedAt)}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={() => { const d = recoverDraft.data; loadIntoEditor(recoverDraft.paperId, normalizeHeader(d.header), normalizeSubjects(d.subjects), normalizeLayout(d.layout)); setSavedSnapshot(''); setRecoverDraft(null); }} className="bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-sm">Open</button>
                <button onClick={() => { clearDraft(); setRecoverDraft(null); }} className="text-xs text-gray-500">Discard</button>
              </div>
            </div>
          )}

          {!isStandalone() && (installEvent || isIOS()) && !installDismissed && (
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 mb-5 flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center"><Icon name="Smartphone" size={22} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800">Install LSD on your phone</div>
                <div className="text-sm text-gray-500">Opens like an app, works without internet.</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={handleInstall} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Install</button>
                <button onClick={() => { store.set('installDismissed', '1'); setInstallDismissed(true); }} className="text-xs text-gray-400">Not now</button>
              </div>
            </div>
          )}

          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Teacher Tools</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
            {TOOLS.map(t => (
              <button key={t.id} onClick={() => (t.ready ? document.getElementById('papers')?.scrollIntoView({ behavior: 'smooth' }) : showToast(`${t.name} is coming soon. Tell us what you need!`))}
                className={`relative text-left rounded-2xl p-3.5 border ${t.ready ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-800'}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${t.ready ? 'bg-white/15' : 'bg-gray-100 text-gray-600'}`}><Icon name={t.icon} size={20} /></span>
                <span className="block font-bold leading-tight">{t.name}</span>
                <span className={`block text-xs mt-0.5 ${t.ready ? 'text-indigo-100' : 'text-gray-500'}`}>{t.desc}</span>
                {!t.ready && <span className="absolute top-3 right-3 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">SOON</span>}
              </button>
            ))}
          </div>

          <div id="papers" className="flex items-center justify-between gap-3 mb-3 scroll-mt-20">
            <h2 className="text-lg font-bold text-gray-800">My papers <span className="text-gray-400 font-normal">({activePapers.length})</span></h2>
            <button onClick={() => setModal('newPaper')} className="bg-indigo-600 text-white font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"><Icon name="Plus" size={18} />New paper</button>
          </div>
          {activePapers.length > 3 && (
            <div className="relative mb-4">
              <Icon name="Search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search class, exam or subject" className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 bg-white" dir="auto" />
            </div>
          )}

          {papersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{[0, 1, 2].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse" />)}</div>
          ) : filteredPapers.length === 0 ? (
            <div className="text-gray-500 text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-gray-300">{search ? 'No papers match your search.' : 'No papers yet. Tap "New paper" to make your first one!'}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredPapers.map(paper => {
                const PL = langOf(paper.layout);
                return (
                  <div key={paper.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col">
                    <button onClick={() => openSavedPaper(paper)} className="p-4 text-start flex-1 hover:bg-gray-50" dir={PL.dir}>
                      <span className="flex items-center gap-2 mb-2" dir="ltr">
                        <span className={`bg-indigo-50 text-indigo-700 ${PL.fontClass} text-sm font-bold px-2.5 py-0.5 rounded-lg`} dir={PL.dir}>{paper.header?.className || '—'}</span>
                        {paper.layout?.language === 'en' && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">EN</span>}
                      </span>
                      <span className={`block text-xl font-bold ${PL.fontClass} text-gray-800 leading-snug`}>{paper.header?.examName || 'Untitled'} {PL.num(paper.header?.hijriYear || '')}{PL.yearSuffix}</span>
                      <span className={`block text-base text-gray-600 ${PL.fontClass} truncate`}>{(paper.subjects || []).map(s => s.title).join(PL.dir === 'rtl' ? ' ، ' : ', ') || '—'}</span>
                    </button>
                    <div className="flex items-center border-t border-gray-100 text-sm">
                      <span className="flex-1 px-4 text-gray-400 text-xs">{paper.lastEdited ? timeAgo(new Date(paper.lastEdited).getTime()) : ''}</span>
                      <button onClick={() => duplicatePaper(paper)} aria-label="Make a copy" className="px-3.5 py-3 text-gray-500 hover:bg-gray-50 inline-flex items-center gap-1.5 font-bold"><Icon name="Copy" size={16} />Copy</button>
                      <button onClick={() => trashPaper(paper)} aria-label="Move to trash" className="px-3.5 py-3 text-gray-400 hover:text-red-600 hover:bg-red-50"><Icon name="Trash2" size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {trashedPapers.length > 0 && (
            <button onClick={() => setModal('trash')} className="mt-6 mx-auto flex items-center gap-2 text-sm text-gray-500 font-bold px-4 py-2 rounded-xl hover:bg-white"><Icon name="Trash2" size={16} />Trash ({trashedPapers.length})</button>
          )}
        </main>
      )}

      {/* ---------------- EDITOR / PREVIEW ---------------- */}
      {inPaper && (
        <main className="p-3 sm:p-5 print:p-0">
          {appState === 'preview' ? (
            <>
              <div className="max-w-3xl mx-auto mb-3 flex items-center justify-center gap-2 print:hidden">
                <div className="sm:hidden flex bg-white border border-gray-200 p-1 rounded-xl">
                  {[['paper', 'Question paper'], ['key', 'Answer key']].map(([m, label]) => (
                    <button key={m} onClick={() => goTo('preview', m)} className={`px-3 py-1.5 rounded-lg text-sm font-bold ${previewMode === m ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>{label}</button>
                  ))}
                </div>
                <button onClick={() => window.print()} className="bg-white border border-gray-200 text-gray-700 px-3 py-2 rounded-xl font-bold text-sm inline-flex items-center gap-1.5"><Icon name="Printer" size={16} />Print</button>
              </div>
              <PaperPreview mode={previewMode} header={header} subjects={subjects} school={schoolSettings} layout={layout} pagesRef={pagesRef}
                focusQuestionId={activeId} onPageCount={setPageCount}
                onEditQuestion={(qid) => { setActiveId(qid); if (previewMode === 'key') { setShowAnswers(true); store.set('showAnswers', '1'); } setAppState('editor'); }} />
              <p className="text-center text-sm text-gray-500 mt-2 print:hidden">Tap any question to edit it.</p>
            </>
          ) : (
            <div className="print:hidden" style={{ zoom: uiZoom }}>
              <Editor header={header} setHeader={setHeader} subjects={subjects} setSubjects={setSubjects} layout={layout} setLayout={setLayout}
                activeId={activeId} setActiveId={setActiveId}
                showAnswers={showAnswers} setShowAnswers={(v) => { setShowAnswers(v); store.set('showAnswers', v ? '1' : '0'); }}
                templates={templates.filter(t => (t.language || 'lsd') === (layout.language || 'lsd'))} onSaveTemplate={saveTemplate} onDeleteTemplate={deleteTemplate}
                onMakeDefaultStyle={(l) => { updateAppSettings({ defaultLayout: { ...l }, defaultLanguage: l.language || 'lsd' }); showToast('New papers will use this style'); }} />
            </div>
          )}
        </main>
      )}

      {/* ---------------- BOTTOM NAV (phones) ---------------- */}
      {inPaper && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex print:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <NavButton icon="Pencil" label="Edit" active={appState === 'editor'} onClick={() => goTo('editor')} />
          <NavButton icon="Eye" label="Preview" active={appState === 'preview' && previewMode === 'paper'} onClick={() => goTo('preview', 'paper')} />
          <NavButton icon="KeyRound" label="Answers" active={appState === 'preview' && previewMode === 'key'} onClick={() => goTo('preview', 'key')} />
          <NavButton icon={pdfProgress ? 'Loader2' : 'Download'} label={pdfProgress || 'PDF'} onClick={handleDownloadPdf} disabled={!!pdfProgress} />
        </nav>
      )}

      {/* ---------------- MODALS ---------------- */}
      {modal === 'menu' && (
        <Modal title="Menu" onClose={() => setModal(null)}>
          <MenuItem icon="School" label="School name & logo" onClick={() => setModal('settings')} />
          <MenuItem icon="Settings" label="App settings" hint="Text size, default language" onClick={() => setModal('appSettings')} />
          <MenuItem icon="Bell" label="What's new" onClick={openWhatsNew} dot={hasNews} />
          {!isStandalone() && <MenuItem icon="Smartphone" label="Install app on this phone" onClick={handleInstall} />}
          <MenuItem icon="Info" label="Help & about" onClick={() => setModal('about')} />
          <MenuItem icon="LogOut" label="Sign out" onClick={handleLogout} danger />
          <div className="text-xs text-gray-400 mt-3 px-2">{user?.email}</div>
        </Modal>
      )}

      {modal === 'paperMenu' && (
        <Modal title="Paper options" onClose={() => setModal(null)}>
          <MenuItem icon="History" label="Version history" hint="Go back to an earlier version" onClick={openHistory} />
          <MenuItem icon="BookmarkPlus" label="Save paper as template" hint="Reuse this layout for new papers" onClick={() => {
            const name = window.prompt('Template name', `${header.examName} — ${header.className}`);
            if (name && name.trim()) { saveTemplate({ kind: 'paper', name: name.trim(), language: layout.language, data: { header, subjects, layout } }); setModal(null); }
          }} />
          <MenuItem icon="Copy" label="Make a copy" onClick={() => duplicatePaper({ header, subjects, layout })} />
          <MenuItem icon="Printer" label="Print" onClick={() => { setModal(null); if (appState !== 'preview') goTo('preview'); setTimeout(() => window.print(), 600); }} />
          {!isNewPaper && <MenuItem icon="Trash2" label="Move to trash" danger onClick={async () => { const p = savedPapers.find(x => x.id === currentPaperId); if (p && await trashPaper(p)) { setModal(null); setAppState('dashboard'); } }} />}
        </Modal>
      )}

      {modal === 'newPaper' && (
        <Modal title="New paper" onClose={() => setModal(null)}>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {Object.entries(LANGUAGES).map(([code, lang]) => (
              <button key={code} onClick={() => startPaper(code)} className="border-2 border-gray-100 hover:border-indigo-500 rounded-2xl p-4 text-left">
                <span className="block text-2xl mb-1 font-bold text-indigo-700"><span className={lang.fontClass}>{code === 'lsd' ? 'لسان الدعوة' : 'English'}</span></span>
                <span className="block font-bold text-gray-800">Blank {lang.name} paper</span>
                <span className="block text-xs text-gray-500">{lang.dir === 'rtl' ? 'Right to left' : 'Left to right'}</span>
              </button>
            ))}
          </div>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">Start from a template</h3>
          <div className="space-y-2">
            {[...templates.filter(t => t.kind === 'paper'), ...BUILTIN_PAPER_TEMPLATES].map(t => (
              <div key={t.id} className="flex items-center border border-gray-200 rounded-xl">
                <button onClick={() => startPaper(t)} className="flex-1 flex items-center gap-3 p-3 text-left min-w-0">
                  <Icon name={t.builtin ? 'Sparkles' : 'Bookmark'} size={20} className={t.builtin ? 'text-amber-500' : 'text-indigo-600'} />
                  <span className="min-w-0"><span className="block font-bold text-gray-800 truncate">{t.name}</span><span className="block text-xs text-gray-500">{LANGUAGES[t.language || 'lsd']?.name}{t.builtin ? ' · ready-made' : ' · yours'}</span></span>
                </button>
                {!t.builtin && <button onClick={() => { if (window.confirm(`Delete template "${t.name}"?`)) deleteTemplate(t.id); }} aria-label="Delete template" className="w-11 h-11 text-gray-400 hover:text-red-600 flex items-center justify-center"><Icon name="Trash2" size={18} /></button>}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {modal === 'history' && (
        <Modal title="Version history" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-500 mb-3">Saved automatically on this phone. Tap a version to go back to it — you can undo this.</p>
          {versions.length === 0 ? <p className="text-gray-500 py-6 text-center">No earlier versions yet.</p> : versions.map((v, i) => {
            const d = JSON.parse(v.json);
            const qCount = (d.subjects || []).reduce((t, s) => t + (s.questions || []).length, 0);
            return (
              <button key={v.at} onClick={() => { if (window.confirm('Go back to this version?')) { applySnapshot(v.json); history.current.applying = false; setModal(null); showToast('Restored — tap Undo to go back'); } }} className="w-full flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-gray-50 text-left border-b border-gray-100">
                <Icon name="History" size={20} className="text-gray-400" />
                <span className="flex-1"><span className="block font-bold text-gray-800">{i === 0 ? 'Latest save' : timeAgo(v.at)}</span><span className="block text-xs text-gray-500">{new Date(v.at).toLocaleString()} · {(d.subjects || []).length} subjects · {qCount} questions</span></span>
              </button>
            );
          })}
        </Modal>
      )}

      {modal === 'trash' && (
        <Modal title="Trash" onClose={() => setModal(null)}>
          <p className="text-sm text-gray-500 mb-3">Papers are deleted forever after {TRASH_DAYS} days.</p>
          {trashedPapers.length === 0 ? <p className="text-gray-500 py-6 text-center">Trash is empty.</p> : trashedPapers.map(p => (
            <div key={p.id} className="flex items-center gap-2 py-3 border-b border-gray-100">
              <div className="flex-1 min-w-0" dir={langOf(p.layout).dir}>
                <div className={`font-bold ${langOf(p.layout).fontClass} text-lg truncate`}>{p.header?.examName} — {p.header?.className}</div>
                <div className="text-xs text-gray-500" dir="ltr">Deleted {timeAgo(new Date(p.deletedAt).getTime())}</div>
              </div>
              <button onClick={() => restorePaper(p)} className="px-3 py-2 rounded-xl border border-indigo-200 text-indigo-700 font-bold text-sm inline-flex items-center gap-1"><Icon name="RotateCcw" size={16} />Restore</button>
              <button onClick={() => deleteForever(p)} aria-label="Delete forever" className="w-10 h-10 rounded-xl text-red-500 flex items-center justify-center"><Icon name="Trash2" size={18} /></button>
            </div>
          ))}
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="School name & logo" onClose={closeSettings} footer={<button onClick={closeSettings} className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold text-lg">Save</button>}>
          <label className="block text-sm font-bold text-gray-600 mb-1">School name</label>
          <input type="text" value={schoolSettings?.nameAr || ''} onChange={(e) => updateSchoolSettings({ ...schoolSettings, nameAr: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-xl mb-5 font-arabic text-2xl" dir="rtl" />
          <label className="block text-sm font-bold text-gray-600 mb-1">Logo</label>
          {schoolSettings?.logo && <div className="mb-3 flex justify-center bg-gray-50 border p-3 rounded-xl"><img src={schoolSettings.logo} alt="Logo" className="h-20 object-contain" /></div>}
          <div className="flex gap-2">
            <label className="flex-1 text-center border-2 border-dashed border-indigo-300 text-indigo-700 font-bold py-3 rounded-xl cursor-pointer inline-flex items-center justify-center gap-2">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" /><Icon name="Upload" size={18} />{schoolSettings?.logo ? 'Change logo' : 'Choose logo'}
            </label>
            {schoolSettings?.logo && <button onClick={() => updateSchoolSettings({ ...schoolSettings, logo: '' })} className="px-4 text-red-600 border border-red-200 rounded-xl font-bold">Remove</button>}
          </div>
        </Modal>
      )}

      {modal === 'appSettings' && (
        <Modal title="App settings" onClose={() => setModal(null)}>
          <div className="py-3 border-b border-gray-100">
            <div className="font-bold text-gray-800 mb-1">App text size</div>
            <div className="text-sm text-gray-500 mb-3">Makes buttons and text bigger in the app (the printed paper does not change).</div>
            <div className="grid grid-cols-3 gap-2">
              {[['normal', 'Normal', 'text-sm'], ['large', 'Large', 'text-base'], ['xlarge', 'Extra large', 'text-lg']].map(([v, label, size]) => (
                <button key={v} onClick={() => updateAppSettings({ uiSize: v })} className={`py-3 rounded-xl border-2 font-bold ${size} ${appSettings.uiSize === v ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div className="py-3 border-b border-gray-100">
            <div className="font-bold text-gray-800 mb-3">Language for new papers</div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(LANGUAGES).map(([code, lang]) => (
                <button key={code} onClick={() => updateAppSettings({ defaultLanguage: code })} className={`py-3 rounded-xl border-2 font-bold ${appSettings.defaultLanguage === code ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-200'}`}><span className={lang.fontClass}>{code === 'lsd' ? 'لسان الدعوة' : 'English'}</span></button>
              ))}
            </div>
          </div>
          <div className="py-3">
            <div className="font-bold text-gray-800 mb-1">Default page style</div>
            <div className="text-sm text-gray-500 mb-3">{appSettings.defaultLayout ? 'Your saved style is used for new papers.' : 'Open a paper → Page style → "Use this style for all my new papers".'}</div>
            {appSettings.defaultLayout && <button onClick={() => updateAppSettings({ defaultLayout: null })} className="text-sm font-bold text-red-600">Reset to standard style</button>}
          </div>
        </Modal>
      )}

      {modal === 'whatsNew' && (
        <Modal title="What's new" onClose={() => setModal(null)}>
          {WHATS_NEW.map(rel => (
            <div key={rel.version} className="mb-5">
              <div className="text-sm font-bold text-indigo-700 mb-2">Version {rel.version} · {rel.date}</div>
              <ul className="space-y-2">{rel.items.map(it => <li key={it} className="flex gap-2 text-gray-700"><Icon name="Check" size={18} className="text-indigo-500 mt-0.5" />{it}</li>)}</ul>
            </div>
          ))}
        </Modal>
      )}

      {modal === 'install' && (
        <Modal title="Install the app" onClose={() => setModal(null)}>
          {isIOS() ? (
            <ol className="space-y-3 text-gray-700 text-lg list-decimal pl-6">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button at the bottom.</li>
              <li>Choose <b>Add to Home Screen</b>.</li>
            </ol>
          ) : (
            <ol className="space-y-3 text-gray-700 text-lg list-decimal pl-6">
              <li>Open this page in <b>Chrome</b>.</li>
              <li>Tap the <b>⋮</b> menu at the top right.</li>
              <li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li>
            </ol>
          )}
        </Modal>
      )}

      {modal === 'about' && (
        <Modal title="Help & about" onClose={() => setModal(null)}>
          <div className="flex justify-center mb-4"><BrandMark size={64} /></div>
          <p className="text-gray-600 leading-relaxed mb-4 text-center">Teacher tools for Lisan ud Dawat and English — create, format and print beautifully packed A4 exam papers and answer keys.</p>
          <h3 className="font-bold text-gray-800 mb-2">Quick help</h3>
          <ul className="text-gray-600 space-y-2 mb-5 list-disc pl-5">
            <li>Your work <b>saves automatically</b>, even without internet.</li>
            <li><b>Edit</b>: tap a question to open it, tap <b>Done</b> to fold it.</li>
            <li><b>Preview</b>: the real A4 pages. Tap a question there to edit it.</li>
            <li><b>Answers</b>: turn on "Answers" in the editor, fill the green boxes, and download the answer key.</li>
            <li><b>Templates</b>: save any question or paper and reuse it later.</li>
            <li>Made a mistake? Tap <b>Undo</b>, or ⋮ → <b>Version history</b>.</li>
          </ul>
          <div className="text-xs text-gray-400 border-t pt-3 text-center">Made with care by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noreferrer" className="underline">S. Shakir</a> · v{LATEST_VERSION}</div>
        </Modal>
      )}
    </div>
  );
}

export default App
