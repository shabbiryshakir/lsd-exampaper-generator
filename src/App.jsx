import { useState, useEffect } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { DEFAULT_HEADER, DEFAULT_HIJRI_YEAR, normalizeSubjects, sampleSubjects, uid } from './lib/paperModel'
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
      setSubjects(sampleSubjects());
      setAppState(new URLSearchParams(window.location.search).get('demo') || 'editor');
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setAppState('dashboard');
        loadUserSettings(currentUser.uid); // Load user's cloud settings
        loadUserPapers(currentUser.uid);
      }
      else { setUser(null); setAppState('login'); }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); alert("Login failed!"); } };
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
    catch (error) { console.error("Error saving folders:", error); alert("Could not save folders."); }
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
    try { await updateDoc(doc(db, "papers", paperId), { folderId }); } catch (error) { console.error(error); alert("Could not move paper."); }
  };
  // ----------------------------

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newSettings = { ...schoolSettings, logo: reader.result };
        setSchoolSettings(newSettings);
        try { localStorage.setItem('schoolSettings', JSON.stringify(newSettings)); } catch(e){}
      };
      reader.readAsDataURL(file);
    }
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
    try {
      const q = query(collection(db, "papers"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const papers = [];
      querySnapshot.forEach((d) => { papers.push({ id: d.id, ...d.data() }); });
      setSavedPapers(papers);
    } catch (error) { console.error("Error loading papers:", error); }
  };

  const paperPayload = () => ({ userId: user.uid, authorName: user.displayName || '', header: paperData, subjects, schoolBranding: schoolSettings, folderId: currentFolderId || null, lastEdited: new Date().toISOString() });

  const savePaperToCloud = async () => {
    if (!user) return;
    if (DEMO) { alert("Demo mode: nothing is saved."); return; }
    setIsSaving(true);
    try {
      if (currentPaperId) {
        await updateDoc(doc(db, "papers", currentPaperId), paperPayload());
        alert("Paper saved successfully!");
      } else {
        const docRef = await addDoc(collection(db, "papers"), paperPayload());
        setCurrentPaperId(docRef.id);
        alert("New paper saved successfully!");
      }
      loadUserPapers(user.uid);
    } catch (error) { console.error(error); alert("Oops! Something went wrong."); }
    setIsSaving(false);
  };

  const deletePaper = async (id) => {
    if (window.confirm("Are you sure you want to permanently delete this paper?")) {
      try { if (!DEMO) await deleteDoc(doc(db, "papers", id)); setSavedPapers(savedPapers.filter(p => p.id !== id)); }
      catch (error) { console.error(error); alert("Failed to delete."); }
    }
  };

  const duplicatePaper = async (paper) => {
    if (DEMO) return;
    try {
      const { id, ...rest } = paper;
      await addDoc(collection(db, "papers"), { ...rest, header: { ...rest.header, paperNumber: `${rest.header?.paperNumber || 'Paper'} (copy)` }, lastEdited: new Date().toISOString() });
      loadUserPapers(user.uid);
    } catch (error) { console.error(error); alert("Failed to duplicate."); }
  };

  const startNewPaper = () => {
    setCurrentPaperId(null);
    setCurrentFolderId(null);
    setHeaderData({ ...DEFAULT_HEADER, hijriYear: DEFAULT_HIJRI_YEAR });
    setSubjects(blankSubjects());
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

    setHeaderData({
      className: paper.header?.className || DEFAULT_HEADER.className,
      examName: cleanExamName,
      hijriYear: year,
      paperNumber: paper.header?.paperNumber || DEFAULT_HEADER.paperNumber,
      time: paper.header?.time || DEFAULT_HEADER.time,
      coverMode: paper.header?.coverMode || DEFAULT_HEADER.coverMode,
    });
    setSubjects(normalizeSubjects(paper.subjects));
    if (paper.schoolBranding) setSchoolSettings({ ...paper.schoolBranding, ...schoolSettings });
    setAppState('editor');
  };

  const handlePrint = () => { window.print(); };

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
  const tabBtn = (id, label) => <button onClick={() => setAppState(id)} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${appState === id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>{label}</button>;

  return (
    <div className="min-h-screen bg-gray-100 pb-20 print:bg-white relative flex flex-col">

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
        <Dashboard user={user} papers={savedPapers} folders={folders}
          onOpen={openSavedPaper} onNew={startNewPaper} onDelete={deletePaper} onDuplicate={duplicatePaper} onMove={movePaper}
          onAddFolder={addFolder} onRenameFolder={renameFolder} onDeleteFolder={deleteFolder}
          onSettings={() => setIsSettingsOpen(true)} onLogout={handleLogout} />
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-gray-100 pt-4 px-4 pb-2 print:hidden">
            <nav className="bg-white px-4 py-2.5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center max-w-4xl mx-auto w-full gap-2">
              <button onClick={() => setAppState('dashboard')} className="text-gray-500 hover:text-gray-800 font-medium text-sm px-2 py-1 rounded transition">← Dashboard</button>

              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                {tabBtn('editor', 'Editor')}
                {tabBtn('preview', 'Preview')}
                {tabBtn('answers', 'Answer key')}
              </div>

              <div className="flex gap-3 items-center">
                {appState === 'editor' && ( <button onClick={() => savePaperToCloud()} disabled={isSaving} className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition font-bold text-sm disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button> )}
                {isPaperView && ( <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-1.5 rounded-md hover:bg-black transition font-bold text-sm font-sans flex items-center gap-2"><span>🖨️</span> Print PDF</button> )}
              </div>
            </nav>
          </div>

          <div className="flex-grow p-4 print:p-0">
            {isPaperView
              ? <PaperPages paperData={paperData} subjects={subjects} school={schoolSettings} showAnswers={appState === 'answers'} />
              : <Editor paperData={paperData} setHeaderData={setHeaderData} subjects={subjects} setSubjects={setSubjects} />}
          </div>
        </>
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
