import { useState, useEffect } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { GoogleGenerativeAI } from "@google/generative-ai"

const DARAJAH_OPTIONS = ['روضة أطفال', 'الدرجة الأولى', 'الدرجة الثانية', 'الدرجة الثالثة', 'الدرجة الرابعة', 'الدرجة الخامسة', 'الدرجة السادسة', 'الدرجة السابعة', 'الدرجة الثامنة', 'الدرجة التاسعة', 'الدرجة العاشرة'];
const TIME_OPTIONS = ['30 Mins', '45 Mins', '1 Hr', '1 Hr 15 Mins', '1 Hr 30 Mins', '1 Hr 45 Mins', '2 Hrs', '2.5 Hrs', '3 Hrs'];
const ABJAD_LETTERS = ['ا', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];

// Smart Arabic Numeral Converter
const toArabicNumerals = (str) => {
  if (str == null) return '';
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(str).replace(/[0-9]/g, w => arabicNumbers[+w]);
};

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading'); 
  const [savedPapers, setSavedPapers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPaperId, setCurrentPaperId] = useState(null); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [geminiApiKey, setGeminiApiKey] = useState(() => { try { return localStorage.getItem('geminiApiKey') || ''; } catch(e) { return ''; } });
  const [schoolSettings, setSchoolSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('schoolSettings');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : { nameAr: 'پنجتنية هاير سيكندري اسكول - برواني', nameEn: 'PHS SCHOOL', logo: '' };
    } catch(e) { return { nameAr: 'پنجتنية هاير سيكندري اسكول - برواني', nameEn: 'PHS SCHOOL', logo: '' }; }
  });

  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [aiReviewFeedback, setAiReviewFeedback] = useState("");

  const [paperData, setHeaderData] = useState({
    className: 'الدرجة الرابعة', examName: 'الامتحان السنوي ١٤٤٦هـ', paperNumber: 'Paper 1', time: '1 Hr 30 Mins',
  });
  
  const [subjects, setSubjects] = useState([{ id: Date.now(), title: 'تعليم القرآن', questions: [] }]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) { setUser(currentUser); setAppState('dashboard'); loadUserPapers(currentUser.uid); } 
      else { setUser(null); setAppState('login'); }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => { try { await signInWithPopup(auth, googleProvider); } catch (error) { console.error(error); alert("Login failed!"); } };
  const handleLogout = async () => { try { await signOut(auth); setAppState('login'); } catch (error) { console.error(error); } };
  const saveApiKey = (key) => { setGeminiApiKey(key); try { localStorage.setItem('geminiApiKey', key); } catch(e){} };

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

  const handleSettingChange = (e) => {
    const newSettings = { ...schoolSettings, [e.target.name]: e.target.value };
    setSchoolSettings(newSettings);
    try { localStorage.setItem('schoolSettings', JSON.stringify(newSettings)); } catch(e){}
  };

  const loadUserPapers = async (userId) => {
    try {
      const q = query(collection(db, "papers"), where("userId", "==", userId));
      const querySnapshot = await getDocs(q);
      const papers = [];
      querySnapshot.forEach((doc) => { papers.push({ id: doc.id, ...doc.data() }); });
      setSavedPapers(papers);
    } catch (error) { console.error("Error loading papers:", error); }
  };

  const savePaperToCloud = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const paperPayload = { userId: user.uid, authorName: user.displayName, header: paperData, subjects: subjects, schoolBranding: schoolSettings, lastEdited: new Date().toISOString() };
      if (currentPaperId) {
        await updateDoc(doc(db, "papers", currentPaperId), paperPayload);
        alert("Paper saved successfully!");
      } else {
        const docRef = await addDoc(collection(db, "papers"), paperPayload);
        setCurrentPaperId(docRef.id);
        alert("New paper saved successfully!");
      }
      loadUserPapers(user.uid); 
    } catch (error) { console.error(error); alert("Oops! Something went wrong."); }
    setIsSaving(false);
  };

  const deletePaper = async (e, id) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to permanently delete this paper?")) {
      try { await deleteDoc(doc(db, "papers", id)); setSavedPapers(savedPapers.filter(p => p.id !== id)); } 
      catch (error) { console.error(error); alert("Failed to delete."); }
    }
  };

  const generatePaperReview = async () => {
    if (!geminiApiKey) { alert("Please save your Gemini API Key in Settings first!"); return; }
    setIsAiLoading(true); setAiReviewFeedback(""); setIsReviewModalOpen(true); 
    try {
      const genAI = new GoogleGenerativeAI(geminiApiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      const prompt = `You are an Academic Coordinator reviewing an exam paper written in Lisan al-Dawat. Review the marks distribution, question flow, and check for typos. Do not rewrite the paper, just provide bullet point feedback. Data: ${JSON.stringify({ Header: paperData, Subjects: subjects })}`;
      const result = await model.generateContent(prompt);
      setAiReviewFeedback(result.response.text());
    } catch (error) { console.error("AI Error:", error); setAiReviewFeedback("❌ AI failed to generate a report."); }
    setIsAiLoading(false);
  };

  const startNewPaper = () => {
    setCurrentPaperId(null);
    setHeaderData({ className: 'الدرجة الرابعة', examName: 'الامتحان السنوي ١٤٤٦هـ', paperNumber: 'Paper 1', time: '1 Hr 30 Mins' });
    setSubjects([{ id: Date.now(), title: 'تعليم القرآن', questions: [] }]);
    setAppState('editor');
  };

  const openSavedPaper = (paper) => {
    setCurrentPaperId(paper.id);
    setHeaderData({
      className: paper.header?.className || 'الدرجة الرابعة',
      examName: paper.header?.examName || 'الامتحان السنوي ١٤٤٦هـ',
      paperNumber: paper.header?.paperNumber || 'Paper 1',
      time: paper.header?.time || '1 Hr 30 Mins'
    });
    
    const normalizedSubjects = (paper.subjects || []).map(sub => ({
      ...sub,
      questions: (sub.questions || []).map(q => {
        let normalizedQ = { ...q };
        if (q.type === 'subjective' && !q.subQuestions) normalizedQ.subQuestions = [{ id: q.id || Date.now(), text: q.questionText || '', lines: q.lines || 3 }];
        if (q.type === 'fillBlanks' && q.showWordBank === undefined) normalizedQ.showWordBank = true;
        if (q.type === 'match' && !q.pairs) normalizedQ.pairs = [];
        return normalizedQ;
      })
    }));

    setSubjects(normalizedSubjects);
    if (paper.schoolBranding) setSchoolSettings(paper.schoolBranding);
    setAppState('editor');
  };

  const handlePrint = () => { window.print(); };

  const handleInputChange = (e) => setHeaderData({ ...paperData, [e.target.name]: e.target.value });
  const addSubject = () => setSubjects([...(subjects || []), { id: Date.now(), title: 'New Subject', questions: [] }]);
  const updateSubjectTitle = (subjectId, newTitle) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, title: newTitle } : s));
  const removeSubject = (subjectId) => setSubjects((subjects || []).filter(s => s.id !== subjectId));
  
  const addQuestion = (subjectId, type) => {
    const baseQuestion = { id: Date.now(), type, marks: 0, text: 'سوالونا جواب لكهو .' };
    let newQuestion = { ...baseQuestion };
    if (type === 'subjective') newQuestion = { ...newQuestion, subQuestions: [{ id: Date.now(), text: '', lines: 3 }] };
    else if (type === 'fillBlanks') newQuestion = { ...newQuestion, showWordBank: true, wordBank: 'أَسَاوِرَ, شَرَابًا', content: 'وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *' }; 
    else if (type === 'match') newQuestion = { ...newQuestion, pairs: [{ right: '', left: '' }] };
    setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: [...(s.questions || []), newQuestion] } : s));
  };

  const updateQuestion = (subjectId, qId, field, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, [field]: value } : q) } : s));
  const removeQuestion = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).filter(q => q.id !== qId) } : s));
  const addSubQuestion = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, subQuestions: [...(q.subQuestions || []), { id: Date.now(), text: '', lines: 3 }] } : q) } : s));
  const updateSubQuestion = (subjectId, qId, subId, field, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, subQuestions: (q.subQuestions || []).map(sq => sq.id === subId ? { ...sq, [field]: value } : sq) } : q) } : s));
  const removeSubQuestion = (subjectId, qId, subId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, subQuestions: (q.subQuestions || []).filter(sq => sq.id !== subId) } : q) } : s));
  const addPair = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, pairs: [...(q.pairs || []), { right: '', left: '' }] } : q) } : s));
  const updatePair = (subjectId, qId, pairIndex, side, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, pairs: (q.pairs || []).map((p, i) => i === pairIndex ? { ...p, [side]: value } : p) } : q) } : s));
  const removePair = (subjectId, qId, pairIndex) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, pairs: (q.pairs || []).filter((_, i) => i !== pairIndex) } : q) } : s));
  
  const calculateSubjectTotal = (subject) => (subject.questions || []).reduce((total, q) => total + (parseInt(q.marks) || 0), 0);
  const calculateGrandTotal = () => (subjects || []).reduce((total, sub) => total + calculateSubjectTotal(sub), 0);

  // --- THE MAGIC PAGINATION ENGINE ---
  const generatePages = () => {
    const pages = [];
    let currentItems = [];
    let currentHeight = 0;
    const MAX_PAGE_HEIGHT = 800; // Physical pixel limit per A4 Box

    subjects.forEach((sub) => {
      const subTitleHeight = 60;
      if (currentHeight + subTitleHeight > MAX_PAGE_HEIGHT && currentItems.length > 0) {
        pages.push(currentItems);
        currentItems = [];
        currentHeight = 0;
      }
      currentItems.push({ type: 'subject', data: sub });
      currentHeight += subTitleHeight;

      sub.questions.forEach((q, qIndex) => {
        let qHeight = 50; // Base instruction height
        if (q.type === 'subjective') {
          (q.subQuestions || []).forEach(sq => { qHeight += 40 + ((parseInt(sq.lines) || 3) * 40); });
        } else if (q.type === 'fillBlanks') {
          qHeight += 100;
        } else if (q.type === 'match') {
          qHeight += 30 + ((q.pairs || []).length * 40);
        }

        // If question doesn't fit, start a new A4 sheet!
        if (currentHeight + qHeight > MAX_PAGE_HEIGHT && currentItems.length > 0) {
          pages.push(currentItems);
          currentItems = [];
          currentHeight = 0;
        }
        currentItems.push({ type: 'question', data: q, qIndex, subject: sub });
        currentHeight += qHeight;
      });
    });

    if (currentItems.length > 0) pages.push(currentItems);
    return pages;
  };


  if (appState === 'loading') return <div className="min-h-screen flex items-center justify-center text-xl font-bold">Loading...</div>;

  if (appState === 'login') {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white p-10 rounded-xl shadow-lg max-w-md w-full text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Paper Generator</h1>
          <p className="text-gray-500 mb-8">Sign in to manage your school papers</p>
          <button onClick={handleLogin} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition">Sign in with Google</button>
        </div>
      </div>
    );
  }

  if (appState === 'dashboard') {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-6 flex flex-col">
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 relative">
                <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 font-bold text-xl">✕</button>
                <h2 className="text-xl font-bold text-gray-800 mb-6">⚙️ Application Settings</h2>
                <div className="mb-6 border-b pb-6">
                  <h3 className="font-bold text-gray-700 mb-2">🏫 School Branding</h3>
                  <label className="block text-xs text-gray-500 mb-1">School Name (English)</label>
                  <input type="text" name="nameEn" value={schoolSettings?.nameEn || ''} onChange={handleSettingChange} className="w-full border p-2 rounded mb-3 font-serif text-sm" />
                  <label className="block text-xs text-gray-500 mb-1">School Name (Arabic)</label>
                  <input type="text" name="nameAr" value={schoolSettings?.nameAr || ''} onChange={handleSettingChange} className="w-full border p-2 rounded mb-3 font-arabic text-lg" dir="rtl" />
                  <label className="block text-xs text-gray-500 mb-1">Upload Logo</label>
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="w-full text-sm mb-2" />
                  {schoolSettings?.logo && <div className="mt-2 flex justify-center bg-gray-50 border p-2 rounded"><img src={schoolSettings.logo} alt="Preview" className="h-12 object-contain" /></div>}
                </div>
                <div>
                  <h3 className="font-bold text-gray-700 mb-2">✨ AI Reviewer Settings</h3>
                  <label className="block text-xs text-gray-500 mb-1">Gemini API Key</label>
                  <input type="password" value={geminiApiKey || ''} onChange={(e) => saveApiKey(e.target.value)} className="w-full border p-2 rounded mb-2 text-sm" placeholder="AIzaSy..." />
                </div>
             </div>
          </div>
        )}

        <nav className="bg-white p-4 rounded-lg shadow-sm mb-8 flex justify-between items-center max-w-5xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <img src={user?.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-gray-200" />
            <div>
              <h1 className="text-base md:text-lg font-bold text-gray-800">{user?.displayName}</h1>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => setIsSettingsOpen(true)} className="text-gray-600 hover:bg-gray-100 px-3 py-2 rounded text-sm font-medium transition">⚙️ Settings</button>
             <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 px-3 py-2 rounded text-sm font-medium transition">Logout</button>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto w-full flex-grow">
          <div className="flex justify-between items-end mb-6">
            <h2 className="text-2xl font-bold text-gray-800">My Papers</h2>
            <button onClick={startNewPaper} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 font-bold shadow-sm text-sm transition">+ New Paper</button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {(savedPapers || []).length === 0 ? (
              <p className="text-gray-500 col-span-full text-center py-10 bg-white rounded-lg shadow-sm border border-dashed border-gray-300">No papers saved yet. Create your first one!</p>
            ) : (
              (savedPapers || []).map(paper => (
                <div key={paper.id} onClick={() => openSavedPaper(paper)} className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-blue-400 hover:shadow-md transition cursor-pointer relative group">
                  <button onClick={(e) => deletePaper(e, paper.id)} className="absolute top-3 right-3 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100" title="Delete Paper">🗑️</button>
                  <div className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded inline-block mb-3 font-arabic" dir="rtl">{paper.header?.className || 'Unknown'}</div>
                  <h3 className="text-lg font-bold mb-1 font-arabic text-gray-800 leading-tight" dir="rtl">{paper.header?.examName || 'Untitled'}</h3>
                  <p className="text-gray-500 text-xs mb-3 font-sans font-medium">{paper.header?.paperNumber || ''}</p>
                  <p className="text-xs text-gray-400 font-medium">Subjects: {paper.subjects?.length || 0}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <footer className="mt-12 py-4 text-center text-gray-400">
          <p className="font-sans text-xs tracking-wide">
            Created by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 font-medium transition duration-300">M Shabbir Shakir</a>
          </p>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20 print:bg-white relative flex flex-col">
      
      {isReviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-purple-700 text-white p-4 flex justify-between items-center"><h2 className="text-lg font-bold">🤖 AI Paper Review</h2><button onClick={() => setIsReviewModalOpen(false)} className="text-white hover:bg-purple-600 px-3 py-1 rounded text-sm">Close ✕</button></div>
            <div className="p-6 overflow-y-auto bg-purple-50 flex-grow">
              {isAiLoading ? ( <div className="flex flex-col items-center justify-center py-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700 mb-4"></div><p className="text-purple-700 font-medium text-sm">Reading your paper...</p></div> ) : ( <div className="prose prose-sm prose-purple max-w-none whitespace-pre-wrap text-gray-700 font-sans">{aiReviewFeedback}</div> )}
            </div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <div className="sticky top-0 z-40 bg-gray-100 pt-4 px-4 pb-2 print:hidden">
        <nav className="bg-white px-4 py-2.5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center max-w-4xl mx-auto w-full">
          <button onClick={() => setAppState('dashboard')} className="text-gray-500 hover:text-gray-800 font-medium text-sm px-2 py-1 rounded transition">← Dashboard</button>
          
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button onClick={() => setAppState('editor')} className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${appState === 'editor' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Editor</button>
            <button onClick={() => setAppState('preview')} className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${appState === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Preview</button>
          </div>

          <div className="flex gap-3 items-center">
            {appState === 'editor' && ( <button onClick={() => savePaperToCloud()} disabled={isSaving} className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition font-bold text-sm disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button> )}
            {appState === 'preview' && ( <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-1.5 rounded-md hover:bg-black transition font-bold text-sm font-sans flex items-center gap-2"><span>🖨️</span> PDF / Print</button> )}
          </div>
        </nav>
      </div>

      <div className="flex-grow p-4 print:p-0">
      {appState === 'preview' ? (
        
        /* ================= PAGINATED PREVIEW HTML ================= */
        <div className="print:m-0 print:w-full">
          
          {/* ---- PAGE 1: COVER PAGE ---- */}
          <div className="a4-print-box text-xl" dir="rtl">
            <div className="text-center flex flex-col items-center pt-6 mb-8">
              {schoolSettings?.logo && ( <img src={schoolSettings.logo} alt="School Logo" className="h-20 object-contain mb-2" /> )}
              <h2 className="text-xl font-bold font-serif mb-2 tracking-wide uppercase text-gray-800">{schoolSettings?.nameEn || 'PHS SCHOOL'}</h2>
              <h2 className="text-3xl font-bold font-arabic mb-4">{schoolSettings?.nameAr || 'پنجتنية هاير سيكندري اسكول - برواني'}</h2>
              <h3 className="text-2xl font-bold font-arabic mb-4">{paperData?.examName || ''}</h3>
              <h3 className="text-xl font-arabic">{paperData?.className || ''}</h3>
            </div>
            
            <div className="max-w-3xl mx-auto w-full flex-grow">
              <div className="flex justify-between items-end mb-4 font-bold text-lg border-b-2 border-black pb-2">
                 <span className="font-arabic text-xl">{paperData?.className || ''}</span>
                 <span className="font-serif text-lg">{paperData?.paperNumber || ''}</span>
                 <span className="font-serif text-base font-medium" dir="ltr">Time: {paperData?.time || ''}</span>
              </div>
              
              <table className="w-full border-collapse border border-black mb-10 font-arabic text-lg">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 w-[15%]">نام:</td>
                    <td className="border border-black p-2 w-[35%]"></td>
                    <td className="border border-black p-2 w-[15%] font-serif font-bold text-left text-sm" dir="ltr">ITS NO:</td>
                    <td className="border border-black p-2 w-[35%]"></td>
                  </tr>
                  <tr>
                    <td className="border border-black p-2 font-serif font-bold text-left text-sm" dir="ltr">ROLL NO:</td>
                    <td className="border border-black p-2"></td>
                    <td className="border border-black p-2 bg-gray-100" colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
              
              <table className="w-full mx-auto border-collapse border border-black text-center font-bold font-arabic text-lg">
                <thead><tr className="bg-gray-100"><th className="border border-black p-2 w-16">رقم</th><th className="border border-black p-2">المواضيع</th><th className="border border-black p-2 w-28">ماركس</th><th className="border border-black p-2 w-32">المحصول</th></tr></thead>
                <tbody>
                  {(subjects || []).map((sub, index) => (<tr key={sub.id}><td className="border border-black p-2 font-arabic text-xl">{toArabicNumerals(index + 1)}</td><td className="border border-black p-2 text-right pr-4">{sub.title}</td><td className="border border-black p-2 font-arabic text-xl">{toArabicNumerals(calculateSubjectTotal(sub))}</td><td className="border border-black p-2"></td></tr>))}
                  <tr className="bg-gray-50"><td className="border border-black p-2" colSpan="2">جملة</td><td className="border border-black p-2 font-arabic text-xl">{toArabicNumerals(calculateGrandTotal())}</td><td className="border border-black p-2"></td></tr>
                </tbody>
              </table>
            </div>

            <div className="absolute bottom-6 left-0 right-0 text-center text-gray-500 font-arabic text-base print:hidden">صفحة {toArabicNumerals(1)}</div>
          </div>

          {/* ---- PAGE 2+: DYNAMICALLY CHUNKED PAGES ---- */}
          {generatePages().map((pageItems, pageIndex) => (
            <div key={`page-${pageIndex}`} className="a4-print-box text-xl" dir="rtl">
              
              {/* Repeating Page Header */}
              <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-6 text-lg font-bold text-gray-800 font-arabic">
                 <span>{paperData?.className || ''}</span>
                 <span>{paperData?.examName || ''}</span>
              </div>
              
              {/* Flowing Content for this Specific A4 Box */}
              <div className="flex-grow">
                {pageItems.map((item, idx) => {
                  
                  if (item.type === 'subject') {
                    return (
                      <div key={idx} className="flex justify-between items-center bg-gray-100 p-2 mb-4 font-bold text-xl border-y border-black font-arabic">
                        <span>{item.data.title}</span><span className="font-arabic text-xl">{toArabicNumerals(calculateSubjectTotal(item.data))}</span>
                      </div>
                    );
                  }

                  if (item.type === 'question') {
                    const q = item.data;
                    return (
                      <div key={idx} className="mb-6 font-arabic">
                        <div className="flex justify-between items-start mb-3"><div className="flex gap-2 w-11/12"><span className="font-bold text-xl font-arabic">{toArabicNumerals(item.qIndex + 1)}.</span><p className="leading-relaxed text-xl font-bold font-arabic">{q.text}</p></div><div className="w-1/12 text-center font-bold border border-black px-1 py-1 rounded text-lg font-arabic">{toArabicNumerals(q.marks)}</div></div>
                        
                        {q.type === 'subjective' && ( 
                          <div className="mt-2 px-4">
                            {(q.subQuestions || []).map((sq, i) => (
                              <div key={sq.id} className="mb-4">
                                <div className="flex gap-2 items-start">
                                  <span className="font-bold text-xl ml-2 font-arabic">{ABJAD_LETTERS[i] || '-'}</span>
                                  <p className="font-bold text-xl leading-relaxed font-arabic">{sq.text}</p>
                                </div>
                                <div className="mt-3">
                                  {[...Array(parseInt(sq.lines) || 0)].map((_, j) => (<div key={j} className="border-b-2 border-dotted border-gray-500 mt-10"></div>))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {q.type === 'fillBlanks' && ( 
                          <div className="mt-3 px-4">
                            {q.showWordBank && q.wordBank && (
                              <div className="border-2 border-black p-2 flex flex-wrap gap-4 justify-center mb-4 text-xl rounded">
                                {q.wordBank.split(',').map((word, i) => ( <span key={i} className="px-2 font-arabic">{word.trim()}</span> ))}
                              </div>
                            )}
                            <p className="leading-[3rem] text-xl whitespace-pre-wrap font-arabic">
                              {(q.content || '').split('*').map((part, i, arr) => (
                                <span key={i}>
                                  {part}
                                  {i !== arr.length - 1 && (<span className="inline-block w-28 border-b-2 border-black mx-2 translate-y-2"></span>)}
                                </span>
                              ))}
                            </p>
                          </div>
                        )}

                        {q.type === 'match' && ( 
                          <div className="mt-4 px-2">
                            <table className="w-full border-collapse border border-black text-center text-lg font-arabic">
                              <tbody>
                                {(q.pairs || []).map((pair, i) => {
                                  const jumbledIndex = (q.pairs || []).length > 0 ? (i + 1) % (q.pairs || []).length : 0;
                                  return (
                                    <tr key={i}>
                                      <td className="border border-black p-2 text-right pr-4 leading-relaxed w-5/12 font-arabic"><span className="ml-2 font-bold">{toArabicNumerals(i + 1)}.</span> {pair.right}</td>
                                      <td className="border border-black p-2 text-center text-gray-400 font-serif text-base w-2/12">[ &nbsp;&nbsp;&nbsp; ]</td>
                                      <td className="border border-black p-2 text-right pr-4 leading-relaxed w-5/12 font-arabic">{(q.pairs || [])[jumbledIndex]?.left}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  }
                })}
              </div>

              {/* Repeating Page Footer */}
              <div className="mt-auto border-t border-gray-300 pt-2 text-center text-gray-500 font-arabic text-base">
                  صفحة {toArabicNumerals(pageIndex + 2)}
              </div>
            </div>
          ))}
        </div>

      ) : (

        /* ================= EDITOR HTML ================= */
        <div className="max-w-4xl mx-auto space-y-6 print:hidden flex-grow">
          
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md flex justify-between items-center shadow-sm">
            <p className="text-sm text-yellow-700 font-medium">⚠️ <strong>Remember to Save:</strong> Please click the Save button regularly to prevent losing your work.</p>
            <button onClick={generatePaperReview} className="bg-white text-purple-700 border border-purple-200 px-3 py-1 rounded hover:bg-purple-50 transition text-xs font-bold shadow-sm">🤖 AI Review</button>
          </div>

          <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Paper Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block mb-1 font-bold text-xs text-gray-600">Class (Darajah)</label>
                <select name="className" value={paperData?.className || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl">
                  {DARAJAH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
              <div><label className="block mb-1 font-bold text-xs text-gray-600">Exam Name</label><input type="text" name="examName" value={paperData?.examName || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl" /></div>
              <div><label className="block mb-1 font-bold text-xs text-gray-600">Paper No.</label><input type="text" name="paperNumber" value={paperData?.paperNumber || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-serif text-sm" /></div>
              <div>
                <label className="block mb-1 font-bold text-xs text-gray-600">Duration</label>
                <select name="time" value={paperData?.time || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-serif text-sm">
                  {TIME_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>
          </div>
          
          {(subjects || []).map((subject, sIndex) => (
            <div key={subject.id} className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-indigo-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 border-b pb-4 gap-3">
                 <div className="w-full md:w-1/2">
                    <label className="block mb-1 font-bold text-xs text-indigo-800">Subject Name (الموضوع)</label>
                    <input type="text" value={subject.title || ''} onChange={(e) => updateSubjectTitle(subject.id, e.target.value)} className="w-full border border-indigo-200 p-2 rounded-md text-xl font-bold font-arabic focus:border-indigo-400 focus:outline-none" dir="rtl" />
                 </div>
                 <div className="flex items-center gap-3 self-end md:self-auto">
                    <div className="text-center px-3 py-1.5 bg-indigo-50 rounded-md font-bold text-indigo-700 font-sans text-sm border border-indigo-100">Total: {calculateSubjectTotal(subject)}</div>
                    <button onClick={() => removeSubject(subject.id)} className="text-red-500 hover:text-red-700 text-xs font-bold bg-white px-2 py-1.5 rounded-md border border-red-200 shadow-sm transition">Delete Subject</button>
                 </div>
              </div>
              
              {(subject.questions || []).map((q, qIndex) => (
                <div key={q.id} className="bg-gray-50 p-4 mb-4 rounded-lg border border-gray-200 relative group">
                  <button onClick={() => removeQuestion(subject.id, q.id)} className="absolute top-3 left-3 text-gray-400 hover:text-red-500 text-xs font-bold transition">✕ Remove</button>
                  <h3 className="font-bold text-gray-700 mb-3 font-sans text-sm">Q {qIndex + 1}</h3>
                  
                  <div className="flex flex-col md:flex-row gap-3 mb-3">
                     <div className="w-full md:w-3/4">
                        <label className="block mb-1 text-xs font-bold text-gray-600">Main Instruction</label>
                        <input type="text" value={q.text || ''} onChange={(e) => updateQuestion(subject.id, q.id, 'text', e.target.value)} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl" />
                     </div>
                     <div className="w-full md:w-1/4">
                        <label className="block mb-1 text-xs font-bold text-gray-600">Marks</label>
                        <input type="number" value={q.marks || 0} onChange={(e) => updateQuestion(subject.id, q.id, 'marks', e.target.value)} className="w-full border border-gray-300 p-2 rounded-md font-sans text-sm" />
                     </div>
                  </div>
                  
                  {q.type === 'subjective' && ( 
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-blue-600 mb-3 font-medium">ℹ️ Add multiple sub-questions (ا, ب, ج) below.</p>
                      {(q.subQuestions || [{ id: q.id, text: q.questionText || '', lines: q.lines || 3 }]).map((sq, sqIndex) => (
                        <div key={sq.id} className="flex flex-col md:flex-row gap-3 mb-3 items-start bg-white p-3 rounded-md border border-gray-200 shadow-sm">
                          <div className="w-full md:w-3/4 flex gap-2">
                             <span className="font-bold text-lg pt-1 font-arabic text-gray-500">{ABJAD_LETTERS[sqIndex] || '-'}</span>
                             <textarea value={sq.text || ''} onChange={(e) => updateSubQuestion(subject.id, q.id, sq.id, 'text', e.target.value)} className="w-full border border-gray-300 p-2 rounded-md min-h-[50px] font-arabic text-lg" dir="rtl" placeholder="..." />
                          </div>
                          <div className="w-full md:w-1/4 flex gap-2 md:flex-col items-center md:items-stretch">
                             <div className="flex-1">
                               <label className="block mb-1 text-[10px] font-bold text-gray-500 uppercase">Lines</label>
                               <input type="number" value={sq.lines || 3} onChange={(e) => updateSubQuestion(subject.id, q.id, sq.id, 'lines', e.target.value)} className="w-full border border-gray-300 p-1.5 rounded-md font-sans text-sm" />
                             </div>
                             {((q.subQuestions || []).length > 1) && <button onClick={() => removeSubQuestion(subject.id, q.id, sq.id)} className="text-red-500 text-xs font-medium md:mt-4 hover:underline">Drop</button>}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => addSubQuestion(subject.id, q.id)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-md font-bold border border-green-200 hover:bg-green-100 transition">+ Sub-Question</button>
                    </div> 
                  )}

                  {q.type === 'fillBlanks' && ( 
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-blue-600 mb-3 font-medium">ℹ️ Type a SINGLE asterisk (*) to insert a blank line.</p>
                      <div className="flex items-center gap-2 mb-3">
                         <input type="checkbox" id={`wb-${q.id}`} checked={q.showWordBank !== false} onChange={(e) => updateQuestion(subject.id, q.id, 'showWordBank', e.target.checked)} className="w-3.5 h-3.5" />
                         <label htmlFor={`wb-${q.id}`} className="font-bold text-xs text-gray-700 cursor-pointer">Show Word Bank</label>
                      </div>
                      {q.showWordBank !== false && (
                        <div className="mb-3"><label className="block mb-1 text-xs font-bold text-gray-600">Word Bank (Comma separated)</label><input type="text" value={q.wordBank || ''} onChange={(e) => updateQuestion(subject.id, q.id, 'wordBank', e.target.value)} className="w-full border border-gray-300 p-2 rounded-md font-bold font-arabic text-lg" dir="rtl" /></div>
                      )}
                      <div><label className="block mb-1 text-xs font-bold text-gray-600">Paragraph</label><textarea value={q.content || ''} onChange={(e) => updateQuestion(subject.id, q.id, 'content', e.target.value)} className="w-full border border-gray-300 p-2 rounded-md min-h-[80px] leading-relaxed font-arabic text-lg" dir="rtl" /></div>
                    </div> 
                  )}

                  {q.type === 'match' && ( 
                    <div className="border-t border-gray-200 pt-3">
                      <p className="text-xs text-blue-600 mb-3 font-medium">ℹ️ Type correct pairs. They will jumble automatically on paper.</p>
                      <div className="space-y-2">
                        {(q.pairs || []).map((pair, pIndex) => (
                          <div key={pIndex} className="flex gap-2 items-center bg-white p-2 border border-gray-200 rounded-md shadow-sm">
                            <span className="font-bold font-sans text-gray-400 text-xs w-[5%]">{pIndex + 1}.</span>
                            <input type="text" value={pair.right || ''} onChange={(e) => updatePair(subject.id, q.id, pIndex, 'right', e.target.value)} placeholder="Right..." className="w-[42%] border border-gray-300 p-1.5 rounded-md font-arabic text-lg" dir="rtl" />
                            <span className="font-bold text-gray-300 text-sm">=</span>
                            <input type="text" value={pair.left || ''} onChange={(e) => updatePair(subject.id, q.id, pIndex, 'left', e.target.value)} placeholder="Left..." className="w-[42%] border border-gray-300 p-1.5 rounded-md font-arabic text-lg" dir="rtl" />
                            <button onClick={() => removePair(subject.id, q.id, pIndex)} className="w-[8%] text-red-400 font-bold text-lg hover:text-red-600">×</button>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addPair(subject.id, q.id)} className="mt-3 text-xs bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md font-bold border border-blue-200 hover:bg-blue-100 transition">+ Pair</button>
                    </div> 
                  )}
                </div>
              ))}
              <div className="mt-2 flex flex-wrap gap-2"><button onClick={() => addQuestion(subject.id, 'subjective')} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 transition font-bold text-xs shadow-sm">+ Subjective</button><button onClick={() => addQuestion(subject.id, 'fillBlanks')} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 transition font-bold text-xs shadow-sm">+ Blanks</button><button onClick={() => addQuestion(subject.id, 'match')} className="bg-white border border-gray-300 text-gray-700 px-3 py-1.5 rounded-md hover:bg-gray-50 transition font-bold text-xs shadow-sm">+ Match</button></div>
            </div>
          ))}
          <button onClick={addSubject} className="w-full bg-indigo-50 border border-indigo-200 text-indigo-700 p-3 rounded-xl hover:bg-indigo-100 transition font-bold text-sm shadow-sm mb-4">+ Add Subject Section</button>
        </div>
      )}
      </div>

      <footer className="mt-auto pt-8 pb-4 text-center text-gray-400 print:hidden">
         <p className="font-sans text-xs tracking-wide">
            Created by <a href="https://shabbiryshakir.github.io" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-800 transition duration-300 font-medium">M Shabbir Shakir</a>
         </p>
      </footer>
    </div>
  )
}
export default App