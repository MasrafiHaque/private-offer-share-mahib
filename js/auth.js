/* ============================================
   Authentication (Email + Phone)
   ============================================ */

let currentUser = null;
let pendingBuyProduct = null; // Login শেষে যে প্রোডাক্টে Redirect করতে হবে

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  updateAuthUI();

  if (user) {
    // Ensure user document exists (first-time social/phone login guard)
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        name: user.displayName || user.email || user.phoneNumber || "User",
        email: user.email || null,
        phone: user.phoneNumber || null,
        role: "user",
        status: "active",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
      trackEvent("registration");
    } else {
      await ref.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
      if (snap.data().status === "banned") {
        showToast("আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে।", "error");
        auth.signOut();
        return;
      }
    }

    // যদি Login করা হয়েছে Buy Now থেকে redirect করার জন্য
    if (pendingBuyProduct) {
      const link = pendingBuyProduct;
      pendingBuyProduct = null;
      closeAuthModal();
      window.open(link, "_blank");
    } else {
      closeAuthModal();
    }
  }
});

function updateAuthUI() {
  const loginBtn = document.getElementById("loginBtnHeader");
  const userBtn = document.getElementById("userBtnHeader");
  if (!loginBtn || !userBtn) return;
  if (currentUser) {
    loginBtn.style.display = "none";
    userBtn.style.display = "flex";
    userBtn.title = currentUser.email || currentUser.phoneNumber || "";
  } else {
    loginBtn.style.display = "flex";
    userBtn.style.display = "none";
  }
}

/* ---------- Modal open/close ---------- */
function openAuthModal(mode = "login") {
  document.getElementById("authModalOverlay").classList.add("active");
  setAuthTab(mode);
}
function closeAuthModal() {
  document.getElementById("authModalOverlay").classList.remove("active");
  document.getElementById("authError").textContent = "";
}
function setAuthTab(mode) {
  document.querySelectorAll(".auth-tab").forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  document.getElementById("authForm").dataset.mode = mode;
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "লগইন করুন" : "Sign Up করুন";
  document.getElementById("nameField").style.display = mode === "signup" ? "block" : "none";
}
function setAuthMethod(method) {
  document.querySelectorAll(".auth-method-switch button").forEach((b) => b.classList.toggle("active", b.dataset.method === method));
  document.getElementById("authForm").dataset.method = method;
  document.getElementById("emailField").style.display = method === "email" ? "block" : "none";
  document.getElementById("passwordField").style.display = method === "email" ? "block" : "none";
  document.getElementById("phoneField").style.display = method === "phone" ? "block" : "none";
  document.getElementById("otpField").style.display = "none";
}

/* ---------- Buy Now gate ---------- */
function requireAuthThenRedirect(affiliateLink, productId) {
  if (currentUser) {
    trackBuyClick(productId);
    window.open(affiliateLink, "_blank");
  } else {
    pendingBuyProduct = affiliateLink;
    openAuthModal("login");
    showToast("কিনতে হলে আগে Login করুন", "error");
  }
}

/* ---------- Form submit ---------- */
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("authForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const mode = form.dataset.mode;
    const method = form.dataset.method;
    const errorEl = document.getElementById("authError");
    errorEl.textContent = "";

    try {
      if (method === "email") {
        const email = document.getElementById("emailInput").value.trim();
        const password = document.getElementById("passwordInput").value;
        if (mode === "signup") {
          const name = document.getElementById("nameInput").value.trim();
          const cred = await auth.createUserWithEmailAndPassword(email, password);
          await db.collection("users").doc(cred.user.uid).set({
            name: name || email,
            email,
            phone: null,
            role: "user",
            status: "active",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });
          showToast("অ্যাকাউন্ট তৈরি হয়েছে!");
        } else {
          await auth.signInWithEmailAndPassword(email, password);
          showToast("সফলভাবে লগইন হয়েছে!");
        }
      } else if (method === "phone") {
        await handlePhoneAuth();
        return; // OTP flow handles its own UI
      }
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
    }
  });
});

/* ---------- Phone Auth (OTP) ---------- */
let confirmationResult = null;

function ensureRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier("recaptcha-container", {
      size: "invisible"
    });
  }
}

async function handlePhoneAuth() {
  const errorEl = document.getElementById("authError");
  const otpField = document.getElementById("otpField");

  if (otpField.style.display === "block") {
    // Step 2: verify code
    const code = document.getElementById("otpInput").value.trim();
    try {
      await confirmationResult.confirm(code);
      showToast("সফলভাবে লগইন হয়েছে!");
    } catch (err) {
      errorEl.textContent = "OTP সঠিক নয়, আবার চেষ্টা করুন।";
    }
    return;
  }

  // Step 1: send code
  const phone = document.getElementById("phoneInput").value.trim();
  if (!phone.startsWith("+")) {
    errorEl.textContent = "ফোন নম্বর অবশ্যই Country Code সহ দিন, যেমন +8801XXXXXXXXX";
    return;
  }
  try {
    ensureRecaptcha();
    confirmationResult = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
    otpField.style.display = "block";
    document.getElementById("authSubmitBtn").textContent = "OTP Verify করুন";
    showToast("OTP পাঠানো হয়েছে");
  } catch (err) {
    errorEl.textContent = friendlyAuthError(err.code);
  }
}

function friendlyAuthError(code) {
  const map = {
    "auth/email-already-in-use": "এই Email দিয়ে আগে থেকেই অ্যাকাউন্ট আছে।",
    "auth/invalid-email": "সঠিক Email দিন।",
    "auth/weak-password": "Password কমপক্ষে ৬ অক্ষরের হতে হবে।",
    "auth/wrong-password": "Password সঠিক নয়।",
    "auth/user-not-found": "এই Email দিয়ে কোনো অ্যাকাউন্ট নেই।",
    "auth/invalid-phone-number": "ফোন নম্বর সঠিক নয়।",
    "auth/too-many-requests": "অনেকবার চেষ্টা করা হয়েছে, একটু পর আবার চেষ্টা করুন।"
  };
  return map[code] || "কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন।";
}

function logout() {
  auth.signOut();
  showToast("লগআউট হয়েছে");
}
