const firebaseConfig = {
  apiKey: "AIzaSyAJu6xcxKeE03xAfhZC69SljlBedbwAsIM",
  authDomain: "one-to-one-library.firebaseapp.com",
  projectId: "one-to-one-library",
  storageBucket: "one-to-one-library.firebasestorage.app",
  messagingSenderId: "841461847752",
  appId: "1:841461847752:web:ed8a94f2910719908e77fd",
  measurementId: "G-B1W6BX07S0"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const USERS_COL='users', EBOOKS_COL='ebooks', PERSONAL_COL='personal_books';
const ORDERS_COL='orders', BORROW_COL='borrows', SETTINGS_COL='settings';
const NOTIF_COL='notifications', COMPLAINTS_COL='complaints', DEMANDS_COL='demands';

// ডিফল্ট ক্যাটাগরি — অ্যাডমিন প্যানেল থেকে এডিট/নতুন যোগ করা যাবে, Firestore settings.categories এ সেভ হবে
const DEFAULT_CATEGORIES = [
  'আকিদা','আত্মউন্নয়ন','অর্থনীতি','একাডেমিক',
  'কুরআন','চিকিৎসা','জীবনী','তথ্য-প্রযুক্তি','তাফসির',
  'দর্শন','নারী','ফিকহ','বিজ্ঞান','রাজনীতি',
  'সাহিত্য','সিরাত','হাদীস','ইতিহাস','উসুল',
  'ভ্রমণ','শিশু-কিশোর','অন্যান্য'
];

// গ্লোবাল CATEGORIES — অ্যাপ চালু হওয়ার সময় Firestore থেকে লোড হবে (app.js এ)
let CATEGORIES = ['সব ক্যাটাগরি', ...DEFAULT_CATEGORIES];

async function loadCategoriesFromDB() {
  try {
    const doc = await db.collection(SETTINGS_COL).doc('config').get();
    const saved = doc.exists ? doc.data().categories : null;
    const list = (saved && saved.length) ? saved : DEFAULT_CATEGORIES;
    CATEGORIES = ['সব ক্যাটাগরি', ...list.slice().sort((a,b)=>a.localeCompare(b,'bn'))];
  } catch(e) {
    CATEGORIES = ['সব ক্যাটাগরি', ...DEFAULT_CATEGORIES];
  }
}
