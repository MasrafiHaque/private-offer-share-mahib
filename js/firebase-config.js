/* ============================================
   Firebase & Cloudinary Configuration
   ============================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDnM5m1qtBenYl0e6oZDnCI7ZLqBmI9WwM",
  authDomain: "daraz-affiliate-36b5f.firebaseapp.com",
  projectId: "daraz-affiliate-36b5f",
  storageBucket: "daraz-affiliate-36b5f.firebasestorage.app",
  messagingSenderId: "226784335507",
  appId: "1:226784335507:web:95a2c8af248c94b7bc5f66",
  measurementId: "G-BNL93LBRH2"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

const cloudinaryConfig = {
  cloudName: "dbrrxrbb9",
  uploadPreset: "daraz_products"
};

const TELEGRAM_LINK = "https://t.me/YOUR_CHANNEL";