import { useState, useEffect, useRef } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import Editor from './components/Editor'
import PaperPreview from './components/PaperPreview'
import { DEFAULT_SCHOOL_INFO, DEFAULT_HEADER, DEFAULT_LAYOUT, uid, toArabicNumerals, normalizeSubjects, normalizeHeader, normalizeLayout } from './lib/paper'
import { downloadPdf, resizeImage } from './lib/pdf'

// Local-only demo mode (npm run dev, then open /?demo) to try the editor without signing in.
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo');

const freshSubjects = () => [{ id: uid(), title: 'تعليم القرآن', questions: [] }];

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading');
  const [savedPapers, setSavedPapers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null);
  const [currentPaperId, setCurrentPaperId] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const pagesRef = useRef(null);

  const [schoolSettings, setSchoolSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('schoolSettings');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_SCHOOL_INFO;
    } catch { return DEFAULT_SCHOOL_INFO; }
  });

  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [subjects, setSubjects] = useState(freshSubjects);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);

  // Track unsaved changes so work is never lost by accident.
  const [savedSnapshot, setSavedSnapshot] = useState(null);
  const snapshot = JSON.stringify({ header, subjects, layout });
  const isDirty = (appState === 'editor' || appState === 'preview') && savedSnapshot !== null && snapshot !== savedSnapshot;

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const showToast = (msg, kind = 'ok') => { setToast({ msg, kind }); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    document.title = 'LSD - Exam Paper Generator';
    if (DEMO) {
      setUser({ uid: 'demo', displayName: 'Demo User', email: 'demo@local' });
      setAppState('dashboard');
      import('./lib/demoPaper').then(m => setSavedPapers([m.default]));
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAppState('dashboard');
        loadUserSettings(currentUser.uid);
        loadUserPapers(currentUser.uid);
      } else { setUser(null); setAppState('login'); }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); alert('Login failed!'); } };
  const handleLogout = async () => { try { await signOut(auth); setAppState('login'); } catch (error) { console.error(error); } };

  // --- CLOUD SETTINGS ---
  const loadUserSettings = async (userId) => {
    try {
      const docSnap = await getDoc(doc(db, 'users', userId));
      if (docSnap.exists() && docSnap.data().schoolSettings) {
        setSchoolSettings(docSnap.data().schoolSettings);
        localStorage.setItem('schoolSettings', JSON.stringify(docSnap.data().schoolSettings));
      }
    } catch (error) { console.error('Error loading user settings:', error); }
  };

  const updateSchoolSettings = (newSettings) => {
    setSchoolSettings(newSettings);
    try { localStorage.setItem('schoolSettings', JSON.stringify(newSettings)); } catch { /* storage full or blocked */ }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { updateSchoolSettings({ ...schoolSettings, logo: await resizeImage(file) }); }
    catch { alert('Could not read that image. Please try a PNG or JPG.'); }
  };

  const closeSettingsModal = async () => {
    setIsSettingsOpen(false);
    if (!user || DEMO) return;
    try { await setDoc(doc(db, 'users', user.uid), { schoolSettings }, { merge: true }); }
    catch (error) { console.error('Error saving settings to cloud:', error); showToast('Settings saved on this device only', 'warn'); }
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
  };

  const savePaperToCloud = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const payload = { userId: user.uid, authorName: user.displayName, header, subjects, layout, schoolBranding: schoolSettings, lastEdited: new Date().toISOString() };
      if (DEMO) { /* nothing to save in demo mode */ }
      else if (currentPaperId) await updateDoc(doc(db, 'papers', currentPaperId), payload);
      else setCurrentPaperId((await addDoc(collection(db, 'papers'), payload)).id);
      setSavedSnapshot(snapshot);
      showToast('Paper saved ✓');
      if (!DEMO) loadUserPapers(user.uid);
    } catch (error) {
      console.error(error);
      alert(error?.code === 'invalid-argument' ? 'This paper is too large to save (try a smaller logo).' : 'Could not save. Please check your internet connection and try again.');
    }
    setIsSaving(false);
  };

  const deletePaper = async (e, paper) => {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete "${paper.header?.examName || 'this paper'}" (${paper.header?.className || ''})?`)) return;
    try { await deleteDoc(doc(db, 'papers', paper.id)); setSavedPapers(savedPapers.filter(p => p.id !== paper.id)); }
    catch (error) { console.error(error); alert('Failed to delete.'); }
  };

  const loadIntoEditor = (id, h, s, l) => {
    setCurrentPaperId(id);
    setHeader(h); setSubjects(s); setLayout(l);
    setSavedSnapshot(id ? JSON.stringify({ header: h, subjects: s, layout: l }) : '');
    setAppState('editor');
    window.scrollTo(0, 0);
  };

  const startNewPaper = () => loadIntoEditor(null, DEFAULT_HEADER, freshSubjects(), DEFAULT_LAYOUT);

  const openSavedPaper = (paper) => {
    loadIntoEditor(paper.id, normalizeHeader(paper.header), normalizeSubjects(paper.subjects), normalizeLayout(paper.layout));
  };

  const duplicatePaper = (e, paper) => {
    e.stopPropagation();
    openSavedPaper(paper);
    setCurrentPaperId(null);
    setSavedSnapshot('');
    showToast('Copy opened — Save to keep it');
  };

  const backToDashboard = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    setAppState('dashboard');
  };

  const handleDownloadPdf = async () => {
    if (!pagesRef.current) return;
    try {
      await downloadPdf(pagesRef.current, `${header.className} - ${header.examName} ${header.hijriYear}.pdf`, (i, n) => setPdfProgress(`${i}/${n}`));
    } catch (error) { console.error(error); alert('Could not create the PDF. Please try "Print" instead.'); }
    setPdfProgress(null);
  };

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

  const inPaper = appState === 'editor' || appState === 'preview';

  return (
    <div className="min-h-screen bg-gray-100 pb-20 print:pb-0 print:min-h-0 print:bg-white relative flex flex-col">

      {toast && <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-sm font-bold print:hidden ${toast.kind === 'warn' ? 'bg-amber-500 text-white' : 'bg-gray-900 text-white'}`}>{toast.msg}</div>}

      {isAboutOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-8 relative text-center">
            <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">LSD - Exam Paper Generator</h2>
            <p className="text-gray-600 leading-relaxed mb-6">A precision Lisan ud Dawat exam paper generator designed for imani schools to easily create, format, and generate beautifully packed Arabic/Urdu exam papers directly into standard A4 PDF format.</p>
            <div className="text-sm text-gray-400 border-t pt-4">Developed by M Shabbir Shakir</div>
          </div>
        </div>
      )}

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
            <button onClick={closeSettingsModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 font-bold text-xl">✕</button>
            <h2 className="text-xl font-bold text-gray-800 mb-6">⚙️ Settings</h2>
            <div className="border-b pb-6">
              <h3 className="font-bold text-gray-700 mb-2">🏫 School Info</h3>
              <label className="block text-xs text-gray-500 mb-1">School Name (Arabic)</label>
              <input type="text" value={schoolSettings?.nameAr || ''} onChange={(e) => updateSchoolSettings({ ...schoolSettings, nameAr: e.target.value })} className="w-full border p-2 rounded mb-3 font-arabic text-lg" dir="rtl" />
              <label className="block text-xs text-gray-500 mb-1">Logo</label>
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="text-sm flex-grow min-w-0" />
                {schoolSettings?.logo && <button onClick={() => updateSchoolSettings({ ...schoolSettings, logo: '' })} className="text-xs bg-red-50 text-red-500 px-3 py-1.5 rounded border border-red-200">Remove</button>}
              </div>
              {schoolSettings?.logo && <div className="mt-3 flex justify-center bg-gray-50 border p-2 rounded"><img src={schoolSettings.logo} alt="Logo preview" className="h-12 object-contain" /></div>}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={closeSettingsModal} className="bg-blue-600 text-white px-5 py-2 rounded-md hover:bg-blue-700 font-bold text-sm">Save & Close</button>
            </div>
          </div>
        </div>
      )}

      {appState === 'dashboard' ? (
        <div className="p-4 md:p-6 flex-grow">
          <nav className="bg-white p-4 rounded-lg shadow-sm mb-8 flex justify-between items-center max-w-5xl mx-auto w-full gap-2">
            <div className="flex items-center gap-3 min-w-0">
              {user?.photoURL && <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-gray-200" />}
              <div className="min-w-0">
                <h1 className="text-base md:text-lg font-bold text-gray-800 truncate">{user?.displayName}</h1>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => setIsSettingsOpen(true)} className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded text-sm font-medium">⚙️ Settings</button>
              <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium">Logout</button>
            </div>
          </nav>

          <div className="max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-end mb-6">
              <h2 className="text-2xl font-bold text-gray-800">My Papers</h2>
              <button onClick={startNewPaper} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-sm text-sm">+ New Paper</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {savedPapers.length === 0 ? (
                <p className="text-gray-500 col-span-full text-center py-10 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">No papers saved yet. Create your first one!</p>
              ) : savedPapers.map(paper => (
                <div key={paper.id} onClick={() => openSavedPaper(paper)} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col">
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <div className="flex gap-1">
                      <button onClick={(e) => deletePaper(e, paper)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 rounded px-1.5 py-0.5 text-sm" title="Delete">🗑️</button>
                      <button onClick={(e) => duplicatePaper(e, paper)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded px-1.5 py-0.5 text-sm" title="Make a copy">⧉</button>
                    </div>
                    <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded font-arabic" dir="rtl">{paper.header?.className || 'Unknown'}</div>
                  </div>
                  <h3 className="text-lg font-bold mb-1 font-arabic text-gray-800 leading-tight text-right" dir="rtl">{paper.header?.examName || 'Untitled'} {toArabicNumerals(paper.header?.hijriYear || '')}هـ</h3>
                  <p className="text-sm text-gray-600 font-arabic text-right truncate" dir="rtl">{(paper.subjects || []).map(s => s.title).join(' ، ') || '—'}</p>
                  <div className="flex justify-between text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
                    <span>{paper.header?.paperNumber || ''}</span>
                    <span>{paper.lastEdited ? new Date(paper.lastEdited).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : inPaper && (
        <>
          <div className="sticky top-0 z-40 bg-gray-100 pt-3 px-2 sm:px-4 pb-2 print:hidden">
            <nav className="bg-white px-2 sm:px-4 py-2 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center max-w-4xl mx-auto w-full gap-2">
              <button onClick={backToDashboard} className="text-gray-500 hover:text-gray-800 font-medium text-sm px-1 sm:px-2 py-1">← <span className="hidden sm:inline">Dashboard</span></button>

              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button onClick={() => { setAppState('editor'); window.scrollTo(0, 0); }} className={`px-3 sm:px-5 py-1.5 rounded-md text-sm font-bold ${appState === 'editor' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Editor</button>
                <button onClick={() => { setAppState('preview'); window.scrollTo(0, 0); }} className={`px-3 sm:px-5 py-1.5 rounded-md text-sm font-bold ${appState === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}>Preview</button>
              </div>

              <div className="flex gap-1.5 items-center">
                <button onClick={savePaperToCloud} disabled={isSaving} className={`px-3 py-1.5 rounded-md font-bold text-sm disabled:opacity-50 ${isDirty || !currentPaperId ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {isSaving ? 'Saving…' : isDirty || !currentPaperId ? 'Save' : 'Saved ✓'}
                </button>
              </div>
            </nav>
            {appState === 'preview' && (
              <div className="max-w-4xl mx-auto mt-2 flex flex-wrap justify-center gap-2">
                <button onClick={handleDownloadPdf} disabled={!!pdfProgress} className="bg-gray-900 text-white px-4 py-2 rounded-md hover:bg-black font-bold text-sm disabled:opacity-60">
                  {pdfProgress ? `Creating PDF… ${pdfProgress}` : '⬇️ Download PDF'}
                </button>
                <button onClick={() => window.print()} className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-50 font-bold text-sm">🖨️ Print</button>
              </div>
            )}
          </div>

          <div className="flex-grow p-2 sm:p-4 print:p-0">
            {appState === 'preview'
              ? <PaperPreview header={header} subjects={subjects} school={schoolSettings} layout={layout} pagesRef={pagesRef} />
              : <div className="print:hidden"><Editor header={header} setHeader={setHeader} subjects={subjects} setSubjects={setSubjects} layout={layout} setLayout={setLayout} /></div>}
          </div>
        </>
      )}

      <footer className="mt-auto py-4 text-center text-gray-400 text-xs print:hidden w-full flex justify-center items-center gap-2 pb-2">
        <span>Created by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noreferrer" className="font-semibold text-gray-500 hover:text-blue-500">S. Shakir</a></span>
        <span className="text-gray-300">|</span>
        <button onClick={() => setIsAboutOpen(true)} className="hover:text-blue-500">About</button>
      </footer>
    </div>
  );
}

export default App
