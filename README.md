# Private Offer Share — Daraz Affiliate Marketing Website

সম্পূর্ণ Plain HTML, CSS, JavaScript দিয়ে তৈরি (কোনো Framework/Build Tool ছাড়া)। Backend: Firebase (Auth + Firestore + Hosting), Image Storage: Cloudinary।

---

## 📁 ফাইল স্ট্রাকচার

```
daraz-affiliate/
├── index.html              # Main Website (Customer facing)
├── admin.html               # Admin Panel (সম্পূর্ণ Self-contained)
├── css/style.css            # Main Site স্টাইল (Dark/Light Theme)
├── js/
│   ├── firebase-config.js   # Firebase + Cloudinary Config (আপনাকে পূরণ করতে হবে)
│   ├── utils.js              # Helper functions
│   ├── auth.js                # Email/Phone Login+Signup
│   ├── analytics.js          # Visit/Click Tracking
│   └── main.js                # Product Grid, Telegram Popup, Search
├── assets/images/            # Placeholder SVG ছবি
├── firestore.rules           # Database Security Rules
├── firestore.indexes.json    # Composite Indexes
└── firebase.json             # Hosting Config
```

---

## 🚀 ধাপে ধাপে Setup

### ১. Firebase Project তৈরি করুন
1. https://console.firebase.google.com → **Add Project** → নাম দিন (যেমন: dealnest)
2. Project তৈরি হয়ে গেলে **Project Settings → General → Your apps → Web (</>)** আইকনে ক্লিক করে একটা Web App যোগ করুন
3. যে `firebaseConfig` অবজেক্টটা দেখাবে সেটা কপি করে `js/firebase-config.js` ফাইলে বসিয়ে দিন

### ২. Authentication চালু করুন
1. Firebase Console → **Build → Authentication → Get Started**
2. **Sign-in method** ট্যাবে গিয়ে:
   - **Email/Password** চালু করুন
   - **Phone** চালু করুন
3. Phone Auth সঠিকভাবে কাজ করার জন্য Firebase Console-এ আপনার Domain (যেমন: yourproject.web.app) **Authorized Domains**-এ যোগ করা আছে কিনা দেখে নিন

### ৩. Firestore Database তৈরি করুন
1. **Build → Firestore Database → Create Database**
2. **Production mode** সিলেক্ট করুন (আমাদের নিজস্ব Rules আছে)
3. Location হিসেবে আপনার কাছাকাছি একটা Region বাছাই করুন

### ৪. Firebase CLI Install ও Deploy
```bash
npm install -g firebase-tools
firebase login
cd daraz-affiliate
firebase init
# Hosting এবং Firestore সিলেক্ট করুন, Existing Project বাছাই করুন
firebase deploy
```
এতে Website Live হয়ে যাবে এবং Rules/Indexes ও Deploy হবে।

### ৫. Cloudinary Setup (Image Upload-এর জন্য)
1. https://cloudinary.com → Free Account তৈরি করুন
2. Dashboard থেকে **Cloud Name** কপি করুন
3. **Settings → Upload → Upload presets → Add upload preset**
   - Preset name: `daraz_products`
   - Signing Mode: **Unsigned**
   - Save করুন
4. `js/firebase-config.js` ফাইলে `cloudinaryConfig` অবজেক্টে Cloud Name ও Preset বসান

### ৬. প্রথম Admin User তৈরি করুন
1. Website Deploy হওয়ার পর `admin.html` খুলুন (যেমন: `https://yourproject.web.app/admin.html`)
2. Email ও Password দিয়ে **"প্রথমবার? নিজেকে Admin বানান"** বাটনে ক্লিক করুন
3. এটা স্বয়ংক্রিয়ভাবে আপনাকে Admin বানিয়ে দেবে — এরপর সরাসরি Login করতে পারবেন

### ৭. Telegram Link যোগ করুন
- `js/firebase-config.js` ফাইলে `TELEGRAM_LINK` ভ্যারিয়েবলে আপনার Channel Link বসান
- অথবা Admin Panel → Settings থেকেও Telegram Link পরিবর্তন করা যাবে

---

## ✅ Testing Checklist

```
☐ Website খুললে Telegram Popup আসছে (২-৩ সেকেন্ড পর)
☐ Popup Close করলে আবার Reload করলে দেখাচ্ছে না
☐ Login ছাড়া Product দেখা যাচ্ছে
☐ Buy Now চাপলে Login Prompt আসছে
☐ Email দিয়ে Sign Up/Login কাজ করছে
☐ Phone দিয়ে Sign Up/Login কাজ করছে (reCAPTCHA দেখাচ্ছে)
☐ Login করার পর Buy Now চাপলে সরাসরি Affiliate Link-এ যাচ্ছে
☐ Dark/Light Mode Toggle কাজ করছে এবং Reload-এ মনে থাকছে
☐ Search ও Category Filter কাজ করছে
☐ admin.html-এ Login করা যাচ্ছে (শুধু Admin Role)
☐ Admin Panel-এ Product Add/Edit/Delete কাজ করছে
☐ Cloudinary Image Upload কাজ করছে
☐ Category Add/Edit/Delete কাজ করছে
☐ User List দেখাচ্ছে, Ban/Unban কাজ করছে
☐ Dashboard-এ সঠিক Stats দেখাচ্ছে
☐ Analytics Charts দেখাচ্ছে
☐ Settings Save হচ্ছে
```

---

## ⚠️ গুরুত্বপূর্ণ নোট

- `js/firebase-config.js` ফাইলে আপনার আসল Firebase ও Cloudinary তথ্য না বসানো পর্যন্ত Website কাজ করবে না (Console-এ Error দেখাবে)
- প্রথম Product Add করার পর Firestore একটা Composite Index চাইতে পারে — Console-এ যে Error Link আসবে সেটায় ক্লিক করে ১-২ মিনিটের মধ্যে Index তৈরি করে নিন (যদিও `firestore.indexes.json` দিয়ে Deploy করলে আগে থেকেই তৈরি থাকবে)
- Firestore Rules কখনো Open (`allow read, write: if true`) করবেন না — উপরের `firestore.rules` ফাইলটাই ব্যবহার করুন
