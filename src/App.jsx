import { useState, useEffect } from 'react'
import { db, auth, googleProvider } from './firebase'
import { collection, addDoc, getDocs, query, where, doc, updateDoc, deleteDoc, getDoc, setDoc } from 'firebase/firestore'
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'

const DARAJAH_OPTIONS = ['روضة أطفال', 'الدرجة الأولى', 'الدرجة الثانية', 'الدرجة الثالثة', 'الدرجة الرابعة', 'الدرجة الخامسة', 'الدرجة السادسة', 'الدرجة السابعة', 'الدرجة الثامنة', 'الدرجة التاسعة', 'الدرجة العاشرة'];
const TIME_OPTIONS = ['30 Mins', '45 Mins', '1 Hr', '1 Hr 15 Mins', '1 Hr 30 Mins', '1 Hr 45 Mins', '2 Hrs', '2.5 Hrs', '3 Hrs'];
const ABJAD_LETTERS = ['ا', 'ب', 'ج', 'د', 'ه', 'و', 'ز', 'ح', 'ط', 'ي', 'ك', 'ل', 'م', 'ن', 'س', 'ع', 'ف', 'ص', 'ق', 'ر', 'ش', 'ت', 'ث', 'خ', 'ذ', 'ض', 'ظ', 'غ'];

const toArabicNumerals = (num) => {
  if (num == null) return '';
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/[0-9]/g, w => arabicNumbers[+w]);
};

// Set the default school info here
const DEFAULT_SCHOOL_INFO = { nameAr: 'پنجتنية هاير سيكندري اسكول - برواني', logo: '' };

function App() {
  const [user, setUser] = useState(null);
  const [appState, setAppState] = useState('loading'); 
  const [savedPapers, setSavedPapers] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPaperId, setCurrentPaperId] = useState(null); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  
  const [schoolSettings, setSchoolSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('schoolSettings');
      return (saved && saved !== 'undefined') ? JSON.parse(saved) : DEFAULT_SCHOOL_INFO;
    } catch(e) { return DEFAULT_SCHOOL_INFO; }
  });

  const [paperData, setHeaderData] = useState({
    className: 'الدرجة الرابعة', 
    examName: 'الامتحان السنوي', 
    hijriYear: '1447',
    paperNumber: 'Paper 1', 
    time: '1 Hr 30 Mins',
  });
  
  const [subjects, setSubjects] = useState([{ id: Date.now(), title: 'تعليم القرآن', questions: [] }]);

  const isDense = subjects.length > 5;
  const cpPadding = isDense ? 'p-1.5' : 'p-3';
  const cpText = isDense ? 'text-base' : 'text-xl';
  const cpMargin = isDense ? 'mb-4' : 'mb-10';

  useEffect(() => {
    document.title = "LSD - Exam Paper Generator";
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
      const docRef = doc(db, "users", userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().schoolSettings) {
        setSchoolSettings(docSnap.data().schoolSettings);
        localStorage.setItem('schoolSettings', JSON.stringify(docSnap.data().schoolSettings));
      }
    } catch (error) { console.error("Error loading user settings:", error); }
  };

  const saveUserSettingsToCloud = async (settingsToSave) => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), { schoolSettings: settingsToSave }, { merge: true });
    } catch (error) { console.error("Error saving settings to cloud:", error); }
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

  const startNewPaper = () => {
    setCurrentPaperId(null);
    setHeaderData({ className: 'الدرجة الرابعة', examName: 'الامتحان السنوي', hijriYear: '1447', paperNumber: 'Paper 1', time: '1 Hr 30 Mins' });
    setSubjects([{ id: Date.now(), title: 'تعليم القرآن', questions: [] }]);
    setAppState('editor');
  };

  const openSavedPaper = (paper) => {
    setCurrentPaperId(paper.id);
    
    const exName = paper.header?.examName || 'الامتحان السنوي';
    let cleanExamName = exName;
    let year = paper.header?.hijriYear || '1447';
    if (exName.includes('١٤٤٦هـ')) {
        cleanExamName = exName.replace(' ١٤٤٦هـ', '').replace('١٤٤٦هـ', '').trim();
        year = '1446';
    }

    setHeaderData({
      className: paper.header?.className || 'الدرجة الرابعة',
      examName: cleanExamName,
      hijriYear: year,
      paperNumber: paper.header?.paperNumber || 'Paper 1',
      time: paper.header?.time || '1 Hr 30 Mins'
    });
    
    const normalizedSubjects = (paper.subjects || []).map(sub => ({
      ...sub,
      questions: (sub.questions || []).map(q => {
        let normalizedQ = { ...q };
        if (q.type === 'subjective' && !q.subQuestions) normalizedQ.subQuestions = [{ id: q.id || Date.now(), text: q.questionText || '', lines: q.lines || 3 }];
        if (q.type === 'match' && !q.pairs) normalizedQ.pairs = [];
        if (q.type === 'fillBlanks') {
          if (q.showWordBank === undefined) normalizedQ.showWordBank = true;
          if (!normalizedQ.blanks) {
              const oldLines = (q.content || '').split('\n').filter(line => line.trim() !== '');
              normalizedQ.blanks = oldLines.length > 0 
                  ? oldLines.map((line, idx) => ({ id: Date.now() + idx, text: line, answer: '' }))
                  : [{ id: Date.now(), text: 'وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *', answer: '' }];
          }
        }
        return normalizedQ;
      })
    }));

    setSubjects(normalizedSubjects);
    if (paper.schoolBranding) setSchoolSettings({ ...paper.schoolBranding, ...schoolSettings });
    setAppState('editor');
  };

  const handlePrint = () => { window.print(); };

  const handleInputChange = (e) => setHeaderData({ ...paperData, [e.target.name]: e.target.value });
  const addSubject = () => setSubjects([...(subjects || []), { id: Date.now(), title: 'New Subject', questions: [] }]);
  const updateSubjectTitle = (subjectId, newTitle) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, title: newTitle } : s));
  const removeSubject = (subjectId) => setSubjects((subjects || []).filter(s => s.id !== subjectId));
  
  const addQuestion = (subjectId, type) => {
    let text = '';
    let newQuestion = { id: Date.now(), type, marks: 0 };
    
    if (type === 'subjective') {
        text = 'نيححسس سؤالو نا جوابو لكهو :';
        newQuestion = { ...newQuestion, text, subQuestions: [{ id: Date.now(), text: '', lines: 3 }] };
    } else if (type === 'fillBlanks') {
        text = 'خالي جككه نسس اهنا صحيح جواب سي ثثوري كرو :';
        newQuestion = { ...newQuestion, text, showWordBank: true, blanks: [{ id: Date.now(), text: 'وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *', answer: 'مُخَلَّدُونَ' }] }; 
    } else if (type === 'match') {
        text = 'ثثظظلا column  نسس بيجا column ما اهنا صحيح جوابو ساتهسس جورٌو :';
        newQuestion = { ...newQuestion, text, pairs: [{ right: '', left: '' }] };
    }
    
    setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: [...(s.questions || []), newQuestion] } : s));
  };

  const updateQuestion = (subjectId, qId, field, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, [field]: value } : q) } : s));
  const removeQuestion = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).filter(q => q.id !== qId) } : s));
  
  const addSubQuestion = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, subQuestions: [...(q.subQuestions || []), { id: Date.now(), text: '', lines: 3 }] } : q) } : s));
  const updateSubQuestion = (subjectId, qId, subId, field, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, subQuestions: (q.subQuestions || []).map(sq => sq.id === subId ? { ...sq, [field]: value } : sq) } : q) } : s));
  const removeSubQuestion = (subjectId, qId, subId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, subQuestions: (q.subQuestions || []).filter(sq => sq.id !== subId) } : q) } : s));
  
  const addBlank = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, blanks: [...(q.blanks || []), { id: Date.now(), text: '', answer: '' }] } : q) } : s));
  const updateBlank = (subjectId, qId, blankId, field, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, blanks: (q.blanks || []).map(b => b.id === blankId ? { ...b, [field]: value } : b) } : q) } : s));
  const removeBlank = (subjectId, qId, blankId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, blanks: (q.blanks || []).filter(b => b.id !== blankId) } : q) } : s));

  const addPair = (subjectId, qId) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, pairs: [...(q.pairs || []), { right: '', left: '' }] } : q) } : s));
  const updatePair = (subjectId, qId, pairIndex, side, value) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, pairs: (q.pairs || []).map((p, i) => i === pairIndex ? { ...p, [side]: value } : p) } : q) } : s));
  const removePair = (subjectId, qId, pairIndex) => setSubjects((subjects || []).map(s => s.id === subjectId ? { ...s, questions: (s.questions || []).map(q => q.id === qId ? { ...q, pairs: (q.pairs || []).filter((_, i) => i !== pairIndex) } : q) } : s));
  
  const calculateSubjectTotal = (subject) => (subject.questions || []).reduce((total, q) => total + (parseInt(q.marks) || 0), 0);
  const calculateGrandTotal = () => (subjects || []).reduce((total, sub) => total + calculateSubjectTotal(sub), 0);

  // =========================================================================
  // --- EXACT ABSOLUTE FILL PACKING ENGINE ---
  // =========================================================================
  const generatePages = () => {
    const pages = [];
    let currentItems = [];
    let currentHeight = 0;
    
    const MAX_PAGE_HEIGHT = 980; 

    const pushPage = () => {
      if (currentItems.length > 0) {
        pages.push(currentItems);
        currentItems = [];
        currentHeight = 0;
      }
    };

    const estimateLinesHeight = (text) => text && text.trim().length > 0 ? Math.ceil(text.length / 80) * 30 : 0;

    subjects.forEach((sub) => {
      let subTitleHeight = 55; 
      
      let minRequiredSpace = subTitleHeight; 
      if (sub.questions.length > 0) {
          const firstQ = sub.questions[0];
          minRequiredSpace += 35 + estimateLinesHeight(firstQ.text); 
          if (firstQ.type === 'subjective' && firstQ.subQuestions?.length > 0) {
              minRequiredSpace += estimateLinesHeight(firstQ.subQuestions[0].text) + 35; 
          } else if (firstQ.type === 'fillBlanks') {
              const dynamicWordBank = (firstQ.blanks || []).map(b => b.answer).filter(a => a && a.trim() !== '');
              minRequiredSpace += (firstQ.showWordBank && dynamicWordBank.length > 0 ? 60 : 0);
              if (firstQ.blanks && firstQ.blanks.length > 0) {
                  minRequiredSpace += estimateLinesHeight(firstQ.blanks[0].text) + 35; 
              }
          } else if (firstQ.type === 'match') {
              minRequiredSpace += 38; 
          }
      }

      if (currentHeight + minRequiredSpace > MAX_PAGE_HEIGHT) pushPage();
      
      currentItems.push({ type: 'subjectHeader', data: sub });
      currentHeight += subTitleHeight;

      sub.questions.forEach((q, qIndex) => {
        let qHeaderHeight = 35 + estimateLinesHeight(q.text); 

        let nextChildReq = 0;
        if (q.type === 'subjective' && q.subQuestions?.length > 0) {
            nextChildReq = estimateLinesHeight(q.subQuestions[0].text) + 35;
        } else if (q.type === 'fillBlanks') {
            const dynamicWordBank = (q.blanks || []).map(b => b.answer).filter(a => a && a.trim() !== '');
            nextChildReq = (q.showWordBank && dynamicWordBank.length > 0 ? 60 : 0);
            if (q.blanks && q.blanks.length > 0) {
                nextChildReq += estimateLinesHeight(q.blanks[0].text) + 35;
            }
        } else if (q.type === 'match') {
            nextChildReq = 38;
        }

        if (qIndex > 0 && currentHeight + qHeaderHeight + nextChildReq > MAX_PAGE_HEIGHT) pushPage();
        
        currentItems.push({ type: 'questionHeader', data: q, qIndex });
        currentHeight += qHeaderHeight;

        if (q.type === 'subjective') {
           (q.subQuestions || []).forEach((sq, sqIndex) => {
              let totalLines = parseInt(sq.lines) || 0;
              let linesProcessed = 0;
              let isFirstChunk = true;
              let sqTextHeight = estimateLinesHeight(sq.text);
              if (sqTextHeight > 0) sqTextHeight += 15; 
              
              let lineHeight = 35; 

              while (isFirstChunk || linesProcessed < totalLines) {
                  let spaceRequiredForText = isFirstChunk ? sqTextHeight : 0;
                  let spaceLeft = MAX_PAGE_HEIGHT - currentHeight - spaceRequiredForText;

                  if (spaceLeft < 0 || (spaceLeft < lineHeight && totalLines > 0 && !(isFirstChunk && totalLines === 0))) {
                      pushPage();
                      continue; 
                  }

                  let linesThatFit = Math.max(0, Math.floor(spaceLeft / lineHeight));
                  let linesToTake = Math.min(linesThatFit, totalLines - linesProcessed);
                  if (totalLines === 0) linesToTake = 0;

                  currentItems.push({ type: 'subQuestionPart', data: sq, sqIndex: sqIndex, showText: isFirstChunk, lines: linesToTake });
                  currentHeight += spaceRequiredForText + (linesToTake * lineHeight);
                  linesProcessed += linesToTake;
                  isFirstChunk = false;

                  if (linesProcessed < totalLines) pushPage(); 
              }
           });
        }
        else if (q.type === 'fillBlanks') {
           const dynamicWordBank = (q.blanks || []).map(b => b.answer).filter(a => a && a.trim() !== '');
           let wordBankHeight = (q.showWordBank && dynamicWordBank.length > 0) ? 60 : 0;
           
           if (wordBankHeight > 0) {
               if (currentHeight + wordBankHeight > MAX_PAGE_HEIGHT && currentItems.length > 0) pushPage();
               currentItems.push({ type: 'wordBank', data: q });
               currentHeight += wordBankHeight;
           }

           (q.blanks || []).forEach((blank, bIndex) => {
               let blankHeight = estimateLinesHeight(blank.text) + 35; 
               if (currentHeight + blankHeight > MAX_PAGE_HEIGHT && currentItems.length > 0) pushPage();
               currentItems.push({ type: 'blankItem', data: blank, qIndex, bIndex, parentQ: q });
               currentHeight += blankHeight;
           });
        }
        else if (q.type === 'match') {
           let pairs = q.pairs || [];
           let totalPairs = pairs.length;
           let pairsProcessed = 0;
           let pairHeight = 38; 

           if (totalPairs === 0) return;

           while (pairsProcessed < totalPairs) {
               let isFirstChunk = pairsProcessed === 0;
               let spaceReq = isFirstChunk ? 10 : 0; 
               let spaceLeft = MAX_PAGE_HEIGHT - currentHeight - spaceReq;

               if (spaceLeft < pairHeight) {
                   pushPage();
                   continue;
               }

               let pairsThatFit = Math.floor(spaceLeft / pairHeight);
               let pairsToTake = Math.min(pairsThatFit, totalPairs - pairsProcessed);
               let chunkPairs = pairs.slice(pairsProcessed, pairsProcessed + pairsToTake);

               currentItems.push({ type: 'matchPart', data: q, pairs: chunkPairs, startIndex: pairsProcessed });
               currentHeight += spaceReq + (pairsToTake * pairHeight);
               pairsProcessed += pairsToTake;

               if (pairsProcessed < totalPairs) pushPage(); 
           }
        }
      });
    });

    pushPage();
    return pages;
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
        <div className="p-4 md:p-6 flex-grow">
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

          <div className="max-w-5xl mx-auto w-full">
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
                    <h3 className="text-lg font-bold mb-1 font-arabic text-gray-800 leading-tight" dir="rtl">{paper.header?.examName || 'Untitled'} {toArabicNumerals(paper.header?.hijriYear || '1447')}هـ</h3>
                    <p className="text-gray-500 text-xs mb-3 font-serif font-medium">{paper.header?.paperNumber || ''}</p>
                    <p className="text-xs text-gray-400 font-medium">Subjects: {paper.subjects?.length || 0}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="sticky top-0 z-40 bg-gray-100 pt-4 px-4 pb-2 print:hidden">
            <nav className="bg-white px-4 py-2.5 rounded-lg shadow-sm border border-gray-200 flex justify-between items-center max-w-4xl mx-auto w-full">
              <button onClick={() => setAppState('dashboard')} className="text-gray-500 hover:text-gray-800 font-medium text-sm px-2 py-1 rounded transition">← Dashboard</button>
              
              <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                <button onClick={() => setAppState('editor')} className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${appState === 'editor' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Editor</button>
                <button onClick={() => setAppState('preview')} className={`px-5 py-1.5 rounded-md text-sm font-bold transition-all ${appState === 'preview' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>Preview</button>
              </div>

              <div className="flex gap-3 items-center">
                {appState === 'editor' && ( <button onClick={() => savePaperToCloud()} disabled={isSaving} className="bg-blue-600 text-white px-4 py-1.5 rounded-md hover:bg-blue-700 transition font-bold text-sm disabled:opacity-50">{isSaving ? 'Saving...' : 'Save'}</button> )}
                {appState === 'preview' && ( <button onClick={handlePrint} className="bg-gray-800 text-white px-4 py-1.5 rounded-md hover:bg-black transition font-bold text-sm font-sans flex items-center gap-2"><span>🖨️</span> Print PDF</button> )}
              </div>
            </nav>
          </div>

          <div className="flex-grow p-4 print:p-0">
          {appState === 'preview' ? (
            <div className="print:m-0 print:w-full">
              
              {/* ---- PAGE 1: COVER PAGE ---- */}
              <div className="a4-wrapper print:block">
                <div className="a4-sheet text-xl" dir="rtl">
                  <div className={`text-center flex flex-col items-center pt-6 ${cpMargin}`}>
                    {schoolSettings?.logo && ( <img src={schoolSettings.logo} alt="School Logo" className={`${isDense ? 'h-20' : 'h-28'} object-contain mb-3`} /> )}
                    <h2 className={`${isDense ? 'text-3xl' : 'text-4xl'} font-bold font-arabic mb-4`}>{schoolSettings?.nameAr || 'المجمع المركزي للتربية والتعليم'}</h2>
                    <h3 className={`${isDense ? 'text-2xl' : 'text-3xl'} font-bold font-arabic mb-6`}>{paperData?.examName || ''} {toArabicNumerals(paperData?.hijriYear || '1447')}هـ</h3>
                    <h3 className={`${isDense ? 'text-xl' : 'text-2xl'} font-bold font-arabic mb-6`}>{paperData?.className || ''}</h3>
                  </div>
                  
                  <div className="max-w-3xl mx-auto w-full flex-grow">
                    <div className="flex justify-between items-end mb-4 font-bold text-base border-b-2 border-black pb-2">
                       <span className="font-arabic text-xl">{paperData?.className || ''}</span>
                       <span className="font-sans text-base">{paperData?.paperNumber || ''}</span>
                       <span className="font-sans text-base font-medium" dir="ltr">Time: {paperData?.time || ''}</span>
                    </div>
                    
                    <table className={`w-full border-collapse border border-black ${cpMargin} font-arabic ${cpText}`}>
                      <tbody>
                        <tr>
                          <td className={`border border-black ${cpPadding} w-[15%] font-bold`}>نام:</td>
                          <td className={`border border-black ${cpPadding} w-[35%]`}></td>
                          <td className={`border border-black ${cpPadding} w-[15%] font-sans font-bold text-left text-sm`} dir="ltr">ITS NO:</td>
                          <td className={`border border-black ${cpPadding} w-[35%]`}></td>
                        </tr>
                        <tr>
                          <td className={`border border-black ${cpPadding} font-sans font-bold text-left text-sm`} dir="ltr">ROLL NO:</td>
                          <td className={`border border-black ${cpPadding}`}></td>
                          <td className={`border border-black ${cpPadding} bg-gray-100`} colSpan="2"></td>
                        </tr>
                      </tbody>
                    </table>
                    
                    <table className={`w-full mx-auto border-collapse border border-black text-center font-bold font-arabic ${cpText}`}>
                      <thead><tr className="bg-gray-100"><th className={`border border-black ${cpPadding} w-16`}>رقم</th><th className={`border border-black ${cpPadding}`}>المواضيع</th><th className={`border border-black ${cpPadding} w-24`}>ماركس</th><th className={`border border-black ${cpPadding} w-32`}>المحصول</th></tr></thead>
                      <tbody>
                        {(subjects || []).map((sub, index) => (<tr key={sub.id}><td className={`border border-black ${cpPadding} font-arabic`}>{toArabicNumerals(index + 1)}</td><td className={`border border-black ${cpPadding} text-right pr-4`}>{sub.title}</td><td className={`border border-black ${cpPadding} font-arabic`}>{toArabicNumerals(calculateSubjectTotal(sub))}</td><td className={`border border-black ${cpPadding}`}></td></tr>))}
                        <tr className="bg-gray-50"><td className={`border border-black ${cpPadding}`} colSpan="2">جملة</td><td className={`border border-black ${cpPadding} font-arabic`}>{toArabicNumerals(calculateGrandTotal())}</td><td className={`border border-black ${cpPadding}`}></td></tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="absolute bottom-[15mm] left-0 right-0 text-center text-gray-500 font-arabic text-lg font-bold">
                      {toArabicNumerals(1)}
                  </div>
                </div>
              </div>

              {/* ---- PAGE 2+: DYNAMIC MICRO-SLICED PAGES ---- */}
              {generatePages().map((pageItems, pageIndex) => (
                <div key={`page-${pageIndex}`} className="a4-wrapper print:block">
                  <div className="a4-sheet text-xl" dir="rtl">
                    
                    <div className="flex justify-between items-center border-b-2 border-black pb-2 mb-6 text-lg font-bold text-gray-800 font-arabic">
                       <span>{paperData?.className || ''}</span>
                       <span className="font-arabic">{paperData?.examName || ''} {toArabicNumerals(paperData?.hijriYear || '1447')}هـ</span>
                    </div>
                    
                    <div className="flex-grow pt-2">
                      {pageItems.map((item, idx) => {
                        
                        if (item.type === 'subjectHeader') {
                          return (
                            <div key={idx} className="flex justify-between items-center bg-gray-100 p-2 mb-4 font-bold text-xl border-y border-black font-arabic print:bg-gray-100 print:color-adjust-exact">
                              <span>{item.data.title}</span>
                              <span className="font-arabic text-xl">{toArabicNumerals(calculateSubjectTotal(item.data))}</span>
                            </div>
                          );
                        }

                        if (item.type === 'questionHeader') {
                          const q = item.data;
                          return (
                            <div key={idx} className="flex justify-between items-start mb-2 font-arabic">
                              <div className="flex gap-2 w-11/12">
                                <span className="font-bold text-xl font-arabic">{toArabicNumerals(item.qIndex + 1)}.</span>
                                <p className="leading-relaxed text-xl font-bold font-arabic">{q.text}</p>
                              </div>
                              <div className="w-1/12 text-center font-bold border border-black px-1 py-1 rounded text-lg font-arabic">
                                {toArabicNumerals(q.marks)}
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'subQuestionPart') {
                          const sq = item.data;
                          const i = item.sqIndex;
                          return (
                            <div key={idx} className="mb-4 px-4 font-arabic">
                              {item.showText && sq.text && sq.text.trim() !== '' && (
                                <div className="flex gap-2 items-start">
                                  <span className="font-bold text-xl ml-2 font-arabic">{ABJAD_LETTERS[i] || '-'}</span>
                                  <p className="font-bold text-xl leading-relaxed font-arabic">{sq.text}</p>
                                </div>
                              )}
                              <div className={item.showText && sq.text ? "mt-4" : "mt-0"}>
                                {[...Array(parseInt(item.lines) || 0)].map((_, j) => (
                                  <div key={j} className="border-b-2 border-dotted border-gray-500 mt-8"></div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        if (item.type === 'wordBank') {
                          const q = item.data;
                          const dynamicWordBank = [...(q.blanks || [])]
                              .map(b => b.answer)
                              .filter(a => a && a.trim() !== '')
                              .sort((a, b) => a.localeCompare(b, 'ar'));

                          return (
                            <div key={idx} className="mb-4 px-4 font-arabic">
                               <div className="border-2 border-black p-3 flex flex-wrap gap-4 justify-center text-xl rounded bg-gray-50 print:bg-gray-50 print:color-adjust-exact">
                                 {dynamicWordBank.map((word, i) => ( <span key={i} className="px-2 font-arabic">{word.trim()}</span> ))}
                               </div>
                            </div>
                          );
                        }

                        if (item.type === 'blankItem') {
                          const b = item.data;
                          return (
                            <div key={idx} className="mb-3 px-4 font-arabic">
                              <p className="leading-[2.5rem] text-xl whitespace-pre-wrap font-arabic">
                                <span className="font-bold text-xl ml-2 font-arabic text-gray-800">{toArabicNumerals(item.bIndex + 1)}.</span>
                                {(b.text || '').split('*').map((part, i, arr) => (
                                  <span key={i}>
                                    {part}
                                    {i !== arr.length - 1 && (<span className="inline-block w-28 border-b-2 border-black mx-2 translate-y-2"></span>)}
                                  </span>
                                ))}
                              </p>
                            </div>
                          );
                        }

                        if (item.type === 'matchPart') {
                          const q = item.data;
                          const pairs = item.pairs || [];
                          const startIndex = item.startIndex || 0;
                          const totalPairs = (q.pairs || []).length;

                          return (
                            <div key={idx} className="mb-4 px-2 font-arabic">
                              <table className="w-full border-collapse border border-black text-center text-lg font-arabic">
                                <tbody>
                                  {pairs.map((pair, i) => {
                                    const globalIndex = startIndex + i;
                                    const jumbledIndex = totalPairs > 0 ? (globalIndex + 1) % totalPairs : 0;
                                    return (
                                      <tr key={i}>
                                        <td className="border border-black p-1.5 text-right pr-4 leading-relaxed w-5/12 font-arabic"><span className="ml-2 font-bold">{toArabicNumerals(globalIndex + 1)}.</span> {pair.right}</td>
                                        <td className="border border-black p-1.5 text-center text-gray-400 font-sans text-base w-2/12">[ &nbsp;&nbsp;&nbsp; ]</td>
                                        <td className="border border-black p-1.5 text-right pr-4 leading-relaxed w-5/12 font-arabic">{(q.pairs || [])[jumbledIndex]?.left}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        }
                      })}
                    </div>

                    <div className="absolute bottom-[15mm] left-0 right-0 text-center text-gray-500 font-arabic text-lg font-bold">
                        {toArabicNumerals(pageIndex + 2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

          ) : (

            /* ================= EDITOR HTML ================= */
            <div className="max-w-4xl mx-auto space-y-6 print:hidden flex-grow">
              
              {/* BEAUTIFUL SAVE ALERT */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md shadow-sm flex items-start">
                  <span className="text-blue-500 text-xl mr-3">💾</span>
                  <div>
                      <p className="text-sm text-blue-800 font-bold">Save Your Work Frequently!</p>
                      <p className="text-xs text-blue-600 mt-1">Please remember to click the Save button above. Any unsaved progress will be lost if you refresh, close the tab, or return to the dashboard.</p>
                  </div>
              </div>
              
              <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200">
                <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Paper Details</h2>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="col-span-2 md:col-span-1">
                    <label className="block mb-1 font-bold text-xs text-gray-600">Class (Darajah)</label>
                    <select name="className" value={paperData?.className || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl">
                      {DARAJAH_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block mb-1 font-bold text-xs text-gray-600">Exam Name (Arabic)</label>
                    <input type="text" name="examName" value={paperData?.examName || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-arabic text-lg" dir="rtl" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="block mb-1 font-bold text-xs text-gray-600">Hijri Year</label>
                    <input type="number" name="hijriYear" value={paperData?.hijriYear || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-sans text-lg" dir="ltr" />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label className="block mb-1 font-bold text-xs text-gray-600">Paper No.</label>
                    <input type="text" name="paperNumber" value={paperData?.paperNumber || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-sans text-sm" />
                  </div>
                  <div className="col-span-1 md:col-span-1">
                    <label className="block mb-1 font-bold text-xs text-gray-600">Duration</label>
                    <select name="time" value={paperData?.time || ''} onChange={handleInputChange} className="w-full border border-gray-300 p-2 rounded-md font-sans text-sm">
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
                            <div className="flex border border-gray-300 rounded-md overflow-hidden bg-white w-full sm:w-24">
                              <button onClick={() => updateQuestion(subject.id, q.id, 'marks', Math.max(0, (parseInt(q.marks) || 0) - 1))} className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-r border-gray-300 transition">-</button>
                              <input type="number" value={q.marks || 0} onChange={(e) => updateQuestion(subject.id, q.id, 'marks', e.target.value)} className="w-full text-center p-1.5 font-sans text-sm outline-none" />
                              <button onClick={() => updateQuestion(subject.id, q.id, 'marks', (parseInt(q.marks) || 0) + 1)} className="px-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-l border-gray-300 transition">+</button>
                            </div>
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
                                   <div className="flex border border-gray-300 rounded-md overflow-hidden bg-white w-full sm:w-20">
                                      <button onClick={() => updateSubQuestion(subject.id, q.id, sq.id, 'lines', Math.max(0, (parseInt(sq.lines) || 0) - 1))} className="px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-r border-gray-300 transition">-</button>
                                      <input type="number" value={sq.lines || 0} onChange={(e) => updateSubQuestion(subject.id, q.id, sq.id, 'lines', e.target.value)} className="w-full text-center p-1 font-sans text-sm outline-none" />
                                      <button onClick={() => updateSubQuestion(subject.id, q.id, sq.id, 'lines', (parseInt(sq.lines) || 0) + 1)} className="px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold border-l border-gray-300 transition">+</button>
                                   </div>
                                 </div>
                                 {((q.subQuestions || []).length > 1) && <button onClick={() => removeSubQuestion(subject.id, q.id, sq.id)} className="text-red-500 text-xs font-medium md:mt-4 hover:underline">Drop</button>}
                              </div>
                            </div>
                          ))}
                          <button onClick={() => addSubQuestion(subject.id, q.id)} className="text-xs bg-green-50 text-green-700 px-3 py-1.5 rounded-md font-bold border border-green-200 hover:bg-green-100 transition">+ Sub-Question</button>
                        </div> 
                      )}

                      {/* --- CONDITIONAL UI FILL IN THE BLANKS EDITOR --- */}
                      {q.type === 'fillBlanks' && ( 
                        <div className="border-t border-gray-200 pt-3">
                          <p className="text-xs text-blue-600 mb-3 font-medium">ℹ️ Type your sentence. Type a SINGLE asterisk (*) to insert a blank line.</p>
                          
                          <div className="flex items-center gap-2 mb-4">
                             <input type="checkbox" id={`wb-${q.id}`} checked={q.showWordBank !== false} onChange={(e) => updateQuestion(subject.id, q.id, 'showWordBank', e.target.checked)} className="w-3.5 h-3.5 cursor-pointer" />
                             <label htmlFor={`wb-${q.id}`} className="font-bold text-xs text-gray-700 cursor-pointer">Auto-Generate Word Bank at the top</label>
                          </div>
                          
                          <div className="space-y-2">
                            {(q.blanks || [{ id: q.id, text: '', answer: '' }]).map((blank, bIndex) => (
                              <div key={blank.id} className="flex gap-2 items-center bg-white p-2 border border-gray-200 rounded-md shadow-sm flex-wrap sm:flex-nowrap">
                                <span className="font-bold font-arabic text-gray-400 text-xl w-[5%]">{toArabicNumerals(bIndex + 1)}.</span>
                                
                                <input type="text" value={blank.text || ''} onChange={(e) => updateBlank(subject.id, q.id, blank.id, 'text', e.target.value)} placeholder="وَيَطُوفُ عَلَيْهِمْ وِلْدَانٌ *" className={`${q.showWordBank !== false ? 'w-[85%] sm:w-[60%]' : 'w-[85%] sm:w-[85%]'} border border-gray-300 p-1.5 rounded-md font-arabic text-lg focus:border-indigo-400 transition-all`} dir="rtl" />
                                
                                {/* CONDITIONAL ANSWER BOX */}
                                {q.showWordBank !== false && (
                                  <input type="text" value={blank.answer || ''} onChange={(e) => updateBlank(subject.id, q.id, blank.id, 'answer', e.target.value)} placeholder="Answer (Word Bank)" className="w-full sm:w-[25%] mt-2 sm:mt-0 border border-green-300 bg-green-50 p-1.5 rounded-md font-arabic text-lg focus:border-green-500" dir="rtl" />
                                )}
                                
                                <button onClick={() => removeBlank(subject.id, q.id, blank.id)} className="w-[10%] text-red-400 font-bold text-lg hover:text-red-600">×</button>
                              </div>
                            ))}
                          </div>
                          <button onClick={() => addBlank(subject.id, q.id)} className="mt-3 text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-md font-bold border border-purple-200 hover:bg-purple-100 transition">+ Add Blank Sentence</button>
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