/* ============================================
   Main Site Logic
   ============================================ */

let allProducts = [];
let allCategories = [];
let activeCategory = "all";
let searchQuery = "";

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  trackVisit();
  loadCategories();
  loadProducts();
  setupTelegramPopup();
  setupBackToTop();

  document.getElementById("themeToggleBtn")?.addEventListener("click", toggleTheme);

  document.getElementById("searchInput")?.addEventListener(
    "input",
    debounce((e) => {
      searchQuery = e.target.value.trim().toLowerCase();
      renderProducts();
      if (searchQuery) {
        db.collection("searchQueries").add({
          query: searchQuery,
          date: todayKey(),
          timestamp: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(() => {});
      }
    }, 450)
  );
});

/* ---------- Products ---------- */
function loadProducts() {
  const grid = document.getElementById("productGrid");
  grid.innerHTML = Array(8).fill('<div class="skeleton skeleton-card"></div>').join("");

  db.collection("products")
    .where("status", "==", "active")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snap) => {
        allProducts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderProducts();
      },
      (err) => {
        console.error("Product load error:", err);
        grid.innerHTML = `<div class="empty-state">প্রোডাক্ট লোড করতে সমস্যা হচ্ছে। একটু পর আবার চেষ্টা করুন।</div>`;
      }
    );
}

function renderProducts() {
  const grid = document.getElementById("productGrid");
  let list = allProducts;

  if (activeCategory !== "all") {
    list = list.filter((p) => p.category === activeCategory);
  }
  if (searchQuery) {
    list = list.filter((p) => (p.name || "").toLowerCase().includes(searchQuery));
  }

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state">কোনো প্রোডাক্ট পাওয়া যায়নি। অন্য Category বা Search Term চেষ্টা করুন।</div>`;
    return;
  }

  grid.innerHTML = list.map(productCardHTML).join("");
}

function productCardHTML(p) {
  const discount =
    p.originalPrice && p.originalPrice > p.currentPrice
      ? Math.round(((p.originalPrice - p.currentPrice) / p.originalPrice) * 100)
      : 0;
  const img = p.image || "assets/images/empty-box.svg";
  return `
    <div class="product-card">
      <div class="product-img-wrap">
        ${discount > 0 ? `<span class="discount-badge">-${discount}%</span>` : ""}
        <img src="${img}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.src='assets/images/empty-box.svg'">
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="price-row">
          <span class="price-current">${formatPrice(p.currentPrice)}</span>
          ${p.originalPrice && discount > 0 ? `<span class="price-original">${formatPrice(p.originalPrice)}</span>` : ""}
        </div>
        <button class="buy-now-btn" onclick="requireAuthThenRedirect('${(p.affiliateLink || "").replace(/'/g, "\\'")}', '${p.id}')">
          এখনই কিনুন — Daraz 🛒
        </button>
      </div>
    </div>`;
}

/* ---------- Categories ---------- */
function loadCategories() {
  db.collection("categories")
    .orderBy("name")
    .onSnapshot((snap) => {
      allCategories = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderCategories();
    });
}

function renderCategories() {
  const wrap = document.getElementById("categoryStrip");
  if (!wrap) return;
  const pills = [
    `<button class="category-pill ${activeCategory === "all" ? "active" : ""}" data-cat="all">✨ সব</button>`
  ].concat(
    allCategories.map(
      (c) =>
        `<button class="category-pill ${activeCategory === c.id ? "active" : ""}" data-cat="${c.id}">${c.icon ? `<i class="${c.icon}"></i>` : ""} ${escapeHTML(c.name)}</button>`
    )
  );
  wrap.innerHTML = pills.join("");
  wrap.querySelectorAll(".category-pill").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.cat;
      renderCategories();
      renderProducts();
    });
  });
}

/* ---------- Telegram Popup ---------- */
function setupTelegramPopup() {
  const overlay = document.getElementById("telegramModalOverlay");
  if (!overlay) return;

  const closed = localStorage.getItem("dn_telegram_closed");
  if (!closed) {
    setTimeout(() => overlay.classList.add("active"), 1200);
  }

  document.getElementById("telegramCloseBtn").addEventListener("click", closeTelegramModal);
  document.getElementById("telegramSkipBtn").addEventListener("click", closeTelegramModal);
  document.getElementById("telegramJoinBtn").addEventListener("click", () => {
    trackTelegramClick("popup");
    window.open(TELEGRAM_LINK, "_blank");
    closeTelegramModal();
  });
}
function closeTelegramModal() {
  document.getElementById("telegramModalOverlay").classList.remove("active");
  localStorage.setItem("dn_telegram_closed", "true");
}

/* ---------- Back to top ---------- */
function setupBackToTop() {
  const btn = document.getElementById("backToTopBtn");
  if (!btn) return;
  window.addEventListener("scroll", () => {
    btn.classList.toggle("show", window.scrollY > 500);
  });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}
