import { useState, useEffect, useRef, useCallback } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged } from 'firebase/auth'
import { DEFAULT_HEADER, DEFAULT_HIJRI_YEAR, normalizeSubjects, sampleSubjects, uid, toPlain, validatePaper, saveDraft, loadDraft, clearDraft } from './lib/paperModel'
import { compressImage } from './lib/image'
import ErrorBoundary from './components/ErrorBoundary'
import Editor from './components/Editor'
import Dashboard from './components/Dashboard'
import PaperPages from './components/PaperPages'

// Set the default school info here
const DEFAULT_SCHOOL_INFO = { nameAr: 'پنجتنية هاير سيكندري اسكول - برواني', logo: '' };

// `?demo` (dev server only) skips Google sign-in and cloud calls so the editor/preview can be tried offline.
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');
const DEMO_USER = { uid: 'demo', displayName: 'Demo Teacher', email: 'demo@example.com', photoURL: '' };

const blankSubjects = () => [{ id: uid(), title: 'تعليم القرآن', questions: [] }];

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading'); // loading | login | dashboard | editor | preview | answers
  const [savedPapers, setSavedPapers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [papersLoading, setPapersLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState(null);
  const [pageOverflow, setPageOverflow] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(() => { try { return localStorage.getItem('printHintDismissed') === '1'; } catch (e) { return false; } });
  const savedSig = useRef('');

  const [schoolSettings, setSchoolSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('schoolSettings');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_SCHOOL_INFO;
    } catch(e) { return DEFAULT_SCHOOL_INFO; }
  });

  const [paperData, setHeaderData] = useState(DEFAULT_HEADER);
  const [subjects, setSubjects] = useState(blankSubjects);

  useEffect(() => {
    document.title = "LSD - Exam Paper Generator";
    if (DEMO) {
      setUser(DEMO_USER);
      const demoSubjects = sampleSubjects();
      if (new URLSearchParams(window.location.search).has('stress')) {
        const first = demoSubjects[0];
        demoSubjects[0] = { ...first, questions: [0, 1, 2, 3].flatMap((k) => first.questions.map((q) => ({ ...q, id: `${q.id}-${k}`, parts: q.parts.map((p) => ({ ...p, id: `${p.id}-${k}` })) }))) };
        demoSubjects.push({ ...first, id: 's2', title: 'مادة ثانية' });
      }
      setSubjects(demoSubjects);
      setSavedPapers([
        { id: 'd1', userId: 'demo', header: { className: 'الدرجة السابعة', examName: 'امتحان نصف السنة', hijriYear: '1448', paperNumber: 'Paper 1' }, subjects: [{ id: 'x', title: 'حفظ القرآن', questions: [] }], lastEdited: '2026-10-20T10:00:00Z' },
        { id: 'd2', userId: 'demo', header: { className: 'الدرجة الرابعة', examName: 'الامتحان السنوي', hijriYear: '1448', paperNumber: 'Paper 2' }, subjects: [{ id: 'y', title: 'تعليم القرآن', questions: [] }, { id: 'z', title: 'الفقه', questions: [] }], lastEdited: '2026-10-25T10:00:00Z' },
        { id: 'd3', userId: 'demo', header: { className: 'الدرجة العاشرة', examName: 'الامتحان للفصل', hijriYear: '1447', paperNumber: 'Paper 1' }, subjects: [{ id: 'w', title: 'النحو', questions: [] }], lastEdited: '2026-09-01T10:00:00Z' },
      ]);
      const demoView = new URLSearchParams(window.location.search).get('demo');
      setAppState(['editor', 'preview', 'answers', 'dashboard'].includes(demoView) ? demoView : 'editor');
      savedSig.current = '';
      // test hook (dev server + ?demo only): lets the e2e suite load arbitrary papers
      window.__paper = { setSubjects, setHeaderData, setAppState, setSchoolSettings };
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAppState('dashboard');
        loadUserSettings(currentUser.uid); // Load user's cloud settings
        loadUserPapers(currentUser.uid);
        setDraft(loadDraft(currentUser.uid));
      }
      else { setUser(null); setAppState('login'); }
    });
    return () => unsubscribe();
  }, []);

  const notify = useCallback((message, kind = 'info') => {
    setToast({ message, kind, id: Date.now() });
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.kind === 'error' ? 7000 : 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // --- unsaved-changes tracking + local draft (survives refresh / closed tab / lost connection) ---
  const paperSig = JSON.stringify([paperData, subjects]);
  const inPaper = appState === 'editor' || appState === 'preview' || appState === 'answers';
  const dirty = inPaper && paperSig !== savedSig.current;

  useEffect(() => {
    if (!dirty || !user) return;
    const t = setTimeout(() => saveDraft(user.uid, { paperId: currentPaperId, folderId: currentFolderId, header: paperData, subjects }), 700);
    return () => clearTimeout(t);
  }, [paperSig, dirty, user]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); }
    catch (error) {
      console.error(error);
      if (error?.code === 'auth/popup-blocked' || error?.code === 'auth/operation-not-supported-in-this-environment') { try { await signInWithRedirect(auth, googleProvider); return; } catch (e) { console.error(e); } }
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return;
      notify(error?.code === 'auth/network-request-failed' ? 'No internet connection. Please try again.' : 'Login failed. Please try again.', 'error');
    }
  };
  const handleLogout = async () => { try { await signOut(auth); setAppState('login'); } catch (error) { console.error(error); } };

  // --- CLOUD SETTINGS LOGIC ---
  const loadUserSettings = async (userId) => {
    try {
      const docSnap = await getDoc(doc(db, "users", userId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.schoolSettings) {
          setSchoolSettings(data.schoolSettings);
          localStorage.setItem('schoolSettings', JSON.stringify(data.schoolSettings));
        }
        setFolders(data.folders || []);
      }
    } catch (error) { console.error("Error loading user settings:", error); }
  };

  const saveUserSettingsToCloud = async (settingsToSave) => {
    if (!user || DEMO) return;
    try {
      await setDoc(doc(db, "users", user.uid), { schoolSettings: settingsToSave }, { merge: true });
    } catch (error) { console.error("Error saving settings to cloud:", error); }
  };

  // --- FOLDERS ---
  const saveFolders = async (next) => {
    setFolders(next);
    if (!user || DEMO) return;
    try { await setDoc(doc(db, "users", user.uid), { folders: next }, { merge: true }); }
    catch (error) { console.error("Error saving folders:", error); notify("Could not save folders — check your connection.", "error"); }
  };
  const addFolder = (name) => saveFolders([...folders, { id: uid(), name }]);
  const renameFolder = (id, name) => saveFolders(folders.map(f => f.id === id ? { ...f, name } : f));
  const deleteFolder = async (id) => {
    await saveFolders(folders.filter(f => f.id !== id));
    // papers inside keep existing, they simply become "Unfiled" (the dashboard ignores unknown folder ids)
  };
  const movePaper = async (paperId, folderId) => {
    setSavedPapers(savedPapers.map(p => p.id === paperId ? { ...p, folderId } : p));
    if (DEMO) return;
    try { await updateDoc(doc(db, "papers", paperId), { folderId }); } catch (error) { console.error(error); notify("Could not move paper.", "error"); }
  };
  // ----------------------------

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const logo = await compressImage(file);
      const newSettings = { ...schoolSettings, logo };
      setSchoolSettings(newSettings);
      try { localStorage.setItem('schoolSettings', JSON.stringify(newSettings)); } catch(err){}
    } catch (err) { notify(err.message || 'Could not use this image.', 'error'); }
  };

  const removeLogo = () => {
      const newSettings = { ...schoolSettings, logo: '' };
      setSchoolSettings(newSettings);
      try { localStorage.setItem('schoolSettings', JSON.stringify(newSettings)); } catch(e){}
  };

  const handleSettingChange = (e) => {
    const newSettings = { ...schoolSettings, [e.target.name]: e.target.value };
    setSchoolSettings(newSettings);
    try { localStorage.setItem('schoolSettings', JSON.stringify(newSettings)); } catch(e){}
  };

  const closeSettingsModal = () => {
    setIsSettingsOpen(false);
    saveUserSettingsToCloud(schoolSettings); // Save to Firebase when closing
  };

  const loadUserPapers = async (userId) => {
    setPapersLoading(true);
    setLoadError('');
    try {
      const q = query(collection(db, "papers"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const papers = [];
      querySnapshot.forEach((d) => { papers.push({ id: d.id, ...d.data() }); });
      setSavedPapers(papers);
    } catch (error) {
      console.error("Error loading papers:", error);
      setLoadError(error?.code === 'permission-denied' ? 'Permission denied while loading your papers.' : 'Could not load your papers. Check your internet connection.');
    }
    setPapersLoading(false);
  };

  // the logo lives in the user's settings, not in every paper (keeps documents far below Firestore's 1 MB limit)
  const paperPayload = () => toPlain({ userId: user.uid, authorName: user.displayName || '', header: paperData, subjects, schoolBranding: { nameAr: schoolSettings?.nameAr || '' }, folderId: currentFolderId || null, lastEdited: new Date().toISOString() });

  const savePaperToCloud = async () => {
    if (!user) return;
    if (isSaving) return;
    if (DEMO) { savedSig.current = paperSig; notify("Demo mode: nothing is stored online.", "info"); return; }
    setIsSaving(true);
    try {
      const payload = paperPayload();
      if (JSON.stringify(payload).length > 900000) throw Object.assign(new Error('too-large'), { code: 'too-large' });
      if (currentPaperId) {
        await updateDoc(doc(db, "papers", currentPaperId), payload);
        notify("Paper saved ✓", "success");
      } else {
        const docRef = await addDoc(collection(db, "papers"), payload);
        setCurrentPaperId(docRef.id);
        notify("New paper saved ✓", "success");
      }
      savedSig.current = paperSig;
      clearDraft(user.uid);
      loadUserPapers(user.uid);
    } catch (error) {
      console.error(error);
      const code = error?.code;
      notify(code === 'too-large' ? 'This paper is too big to save. Remove very large content.'
        : code === 'permission-denied' ? 'Not allowed to save. Please log out and log in again.'
        : code === 'unavailable' || code === 'failed-precondition' ? 'No connection — your work is kept as a draft on this device. Try Save again when online.'
        : 'Could not save. Your work is kept as a draft on this device.', 'error');
    }
    setIsSaving(false);
  };

  const deletePaper = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this paper?")) {
      try { if (!DEMO) await deleteDoc(doc(db, "papers", id)); setSavedPapers(savedPapers.filter(p => p.id !== id)); }
      catch (error) { console.error(error); notify("Failed to delete.", "error"); }
    }
  };

  const duplicatePaper = async (paper) => {
    if (DEMO) return;
    try {
      const { id, ...rest } = paper;
      await addDoc(collection(db, "papers"), { ...rest, header: { ...rest.header, paperNumber: `${rest.header?.paperNumber || 'Paper'} (copy)` }, lastEdited: new Date().toISOString() });
      loadUserPapers(user.uid);
      notify("Paper duplicated ✓", "success");
    } catch (error) { console.error(error); notify("Failed to duplicate.", "error"); }
  };

  const startNewPaper = () => {
    setCurrentPaperId(null);
    setCurrentFolderId(null);
    setHeaderData({ ...DEFAULT_HEADER, hijriYear: DEFAULT_HIJRI_YEAR });
    const fresh = blankSubjects();
    setSubjects(fresh);
    savedSig.current = JSON.stringify([{ ...DEFAULT_HEADER, hijriYear: DEFAULT_HIJRI_YEAR }, fresh]);
    setAppState('editor');
  };

  const openSavedPaper = (paper) => {
    setCurrentPaperId(paper.id);
    setCurrentFolderId(paper.folderId || null);

    const exName = paper.header?.examName || DEFAULT_HEADER.examName;
    let cleanExamName = exName;
    let year = paper.header?.hijriYear || DEFAULT_HIJRI_YEAR;
    if (exName.includes('١٤٤٦هـ')) {
        cleanExamName = exName.replace(' ١٤٤٦هـ', '').replace('١٤٤٦هـ', '').trim();
        year = '1446';
    }

    const hdr = {
      className: paper.header?.className || DEFAULT_HEADER.className,
      examName: cleanExamName,
      hijriYear: year,
      paperNumber: paper.header?.paperNumber || DEFAULT_HEADER.paperNumber,
      time: paper.header?.time || DEFAULT_HEADER.time,
      coverMode: paper.header?.coverMode || DEFAULT_HEADER.coverMode,
      labelStyle: paper.header?.labelStyle || DEFAULT_HEADER.labelStyle,
    };
    const subs = normalizeSubjects(paper.subjects);
    setHeaderData(hdr);
    setSubjects(subs);
    savedSig.current = JSON.stringify([hdr, subs]);
    if (paper.schoolBranding) setSchoolSettings({ ...paper.schoolBranding, ...schoolSettings });
    setAppState('editor');
  };

  const restoreDraft = () => {
    if (!draft) return;
    const subs = normalizeSubjects(draft.subjects);
    setCurrentPaperId(draft.paperId || null);
    setCurrentFolderId(draft.folderId || null);
    setHeaderData({ ...DEFAULT_HEADER, ...draft.header });
    setSubjects(subs);
    savedSig.current = ''; // still unsaved
    setDraft(null);
    setAppState('editor');
  };
  const discardDraft = () => { if (user) clearDraft(user.uid); setDraft(null); };

  const goDashboard = () => {
    if (dirty && !window.confirm('You have unsaved changes. Leave without saving?\n(A draft is kept on this device and you can restore it from the dashboard.)')) return;
    if (user && !dirty) clearDraft(user.uid);
    setDraft(user ? loadDraft(user.uid) : null);
    setAppState('dashboard');
  };

  const handlePrint = () => {
    const issues = validatePaper(subjects, paperData).filter(i => i.level === 'error');
    if (issues.length && !window.confirm(`The paper has ${issues.length} error(s):\n- ${issues.slice(0, 5).map(i => i.where + ': ' + i.msg).join('\n- ')}\n\nPrint anyway?`)) return;
    window.print();
  };

  // Ctrl/Cmd+S saves the paper while editing
  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && appState === 'editor') { e.preventDefault(); savePaperToCloud(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });


  if (appState === 'loading') return <div className="min-h-screen flex items-center justify-center text-xl font-bold">Loading...</div>;

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-xl shadow-lg max-w-md w-full text-center relative">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">LSD - Exam Paper Generator</h1>
          <p className="text-gray-500 mb-8">Sign in to manage your school papers</p>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition">Sign in with Google</button>
        </div>
      </div>
    );
  }

  const isPaperView = appState === 'preview' || appState === 'answers';
  const tabBtn = (id, label) => <button onClick={() => setAppState(id)} className={`px-2.5 sm:px-4 py-1.5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${appState === id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>;

  return (
    <div className="min-h-screen bg-gray-100 pb-20 print:bg-white print:pb-0 print:min-h-0 relative flex flex-col">

      {/* ABOUT MODAL */}
      {isAboutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 relative text-center">
              <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
              <h2 className="text-2xl font-bold text-gray-800 mb-4">LSD - Exam Paper Generator</h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                A precision Lisan ud Dawat exam paper generator designed for imani schools to easily create, format, and generate beautifully packed Arabic/Urdu exam papers directly into standard A4 PDF format. 
              </p>
              <div className="text-sm text-gray-400 border-t pt-4">
                Developed by M Shabbir Shakir
              </div>
           </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
              <button onClick={closeSettingsModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
              <h2 className="text-xl font-bold text-gray-800 mb-6">⚙️ Application Settings</h2>
              <div className="border-b pb-6">
                <h3 className="font-bold text-gray-700 mb-2">🏫 School Info</h3>
                <label className="block text-xs text-gray-500 mb-1">School Name (Arabic)</label>
                <input type="text" name="nameAr" value={schoolSettings?.nameAr || ''} onChange={handleSettingChange} className="w-full border p-2 rounded mb-3 font-arabic text-lg" dir="rtl" />
                
                <label className="block text-xs text-gray-500 mb-1">Upload Logo</label>
                <div className="flex items-center gap-3">
                   <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm flex-grow" />
                   {schoolSettings?.logo && (
                      <button onClick={removeLogo} className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded border border-red-200 hover:bg-red-100 transition">Remove Logo</button>
                   )}
                </div>
                {schoolSettings?.logo && <div className="mt-3 flex justify-center bg-gray-50 border p-2 rounded"><img src={schoolSettings.logo} alt="Preview" className="h-12 object-contain" /></div>}
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={closeSettingsModal} className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 transition font-bold text-sm">Save & Close</button>
              </div>
           </div>
        </div>
      )}

      {appState === 'dashboard' ? (
        <Dashboard user={user} papers={savedPapers} folders={folders} loading={papersLoading} loadError={loadError} onRetry={() => loadUserPapers(user.uid)} draft={draft} onRestoreDraft={restoreDraft} onDiscardDraft={discardDraft}
          onOpen={openSavedPaper} onNew={startNewPaper} onDelete={deletePaper} onDuplicate={duplicatePaper} onMove={movePaper}
          onAddFolder={addFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder}
          onSettings={() => setIsSettingsOpen(true)} onLogout={handleLogout} />
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-gray-100 pt-4 px-4 pb-2 print:hidden">
            <nav className="bg-white px-2 sm:px-4 py-2.5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center max-w-4xl mx-auto w-full gap-1 sm:gap-2">
              <button onClick={goDashboard} className="text-gray-500 hover:text-gray-800 font-medium text-sm px-2 py-1 rounded transition">←<span className="hidden sm:inline"> Dashboard</span></button>

              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                {tabBtn('editor', 'Editor')}
                {tabBtn('preview', 'Preview')}
                {tabBtn('answers', 'Answer key')}
              </div>

              <div className="flex gap-2 sm:gap-3 items-center">
                {appState === 'editor' && ( <button onClick={() => savePaperToCloud()} disabled={isSaving} className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 rounded-md hover:bg-blue-700 transition font-bold text-sm disabled:opacity-50 whitespace-nowrap">{isSaving ? 'Saving...' : dirty ? 'Save •' : 'Saved ✓'}</button> )}
                {isPaperView && ( <button onClick={handlePrint} className="bg-gray-800 text-white px-3 sm:px-4 py-1.5 rounded-md hover:bg-black transition font-bold text-sm font-sans flex items-center gap-2"><span>🖨️</span><span className="hidden sm:inline">Print PDF</span></button> )}
              </div>
            </nav>
          </div>

          <div className="flex-grow p-4 print:p-0">
            {isPaperView && (
              <div className="max-w-3xl mx-auto mb-3 space-y-2 print:hidden">
                {pageOverflow && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-md p-2">⚠️ Some content is taller than one page and may be cut off. Shorten that question or split it into parts.</div>}
                {!hintDismissed && (
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-md p-2 flex justify-between gap-3">
                    <span>🖨️ Printing tip: choose paper size <b>A4</b>, margins <b>None</b>, scale <b>100%</b> and tick <b>Background graphics</b>.</span>
                    <button onClick={() => { setHintDismissed(true); try { localStorage.setItem('printHintDismissed', '1'); } catch (e) {} }} className="font-bold">✕</button>
                  </div>
                )}
              </div>
            )}
            <ErrorBoundary resetKey={appState} onBack={() => setAppState('editor')}>
              {isPaperView
                ? <PaperPages paperData={paperData} subjects={subjects} school={schoolSettings} showAnswers={appState === 'answers'} onOverflow={setPageOverflow} />
                : <Editor paperData={paperData} setHeaderData={setHeaderData} subjects={subjects} setSubjects={setSubjects} />}
            </ErrorBoundary>
          </div>
        </>
      )}

      {toast && (
        <div role="status" className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium print:hidden max-w-[90vw] ${toast.kind === 'error' ? 'bg-red-600 text-white' : toast.kind === 'success' ? 'bg-green-600 text-white' : 'bg-gray-800 text-white'}`}>{toast.message}</div>
      )}

      {/* GLOBAL FOOTER */}
      <footer className="mt-auto py-4 text-center text-gray-400 text-xs print:hidden w-full flex justify-center items-center gap-2 pb-2">
         <span>Created by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noreferrer" className="font-semibold text-gray-500 hover:text-blue-500 transition">S. Shakir</a></span>
         <span className="text-gray-300">|</span>
         <button onClick={() => setIsAboutOpen(true)} className="hover:text-blue-500 transition">About</button>
      </footer>

    </div>
  )
}
export default App
