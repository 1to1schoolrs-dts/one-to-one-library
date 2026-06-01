// Firebase Configuration - One to One Library
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

// Collections
const USERS_COL = "users";
const EBOOKS_COL = "ebooks";
const BOOKLIST_COL = "booklist";
const PERSONAL_COL = "personal_books";
const ORDERS_COL = "orders";
const BORROW_COL = "borrows";
const SETTINGS_COL = "settings";
