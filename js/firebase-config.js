/* ============================================
   Firebase & Cloudinary Configuration
   এখানে আপনার নিজের Firebase Project ও Cloudinary
   Account-এর তথ্য বসান (Setup Instructions দ্রষ্টব্য)
   ============================================ */

// 🔑 Firebase Console → Project Settings → General → Your apps থেকে কপি করুন
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

// Offline persistence (better experience on slow connections)
db.enablePersistence({ synchronizeTabs: true }).catch(() => {
  // Multiple tabs open বা browser support না থাকলে silently skip
});

// 🖼️ Cloudinary Console → Dashboard থেকে Cloud Name নিন
// এবং Settings → Upload → Add Upload Preset (Signing Mode: Unsigned) থেকে Preset তৈরি করুন
const cloudinaryConfig = {
  cloudName: "dbrrxrbb9",
  uploadPreset: "daraz_products"
};

// 📢 আপনার Telegram Channel Link
const TELEGRAM_LINK = "https://t.me/YOUR_CHANNEL";
