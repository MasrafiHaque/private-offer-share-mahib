/* ============================================
   Authentication (Email + Phone)
   (Updated: COD Order Flow FIXED)
   ============================================ */

let currentUser = null;
let pendingBuyProduct = null;
let pendingCODSource = null;
let currentCODProduct = null; // COD প্রোডাক্ট ডাটা স্টোর

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  updateAuthUI();

  if (user) {
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

    if (pendingBuyProduct) {
      const link = pendingBuyProduct;
      pendingBuyProduct = null;
      closeAuthModal();
      window.open(link, "_blank");
    } else if (pendingCODSource) {
      const codData = pendingCODSource;
      pendingCODSource = null;
      closeAuthModal();
      openCODModal(codData.product);
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
function requireAuthThenRedirect(affiliateLink, productId, source) {
  if (currentUser) {
    trackBuyClick(productId, source);
    window.open(affiliateLink, "_blank");
  } else {
    pendingBuyProduct = affiliateLink;
    openAuthModal("login");
    showToast("কিনতে হলে আগে Login করুন", "error");
  }
}

/* ---------- COD Order gate ---------- */
function requireAuthForCOD(productId, productName, productPrice, source) {
  const productData = { id: productId, name: productName, price: productPrice, source: source };
  
  if (currentUser) {
    openCODModal(productData);
  } else {
    pendingCODSource = { product: productData };
    openAuthModal("login");
    showToast("অর্ডার করতে হলে আগে Login করুন", "error");
  }
}

/* ---------- COD Modal ---------- */
function openCODModal(product) {
  currentCODProduct = product;
  
  document.getElementById("codProductName").textContent = product.name;
  document.getElementById("codProductPrice").textContent = formatPrice(product.price);
  
  // Reset form
  document.getElementById("codOrderForm").reset();
  document.getElementById("codName").value = "";
  document.getElementById("codPhone").value = "";
  document.getElementById("codAddress").value = "";
  document.getElementById("codQuantity").value = "1";
  
  document.getElementById("codModalOverlay").classList.add("active");
  
  // ইউজারের নাম ও ফোন অটো-ফিল
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).get().then((doc) => {
      if (doc.exists) {
        const data = doc.data();
        if (data.name && !document.getElementById("codName").value) {
          document.getElementById("codName").value = data.name;
        }
        if (data.phone && !document.getElementById("codPhone").value) {
          document.getElementById("codPhone").value = data.phone;
        }
      }
    }).catch(() => {});
  }
}

function closeCodModal() {
  document.getElementById("codModalOverlay").classList.remove("active");
  currentCODProduct = null;
}

/* ---------- COD Order Form Submit ---------- */
function submitCODOrder(e) {
  e.preventDefault();
  
  if (!currentCODProduct) {
    showToast("প্রোডাক্ট তথ্য পাওয়া যায়নি, আবার চেষ্টা করুন।", "error");
    return;
  }
  
  const customerName = document.getElementById("codName").value.trim();
  const customerPhone = document.getElementById("codPhone").value.trim();
  const customerAddress = document.getElementById("codAddress").value.trim();
  const quantity = parseInt(document.getElementById("codQuantity").value) || 1;
  
  // Validation
  if (!customerName) {
    showToast("অনুগ্রহ করে আপনার নাম লিখুন", "error");
    return;
  }
  if (!customerPhone) {
    showToast("অনুগ্রহ করে ফোন নম্বর লিখুন", "error");
    return;
  }
  if (!customerAddress) {
    showToast("অনুগ্রহ করে ডেলিভারি ঠিকানা লিখুন", "error");
    return;
  }
  
  const orderData = {
    productId: currentCODProduct.id,
    source: currentCODProduct.source || "own",
    productName: currentCODProduct.name,
    productPrice: formatPrice(currentCODProduct.price),
    customerName: customerName,
    customerPhone: customerPhone,
    customerAddress: customerAddress,
    quantity: quantity,
    userId: currentUser ? currentUser.uid : null,
    userEmail: currentUser ? currentUser.email : null,
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  console.log("Submitting COD Order:", orderData);
  
  db.collection("codOrders").add(orderData)
    .then((docRef) => {
      console.log("COD Order saved with ID:", docRef.id);
      
      // ✅ FIX: trackCODOrder কে safely call করা
      if (typeof trackCODOrder === 'function') {
        try {
          trackCODOrder(currentCODProduct.id);
        } catch (e) {
          console.warn("Analytics tracking skipped:", e.message);
        }
      }
      
      showToast("✅ আপনার অর্ডার সফলভাবে নেওয়া হয়েছে! শীঘ্রই যোগাযোগ করা হবে।");
      closeCodModal();
    })
    .catch((err) => {
      console.error("COD Order Error:", err);
      showToast("অর্ডার নিতে সমস্যা হয়েছে: " + (err.message || "আবার চেষ্টা করুন"), "error");
    });
}
/* ---------- Auth Form Submit ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // COD Form - IMPORTANT: Remove old listener first, then add new one
  const codForm = document.getElementById("codOrderForm");
  if (codForm) {
    // Clone and replace to remove all existing listeners
    const newForm = codForm.cloneNode(true);
    codForm.parentNode.replaceChild(newForm, codForm);
    
    // Add fresh listener
    newForm.addEventListener("submit", submitCODOrder);
    console.log("COD Form listener attached");
  }

  // Auth form
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
        return;
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
    const code = document.getElementById("otpInput").value.trim();
    try {
      await confirmationResult.confirm(code);
      showToast("সফলভাবে লগইন হয়েছে!");
    } catch (err) {
      errorEl.textContent = "OTP সঠিক নয়, আবার চেষ্টা করুন।";
    }
    return;
  }

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