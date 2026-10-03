import { useState, useEffect, useRef } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, getDocs, query, where, doc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth'
import { useRegisterSW } from 'virtual:pwa-register/react'
import Editor from './components/Editor'
import PaperPreview from './components/PaperPreview'
import { DEFAULT_SCHOOL_INFO, DEFAULT_HEADER, DEFAULT_LAYOUT, uid, toArabicNumerals, normalizeSubjects, normalizeHeader, normalizeLayout, paperSizeKb } from './lib/paper'
import { downloadPdf, resizeImage } from './lib/pdf'
import { WHATS_NEW, LATEST_VERSION } from './lib/whatsNew'

// Local-only demo mode (npm run dev, then open /?demo) to try the editor without signing in.
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

const freshSubjects = () => [{ id: uid(), title: 'تعليم القرآن', questions: [] }];
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked or full */ } },
};
const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// ---------------------------------------------------------------------------
// Small UI pieces
// ---------------------------------------------------------------------------
const Modal = ({ title, onClose, children, footer }) => (
  <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center print:hidden" onClick={onClose}>
    <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center px-5 pt-5 pb-3">
        <h2 className="text-xl font-bold text-gray-800">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="w-10 h-10 rounded-full hover:bg-gray-100 text-gray-500 text-xl">✕</button>
      </div>
      <div className="px-5 pb-5 overflow-y-auto">{children}</div>
      {footer && <div className="px-5 pb-6 pt-2 border-t border-gray-100">{footer}</div>}
    </div>
  </div>
);

const NavButton = ({ icon, label, active, onClick, disabled, badge }) => (
  <button onClick={onClick} disabled={disabled} className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 relative disabled:opacity-40 ${active ? 'text-indigo-700' : 'text-gray-500'}`}>
    <span className={`text-xl leading-none px-4 py-1 rounded-full ${active ? 'bg-indigo-100' : ''}`}>{icon}</span>
    <span className="text-xs font-bold">{label}</span>
    {badge && <span className="absolute top-1.5 right-1/2 translate-x-5 w-2.5 h-2.5 bg-red-500 rounded-full" />}
  </button>
);

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading'); // loading | login | dashboard | editor | preview
  const [savedPapers, setSavedPapers] = useState([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null);
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [modal, setModal] = useState(null); // settings | about | whatsNew | install | menu
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');
  const [activeId, setActiveId] = useState(null); // question being edited — kept in sync with the preview
  const [pageCount, setPageCount] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [installEvent, setInstallEvent] = useState(null);
  const [seenVersion, setSeenVersion] = useState(() => store.get('seenVersion'));
  const [installDismissed, setInstallDismissed] = useState(() => store.get('installDismissed') === '1');
  const pagesRef = useRef(null);

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  const [schoolSettings, setSchoolSettings] = useState(() => {
    try {
      const saved = store.get('schoolSettings');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_SCHOOL_INFO;
    } catch { return DEFAULT_SCHOOL_INFO; }
  });

  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [subjects, setSubjects] = useState(freshSubjects);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  // Track unsaved changes so work is never lost by accident.
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const snapshot = JSON.stringify({ header, subjects, layout });
  const inPaper = appState === 'editor' || appState === 'preview';
  const isDirty = inPaper && savedSnapshot !== null && snapshot !== savedSnapshot;
  const hasNews = seenVersion !== LATEST_VERSION;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    const onPrompt = (e) => { e.preventDefault(); setInstallEvent(e); };
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); window.removeEventListener('beforeinstallprompt', onPrompt); };
  }, []);

  const showToast = (msg, kind = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2800); };

  useEffect(() => {
    if (DEMO) {
      setUser({ uid: 'demo', displayName: 'Demo Teacher', email: 'demo@local' });
      setAppState('dashboard');
      import('./lib/demoPaper').then(m => { setSavedPapers([m.default]); setPapersLoading(false); });
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAppState(s => (s === 'loading' || s === 'login' ? 'dashboard' : s));
        loadUserSettings(currentUser.uid);
        loadUserPapers(currentUser.uid);
      } else { setUser(null); setAppState('login'); }
    });
    return () => unsubscribe();
  }, []);

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

  // --- SETTINGS ---
  const loadUserSettings = async (userId) => {
    try {
      const snap = await getDoc(doc(db, 'users', userId));
      if (snap.exists() && snap.data().schoolSettings) {
        setSchoolSettings(snap.data().schoolSettings);
        store.set('schoolSettings', JSON.stringify(snap.data().schoolSettings));
      }
    } catch (error) { console.error('Error loading user settings:', error); }
  };

  const updateSchoolSettings = (s) => { setSchoolSettings(s); store.set('schoolSettings', JSON.stringify(s)); };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { updateSchoolSettings({ ...schoolSettings, logo: await resizeImage(file) }); }
    catch { alert('Could not read that image. Please try a PNG or JPG.'); }
  };

  const closeSettings = () => {
    setModal(null);
    if (!user || DEMO) return;
    setDoc(doc(db, 'users', user.uid), { schoolSettings }, { merge: true }).catch(error => console.error('Error saving settings:', error));
  };

  // --- PAPERS ---
  const loadUserPapers = async (userId) => {
    try {
      const snap = await getDocs(query(collection(db, 'papers'), where('userId', '==', userId)));
      const papers = [];
      snap.forEach((d) => papers.push({ id: d.id, ...d.data() }));
      papers.sort((a, b) => (b.lastEdited || '').localeCompare(a.lastEdited || ''));
      setSavedPapers(papers);
    } catch (error) { console.error('Error loading papers:', error); }
    setPapersLoading(false);
  };

  const savePaper = async () => {
    if (!user) return;
    const payload = { userId: user.uid, authorName: user.displayName, header, subjects, layout, schoolBranding: schoolSettings, lastEdited: new Date().toISOString() };
    if (paperSizeKb(payload) > 950) {
      alert('This paper is too big to save (pictures take a lot of space). Please remove a picture or choose smaller ones.');
      return;
    }
    setIsSaving(true);
    const id = currentPaperId || doc(collection(db, 'papers')).id;
    try {
      if (!DEMO) {
        const write = setDoc(doc(db, 'papers', id), payload);
        // Offline: the write is kept on the device and uploaded automatically later.
        if (navigator.onLine) await write; else write.catch(err => console.error(err));
      }
      setCurrentPaperId(id);
      setSavedSnapshot(snapshot);
      setSavedPapers(list => [{ id, ...payload }, ...list.filter(p => p.id !== id)]);
      showToast(navigator.onLine || DEMO ? 'Saved ✓' : 'Saved on this phone — will upload when online');
    } catch (error) {
      console.error(error);
      alert('Could not save. Please check your internet connection and try again.');
    }
    setIsSaving(false);
  };

  const deletePaper = async (paper) => {
    if (!window.confirm(`Delete "${paper.header?.examName || 'this paper'}" (${paper.header?.className || ''}) permanently?`)) return;
    try {
      if (!DEMO) await deleteDoc(doc(db, 'papers', paper.id));
      setSavedPapers(savedPapers.filter(p => p.id !== paper.id));
      showToast('Paper deleted');
    } catch (error) { console.error(error); alert('Failed to delete.'); }
  };

  const loadIntoEditor = (id, h, s, l) => {
    setCurrentPaperId(id);
    setHeader(h); setSubjects(s); setLayout(l);
    setSavedSnapshot(id ? JSON.stringify({ header: h, subjects: s, layout: l }) : '');
    setActiveId(null);
    setPageCount(null);
    setAppState('editor');
    window.scrollTo(0, 0);
  };

  const startNewPaper = () => loadIntoEditor(null, DEFAULT_HEADER, freshSubjects(), DEFAULT_LAYOUT);
  const openSavedPaper = (paper) => loadIntoEditor(paper.id, normalizeHeader(paper.header), normalizeSubjects(paper.subjects), normalizeLayout(paper.layout));
  const duplicatePaper = (paper) => {
    loadIntoEditor(null, normalizeHeader(paper.header), normalizeSubjects(paper.subjects), normalizeLayout(paper.layout));
    showToast('Copy opened — tap Save to keep it');
  };

  const backToDashboard = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setAppState('dashboard');
    window.scrollTo(0, 0);
  };

  const goTo = (state) => { if (state !== appState) { setAppState(state); if (state === 'preview' || !activeId) window.scrollTo(0, 0); } };

  const handleDownloadPdf = async () => {
    if (appState !== 'preview') { goTo('preview'); showToast('Opening preview… tap PDF again'); return; }
    if (!pagesRef.current) return;
    try {
      await downloadPdf(pagesRef.current, `${header.className} - ${header.examName} ${header.hijriYear}.pdf`, (i, n) => setPdfProgress(`${i}/${n}`));
    } catch (error) { console.error(error); alert('Could not create the PDF. Please try "Print" instead.'); }
    setPdfProgress(null);
  };

  const handleInstall = async () => {
    if (installEvent) {
      installEvent.prompt();
      const { outcome } = await installEvent.userChoice;
      if (outcome === 'accepted') { setInstallEvent(null); showToast('App installed 🎉'); }
      setModal(null);
    } else setModal('install');
  };

  const openWhatsNew = () => { setModal('whatsNew'); setSeenVersion(LATEST_VERSION); store.set('seenVersion', LATEST_VERSION); };

  // ---------------------------------------------------------------------------
  if (appState === 'loading') {
    return <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-indigo-700"><img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="w-20 h-20 rounded-2xl shadow-lg" /><div className="w-9 h-9 border-4 border-indigo-200 border-t-indigo-700 rounded-full animate-spin" /></div>;
  }

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-gray-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full text-center">
          <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="w-20 h-20 rounded-2xl mx-auto mb-5 shadow-lg" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Exam Paper Generator</h1>
          <p className="text-gray-500 mb-8">Make beautiful Lisan ud Dawat exam papers and print them as A4 PDFs.</p>
          <button onClick={handleLogin} className="w-full bg-indigo-600 text-white font-bold text-lg py-4 px-4 rounded-2xl hover:bg-indigo-700 shadow-md">Sign in with Google</button>
          {!online && <p className="text-amber-600 text-sm mt-4">You are offline. Connect to the internet to sign in.</p>}
        </div>
      </div>
    );
  }

  const filteredPapers = savedPapers.filter(p => {
    const t = search.trim();
    if (!t) return true;
    return [p.header?.className, p.header?.examName, p.header?.paperNumber, ...(p.subjects || []).map(s => s.title)].join(' ').toLowerCase().includes(t.toLowerCase());
  });
  const saveLabel = isSaving ? 'Saving…' : isDirty || !currentPaperId ? 'Save' : 'Saved';

  return (
    <div className="min-h-screen bg-gray-100 pb-24 sm:pb-10 print:pb-0 print:min-h-0 print:bg-white">

      {toast && <div className={`fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-xl text-base font-bold print:hidden max-w-[90vw] text-center ${toast.kind === 'warn' ? 'bg-amber-500 text-white' : 'bg-gray-900 text-white'}`}>{toast.msg}</div>}

      {/* ---------------- TOP BAR ---------------- */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200 print:hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-5xl mx-auto flex items-center gap-2 px-3 h-16">
          {inPaper ? (
            <button onClick={backToDashboard} aria-label="Back to my papers" className="w-11 h-11 rounded-full hover:bg-gray-100 text-2xl text-gray-700 shrink-0">←</button>
          ) : (
            <img src={`${import.meta.env.BASE_URL}pwa-192.png`} alt="" className="w-10 h-10 rounded-xl shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            {inPaper ? (
              <>
                <div className="font-arabic text-xl font-bold text-gray-800 truncate leading-tight" dir="rtl">{header.examName} — {header.className}</div>
                <div className="text-xs text-gray-500">{isDirty ? '● Unsaved changes' : currentPaperId ? 'All changes saved' : 'New paper'}{pageCount ? ` · ${pageCount} pages` : ''}</div>
              </>
            ) : (
              <div className="font-bold text-lg text-gray-800 leading-tight">Exam Papers</div>
            )}
          </div>

          {inPaper && (
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex bg-gray-100 p-1 rounded-xl">
                <button onClick={() => goTo('editor')} className={`px-4 py-2 rounded-lg text-sm font-bold ${appState === 'editor' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>✏️ Edit</button>
                <button onClick={() => goTo('preview')} className={`px-4 py-2 rounded-lg text-sm font-bold ${appState === 'preview' ? 'bg-white shadow text-indigo-700' : 'text-gray-500'}`}>👁 Preview</button>
              </div>
              <button onClick={savePaper} disabled={isSaving} className={`px-4 py-2.5 rounded-xl font-bold text-sm ${isDirty || !currentPaperId ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>💾 {saveLabel}</button>
              <button onClick={handleDownloadPdf} disabled={!!pdfProgress} className="px-4 py-2.5 rounded-xl font-bold text-sm bg-gray-900 text-white">{pdfProgress ? `PDF ${pdfProgress}` : '⬇️ PDF'}</button>
            </div>
          )}

          {!online && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-full shrink-0">Offline</span>}
          <button onClick={() => setModal('menu')} aria-label="Menu" className="w-11 h-11 rounded-full hover:bg-gray-100 text-2xl text-gray-700 shrink-0 relative">
            ☰{hasNews && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full" />}
          </button>
        </div>
      </header>

      {needRefresh && (
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between gap-3 print:hidden">
          <span className="text-sm font-bold">✨ A new version of the app is ready.</span>
          <button onClick={() => { if (!isDirty || window.confirm('Update now? Unsaved changes will be lost.')) updateServiceWorker(true); }} className="bg-white text-indigo-700 font-bold text-sm px-4 py-2 rounded-xl">Update</button>
        </div>
      )}

      {/* ---------------- DASHBOARD ---------------- */}
      {appState === 'dashboard' && (
        <main className="max-w-5xl mx-auto px-4 pt-5">
          <div className="flex items-center gap-3 mb-5">
            {user?.photoURL && <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full" />}
            <div className="min-w-0">
              <div className="text-sm text-gray-500">Salaam,</div>
              <div className="text-xl font-bold text-gray-800 truncate">{user?.displayName}</div>
            </div>
          </div>

          {!isStandalone() && (installEvent || isIOS()) && !installDismissed && (
            <div className="bg-white border border-indigo-100 rounded-2xl p-4 mb-5 flex items-center gap-3 shadow-sm">
              <span className="text-3xl">📲</span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-800">Install the app</div>
                <div className="text-sm text-gray-500">Open it from your home screen, even without internet.</div>
              </div>
              <div className="flex flex-col gap-1">
                <button onClick={handleInstall} className="bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-sm">Install</button>
                <button onClick={() => { store.set('installDismissed', '1'); setInstallDismissed(true); }} className="text-xs text-gray-400">Not now</button>
              </div>
            </div>
          )}

          <button onClick={startNewPaper} className="w-full bg-indigo-600 text-white rounded-2xl p-5 mb-6 flex items-center gap-4 shadow-md hover:bg-indigo-700 text-left">
            <span className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-3xl">+</span>
            <span><span className="block text-lg font-bold">New paper</span><span className="block text-sm text-indigo-100">Start a fresh exam paper</span></span>
          </button>

          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-bold text-gray-800">My papers <span className="text-gray-400 font-normal">({savedPapers.length})</span></h2>
          </div>
          {savedPapers.length > 3 && (
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Search by class, exam or subject" className="w-full h-12 px-4 rounded-xl border border-gray-200 mb-4 bg-white" dir="auto" />
          )}

          {papersLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[0, 1, 2].map(i => <div key={i} className="h-36 bg-white rounded-2xl animate-pulse" />)}</div>
          ) : filteredPapers.length === 0 ? (
            <div className="text-gray-500 text-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">{search ? 'No papers match your search.' : 'No papers yet. Tap "New paper" to make your first one!'}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPapers.map(paper => (
                <div key={paper.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                  <button onClick={() => openSavedPaper(paper)} className="p-4 text-right flex-1 hover:bg-gray-50" dir="rtl">
                    <span className="inline-block bg-indigo-50 text-indigo-700 font-arabic text-base font-bold px-3 py-0.5 rounded-lg mb-2">{paper.header?.className || '—'}</span>
                    <span className="block text-xl font-bold font-arabic text-gray-800 leading-snug">{paper.header?.examName || 'Untitled'} {toArabicNumerals(paper.header?.hijriYear || '')}هـ</span>
                    <span className="block text-base text-gray-600 font-arabic truncate">{(paper.subjects || []).map(s => s.title).join(' ، ') || '—'}</span>
                  </button>
                  <div className="flex items-center border-t border-gray-100 text-sm">
                    <span className="flex-1 px-4 text-gray-400">{paper.lastEdited ? new Date(paper.lastEdited).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                    <button onClick={() => duplicatePaper(paper)} className="px-4 py-3 text-gray-600 font-bold hover:bg-gray-50">⧉ Copy</button>
                    <button onClick={() => deletePaper(paper)} className="px-4 py-3 text-red-500 font-bold hover:bg-red-50">🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* ---------------- EDITOR / PREVIEW ---------------- */}
      {inPaper && (
        <main className="p-3 sm:p-5 print:p-0">
          {appState === 'preview' ? (
            <>
              <div className="max-w-3xl mx-auto mb-3 flex flex-wrap items-center justify-center gap-2 print:hidden">
                <span className="text-sm text-gray-500 w-full text-center">Tap any question to edit it.</span>
                <button onClick={() => window.print()} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-xl font-bold text-sm">🖨️ Print</button>
              </div>
              <PaperPreview header={header} subjects={subjects} school={schoolSettings} layout={layout} pagesRef={pagesRef}
                focusQuestionId={activeId} onPageCount={setPageCount}
                onEditQuestion={(qid) => { setActiveId(qid); setAppState('editor'); }} />
            </>
          ) : (
            <div className="print:hidden">
              <Editor header={header} setHeader={setHeader} subjects={subjects} setSubjects={setSubjects} layout={layout} setLayout={setLayout} activeId={activeId} setActiveId={setActiveId} />
            </div>
          )}
        </main>
      )}

      {/* ---------------- BOTTOM NAV (phones) ---------------- */}
      {inPaper && (
        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 flex print:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <NavButton icon="✏️" label="Edit" active={appState === 'editor'} onClick={() => goTo('editor')} />
          <NavButton icon="👁" label="Preview" active={appState === 'preview'} onClick={() => goTo('preview')} />
          <NavButton icon={isSaving ? '⏳' : '💾'} label={saveLabel} onClick={savePaper} disabled={isSaving} badge={isDirty} />
          <NavButton icon={pdfProgress ? '⏳' : '⬇️'} label={pdfProgress ? pdfProgress : 'PDF'} onClick={handleDownloadPdf} disabled={!!pdfProgress} />
        </nav>
      )}

      {/* ---------------- MODALS ---------------- */}
      {modal === 'menu' && (
        <Modal title="Menu" onClose={() => setModal(null)}>
          <div className="flex flex-col">
            {[
              ['⚙️', 'School name & logo', () => setModal('settings')],
              ['🔔', "What's new", openWhatsNew, hasNews],
              ...(!isStandalone() ? [['📲', 'Install app on this phone', handleInstall]] : []),
              ['ℹ️', 'About & help', () => setModal('about')],
              ['🚪', 'Sign out', handleLogout],
            ].map(([icon, label, fn, dot]) => (
              <button key={label} onClick={fn} className="flex items-center gap-4 px-3 py-4 rounded-xl hover:bg-gray-50 text-left text-lg text-gray-800">
                <span className="text-2xl w-8">{icon}</span><span className="flex-1">{label}</span>{dot && <span className="w-2.5 h-2.5 bg-red-500 rounded-full" />}
              </button>
            ))}
            <div className="text-xs text-gray-400 mt-3 px-3">{user?.email}</div>
          </div>
        </Modal>
      )}

      {modal === 'settings' && (
        <Modal title="School name & logo" onClose={closeSettings} footer={<button onClick={closeSettings} className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold text-lg">Save</button>}>
          <label className="block text-sm font-bold text-gray-600 mb-1">School name (Arabic)</label>
          <input type="text" value={schoolSettings?.nameAr || ''} onChange={(e) => updateSchoolSettings({ ...schoolSettings, nameAr: e.target.value })} className="w-full border border-gray-300 px-3 py-2 rounded-xl mb-5 font-arabic text-2xl" dir="rtl" />
          <label className="block text-sm font-bold text-gray-600 mb-1">Logo</label>
          {schoolSettings?.logo && <div className="mb-3 flex justify-center bg-gray-50 border p-3 rounded-xl"><img src={schoolSettings.logo} alt="Logo" className="h-20 object-contain" /></div>}
          <div className="flex gap-2">
            <label className="flex-1 text-center border-2 border-dashed border-indigo-300 text-indigo-700 font-bold py-3 rounded-xl cursor-pointer">
              <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />{schoolSettings?.logo ? 'Change logo' : 'Choose logo'}
            </label>
            {schoolSettings?.logo && <button onClick={() => updateSchoolSettings({ ...schoolSettings, logo: '' })} className="px-4 text-red-600 border border-red-200 rounded-xl font-bold">Remove</button>}
          </div>
        </Modal>
      )}

      {modal === 'whatsNew' && (
        <Modal title="🔔 What's new" onClose={() => setModal(null)}>
          {WHATS_NEW.map(rel => (
            <div key={rel.version} className="mb-5">
              <div className="text-sm font-bold text-indigo-700 mb-2">Version {rel.version} · {rel.date}</div>
              <ul className="space-y-2">{rel.items.map(it => <li key={it} className="flex gap-2 text-gray-700"><span className="text-indigo-500">✓</span>{it}</li>)}</ul>
            </div>
          ))}
        </Modal>
      )}

      {modal === 'install' && (
        <Modal title="📲 Install the app" onClose={() => setModal(null)}>
          {isIOS() ? (
            <ol className="space-y-3 text-gray-700 text-lg list-decimal pr-2 pl-6">
              <li>Open this page in <b>Safari</b>.</li>
              <li>Tap the <b>Share</b> button <span className="inline-block border rounded px-1">⬆︎</span> at the bottom.</li>
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
        <Modal title="About" onClose={() => setModal(null)}>
          <p className="text-gray-600 leading-relaxed mb-4">A Lisan ud Dawat exam paper generator for imani schools — create, format and print beautifully packed exam papers in standard A4.</p>
          <h3 className="font-bold text-gray-800 mb-2">Quick help</h3>
          <ul className="text-gray-600 space-y-2 mb-5 list-disc pl-5">
            <li><b>Edit</b>: tap a question to open it, tap <b>Done</b> to fold it.</li>
            <li><b>Preview</b>: see the real A4 pages. Tap a question there to edit it.</li>
            <li><b>PDF</b>: downloads the paper exactly as previewed — best for phones.</li>
            <li>Type <b>*</b> in a Fill-in-the-Blanks sentence to make a blank.</li>
          </ul>
          <div className="text-xs text-gray-400 border-t pt-3">Made with care by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noreferrer" className="underline">S. Shakir</a> · v{LATEST_VERSION}</div>
        </Modal>
      )}
    </div>
  );
}

export default App
