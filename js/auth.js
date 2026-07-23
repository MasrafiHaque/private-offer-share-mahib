/* ============================================
   Authentication (Email + Phone)
   ============================================ */

let currentUser = null;
let pendingBuyProduct = null;
let pendingCODSource = null;
let currentCODProduct = null;

auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  updateAuthUI();

  if (user) {
    const ref = db.collection("users").doc(user.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      let phoneNumber = null;
      if (user.email && user.email.includes('@phone.')) {
        phoneNumber = user.email.split('@')[0];
      }
      await ref.set({
        name: user.displayName || phoneNumber || "User",
        email: user.email || null,
        phone: phoneNumber,
        role: "user",
        status: "active",
        loginMethod: phoneNumber ? "phone" : "email",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastLogin: firebase.firestore.FieldValue.serverTimestamp()
      });
      trackEvent("registration");
    } else {
      await ref.update({ lastLogin: firebase.firestore.FieldValue.serverTimestamp() });
      if (snap.data().status === "banned") {
        showToast("⛔ আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে।", "error");
        await auth.signOut();
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
  
  antiTamperCheck();
});

function updateAuthUI() {
  const loginBtn = document.getElementById("loginBtnHeader");
  const userBtn = document.getElementById("userBtnHeader");
  if (!loginBtn || !userBtn) return;
  if (currentUser) {
    loginBtn.style.display = "none";
    userBtn.style.display = "flex";
    userBtn.title = currentUser.displayName || currentUser.email?.split('@')[0] || "";
  } else {
    loginBtn.style.display = "flex";
    userBtn.style.display = "none";
  }
}

// ✅✅✅ FIXED: openAuthModal function ✅✅✅
function openAuthModal(mode) {
  mode = mode || "login";
  var modal = document.getElementById("authModalOverlay");
  if (!modal) {
    console.error("❌ authModalOverlay element NOT found in HTML!");
    showToast("Login system error. Please refresh page.", "error");
    return;
  }
  modal.classList.add("active");
  setAuthTab(mode);
}

// ✅✅✅ FIXED: closeAuthModal function ✅✅✅
function closeAuthModal() {
  var modal = document.getElementById("authModalOverlay");
  if (modal) {
    modal.classList.remove("active");
    var errorEl = document.getElementById("authError");
    if (errorEl) errorEl.textContent = "";
  }
}

function setAuthTab(mode) {
  document.querySelectorAll(".auth-tab").forEach(function(t) {
    t.classList.toggle("active", t.dataset.mode === mode);
  });
  var form = document.getElementById("authForm");
  if (form) form.dataset.mode = mode;
  var submitBtn = document.getElementById("authSubmitBtn");
  if (submitBtn) submitBtn.textContent = mode === "login" ? "লগইন করুন" : "Sign Up করুন";
  var nameField = document.getElementById("nameField");
  if (nameField) nameField.style.display = mode === "signup" ? "block" : "none";
}

function setAuthMethod(method) {
  document.querySelectorAll(".auth-method-switch button").forEach(function(b) {
    b.classList.toggle("active", b.dataset.method === method);
  });
  var form = document.getElementById("authForm");
  if (form) form.dataset.method = method;
  
  if (method === "email") {
    var label = document.querySelector("#emailField label");
    if (label) label.textContent = "Email";
    var input = document.getElementById("emailInput");
    if (input) { input.placeholder = "you@example.com"; input.type = "email"; }
  } else if (method === "phone") {
    var label = document.querySelector("#emailField label");
    if (label) label.textContent = "ফোন নম্বর";
    var input = document.getElementById("emailInput");
    if (input) { input.placeholder = "+8801XXXXXXXXX"; input.type = "tel"; }
  }
}

/* ---------- Form submit ---------- */
document.addEventListener("DOMContentLoaded", function() {
  // COD Form
  var codForm = document.getElementById("codOrderForm");
  if (codForm) {
    var newForm = codForm.cloneNode(true);
    codForm.parentNode.replaceChild(newForm, codForm);
    newForm.addEventListener("submit", submitCODOrder);
  }

  // Auth form
  var form = document.getElementById("authForm");
  if (!form) return;

  form.addEventListener("submit", async function(e) {
    e.preventDefault();
    var mode = form.dataset.mode;
    var method = form.dataset.method;
    var errorEl = document.getElementById("authError");
    errorEl.textContent = "";

    try {
      var email, password, name;
      
      if (method === "email") {
        email = document.getElementById("emailInput").value.trim();
        password = document.getElementById("passwordInput").value;
        if (mode === "signup") name = document.getElementById("nameInput").value.trim();
      } else if (method === "phone") {
        var phone = document.getElementById("emailInput").value.trim();
        password = document.getElementById("passwordInput").value;
        if (!phone.startsWith("+")) { errorEl.textContent = "ফোন নম্বর Country Code সহ লিখুন (যেমন: +8801XXXXXXXXX)"; return; }
        phone = phone.replace(/[\s\-\(\)]/g, "");
        if (phone.length < 11 || phone.length > 15) { errorEl.textContent = "সঠিক ফোন নম্বর লিখুন"; return; }
        email = phone + "@phone.privateoffershare.com";
        if (mode === "signup") name = document.getElementById("nameInput").value.trim() || phone;
      }
      
      if (!email || !password) { errorEl.textContent = "সব তথ্য পূরণ করুন"; return; }
      if (password.length < 6) { errorEl.textContent = "Password কমপক্ষে ৬ অক্ষরের হতে হবে"; return; }

      if (mode === "signup") {
        var cred = await auth.createUserWithEmailAndPassword(email, password);
        await cred.user.updateProfile({ displayName: name || email.split('@')[0] });
        await db.collection("users").doc(cred.user.uid).set({
          name: name || email.split('@')[0],
          email: method === "phone" ? null : email,
          phone: method === "phone" ? email.split('@')[0] : null,
          role: "user", status: "active", loginMethod: method,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          lastLogin: firebase.firestore.FieldValue.serverTimestamp()
        });
        showToast("✅ অ্যাকাউন্ট তৈরি হয়েছে!");
      } else {
        await auth.signInWithEmailAndPassword(email, password);
        showToast("✅ সফলভাবে লগইন হয়েছে!");
      }
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
    }
  });
});

function friendlyAuthError(code) {
  var map = {
    "auth/email-already-in-use": "এই ফোন নম্বর/ইমেইল দিয়ে আগে থেকেই অ্যাকাউন্ট আছে।",
    "auth/invalid-email": "সঠিক ফোন নম্বর/ইমেইল দিন।",
    "auth/weak-password": "Password কমপক্ষে ৬ অক্ষরের হতে হবে।",
    "auth/wrong-password": "Password সঠিক নয়।",
    "auth/user-not-found": "এই ফোন নম্বর/ইমেইল দিয়ে কোনো অ্যাকাউন্ট নেই।",
    "auth/too-many-requests": "অনেকবার চেষ্টা করা হয়েছে, একটু পর আবার চেষ্টা করুন।"
  };
  return map[code] || "কিছু একটা ভুল হয়েছে, আবার চেষ্টা করুন।";
}

function logout() {
  auth.signOut();
  showToast("✅ লগআউট হয়েছে");
}

function requireAuthThenRedirect(affiliateLink, productId, source) {
  if (currentUser) { trackBuyClick(productId, source); window.open(affiliateLink, "_blank"); }
  else { pendingBuyProduct = affiliateLink; openAuthModal("login"); showToast("কিনতে হলে আগে Login করুন", "error"); }
}

function requireAuthForCOD(productId, productName, productPrice, source) {
  var productData = { id: productId, name: productName, price: productPrice, source: source };
  if (currentUser) { openCODModal(productData); }
  else { pendingCODSource = { product: productData }; openAuthModal("login"); showToast("অর্ডার করতে হলে আগে Login করুন", "error"); }
}

function openCODModal(product) {
  currentCODProduct = product;
  document.getElementById("codProductName").textContent = product.name;
  document.getElementById("codProductPrice").textContent = formatPrice(product.price);
  document.getElementById("codOrderForm").reset();
  document.getElementById("codModalOverlay").classList.add("active");
  if (currentUser) {
    db.collection("users").doc(currentUser.uid).get().then(function(doc) {
      if (doc.exists) {
        var data = doc.data();
        if (data.name) document.getElementById("codName").value = data.name;
        if (data.phone) document.getElementById("codPhone").value = data.phone;
      }
    }).catch(function() {});
  }
}

function closeCodModal() {
  document.getElementById("codModalOverlay").classList.remove("active");
  currentCODProduct = null;
}

function submitCODOrder(e) {
  e.preventDefault();
  if (!currentCODProduct) { showToast("প্রোডাক্ট তথ্য পাওয়া যায়নি", "error"); return; }
  var customerName = document.getElementById("codName").value.trim();
  var customerPhone = document.getElementById("codPhone").value.trim();
  var customerAddress = document.getElementById("codAddress").value.trim();
  var quantity = parseInt(document.getElementById("codQuantity").value) || 1;
  if (!customerName || !customerPhone || !customerAddress) { showToast("সব তথ্য পূরণ করুন", "error"); return; }
  
  var orderData = {
    productId: currentCODProduct.id, source: currentCODProduct.source || "own",
    productName: currentCODProduct.name, productPrice: formatPrice(currentCODProduct.price),
    customerName: customerName, customerPhone: customerPhone, customerAddress: customerAddress, quantity: quantity,
    userId: currentUser ? currentUser.uid : null,
    userEmail: currentUser ? currentUser.email : null,
    status: "pending",
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  
  db.collection("codOrders").add(orderData)
    .then(function() {
      if (typeof trackCODOrder === 'function') { try { trackCODOrder(currentCODProduct.id); } catch(e) {} }
      showToast("✅ আপনার অর্ডার সফলভাবে নেওয়া হয়েছে! শীঘ্রই যোগাযোগ করা হবে।");
      closeCodModal();
    })
    .catch(function(err) { showToast("অর্ডার নিতে সমস্যা হয়েছে", "error"); });
}

function antiTamperCheck() {
  if (window.location.href.indexOf('sys-mgr') > -1 || window.location.href.indexOf('admin') > -1) {
    document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    document.addEventListener('keydown', function(e) {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
      }
    });
  }
}