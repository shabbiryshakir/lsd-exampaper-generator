import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from "firebase/firestore";
// NEW: Import Authentication tools
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  // KEEP YOUR EXISTING KEYS HERE!
  apiKey: "AIzaSyDe0Qm6X4co1QspnmzcJkh_mtrDkX-bM8s",
  authDomain: "imani-paper-generator.firebaseapp.com",
  projectId: "imani-paper-generator",
  storageBucket: "imani-paper-generator.firebasestorage.app",
  messagingSenderId: "54707371279",
  appId: "1:54707371279:web:532e1c721d23b6e652927a",
  measurementId: "G-RCFZ69QGH0"
};

const app = initializeApp(firebaseConfig);

// Keep a copy of the teacher's papers on the device so the app works offline;
// changes made offline are uploaded automatically when the connection returns.
let firestore;
try {
  firestore = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  firestore = getFirestore(app);
}
export const db = firestore;

// NEW: Export Auth tools
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();