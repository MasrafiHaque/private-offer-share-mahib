/* ============================================
   Firebase & Cloudinary Configuration
   এখানে আপনার নিজের Firebase Project ও Cloudinary
   Account-এর তথ্য বসান (Setup Instructions দ্রষ্টব্য)
   ============================================ */

// 🔑 Firebase Console → Project Settings → General → Your apps থেকে কপি করুন
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
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
  cloudName: "YOUR_CLOUD_NAME",
  uploadPreset: "daraz_products"
};

// 📢 আপনার Telegram Channel Link
const TELEGRAM_LINK = "https://t.me/YOUR_CHANNEL";
