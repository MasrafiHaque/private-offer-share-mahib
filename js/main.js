/* ============================================
   Main Site Logic
   (Updated: Multi-Source Products, COD, Source Filter)
   ============================================ */

let allProducts = [];
let allCategories = [];
let allSources = []; // নতুন: সব প্রোডাক্ট সোর্স
let activeCategory = "all";
let activeSource = "all"; // নতুন: অ্যাক্টিভ সোর্স ফিল্টার
let searchQuery = "";
let enabledSources = []; // নতুন: Admin Panel থেকে অনুমোদিত সোর্স

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  trackVisit();
  loadSiteSettings(); // নতুন: সাইট সেটিংস লোড
  loadEnabledSources(); // নতুন: অনুমোদিত সোর্স লোড
  loadCategories();
  loadProducts();
  setupTelegramPopup();
  setupBackToTop();
  setupSourceFilter(); // নতুন: সোর্স ফিল্টার ড্রপডাউন
  setupSourceFilterClickOutside(); // নতুন: ড্রপডাউনের বাইরে ক্লিক করলে বন্ধ

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

/* ---------- Site Settings Load (New) ---------- */
async function loadSiteSettings() {
  try {
    const doc = await db.collection("siteSettings").doc("general").get();
    if (doc.exists) {
      const settings = doc.data();
      // Hero Section আপডেট
      if (settings.bannerTitle) {
        document.getElementById("heroTitle").innerHTML = settings.bannerTitle;
      }
      if (settings.bannerSubtitle) {
        document.getElementById("heroSubtitle").textContent = settings.bannerSubtitle;
      }
      // Telegram Link আপডেট
      if (settings.telegramLink) {
        window.TELEGRAM_LINK = settings.telegramLink;
        document.getElementById("telegramHeroBtn").href = settings.telegramLink;
      }
    }
  } catch (e) {
    console.error("Settings load error:", e);
  }
}

/* ---------- Enabled Sources Load (New) ---------- */
async function loadEnabledSources() {
  try {
    const snap = await db.collection("productSources")
      .where("enabled", "==", true)
      .get();
    
    enabledSources = snap.docs.map(d => d.id);
    
    // ক্যাশে সেভ
    setActiveSources(enabledSources);
    
    // সোর্স ফিল্টার UI আপডেট
    renderSourceFilter();
    renderSourceTabs();
  } catch (e) {
    // ক্যাশ থেকে পড়ার চেষ্টা
    const cached = getActiveSources();
    if (cached) {
      enabledSources = cached;
      renderSourceFilter();
      renderSourceTabs();
    }
    console.error("Sources load error:", e);
  }
}

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

  // Source filter (নতুন)
  if (enabledSources.length > 0) {
    list = list.filter((p) => enabledSources.includes(p.source || "daraz"));
  }

  // Active source tab filter (নতুন)
  if (activeSource !== "all") {
    list = list.filter((p) => p.source === activeSource);
  }

  // Category filter
  if (activeCategory !== "all") {
    list = list.filter((p) => p.category === activeCategory);
  }

  // Search filter
  if (searchQuery) {
    list = list.filter((p) => (p.name || "").toLowerCase().includes(searchQuery));
  }

  if (list.length === 0) {
    grid.innerHTML = `<div class="empty-state">
      <i class="fas fa-box-open" style="font-size:3rem;display:block;margin-bottom:1rem;color:var(--text-muted);"></i>
      কোনো প্রোডাক্ট পাওয়া যায়নি। অন্য Category বা Search Term চেষ্টা করুন।
    </div>`;
    return;
  }

  grid.innerHTML = list.map(productCardHTML).join("");
}

function productCardHTML(p) {
  const source = p.source || "daraz";
  const discount =
    p.originalPrice && p.originalPrice > p.currentPrice
      ? Math.round(((p.originalPrice - p.currentPrice) / p.originalPrice) * 100)
      : 0;
  const img = p.image || "assets/images/empty-box.svg";

  // Source Badge
  const sourceBadge = `
    <span class="source-badge ${getSourceBadgeClass(source)}">
      ${getSourceLabel(source)}
    </span>
  `;

  // Discount Badge
  const discountBadge = discount > 0 
    ? `<span class="discount-badge">-${discount}%</span>` 
    : "";

  // Action Buttons (Source ভিত্তিক)
  let actionButtons = "";
  
  if (source === "daraz") {
    // Daraz: Buy Now বাটন (Auth Required)
    actionButtons = `
      <button class="buy-now-btn" onclick="requireAuthThenRedirect('${(p.affiliateLink || "").replace(/'/g, "\\'")}', '${p.id}', 'daraz')">
        এখনই কিনুন — Daraz 🛒
      </button>
    `;
  } else if (source === "external") {
    // External: সোশ্যাল মিডিয়া বাটন
    const socialLinks = p.socialLinks || {};
    actionButtons = `<div class="social-btns">`;
    if (socialLinks.facebook) {
      actionButtons += `
        <button class="social-btn fb" onclick="trackSocialClick('${p.id}','facebook'); window.open('${socialLinks.facebook.replace(/'/g, "\\'")}','_blank')">
          <i class="fab fa-facebook"></i> Facebook
        </button>`;
    }
    if (socialLinks.messenger) {
      actionButtons += `
        <button class="social-btn msg" onclick="trackSocialClick('${p.id}','messenger'); window.open('${socialLinks.messenger.replace(/'/g, "\\'")}','_blank')">
          <i class="fab fa-facebook-messenger"></i> Messenger
        </button>`;
    }
    if (socialLinks.whatsapp) {
      actionButtons += `
        <button class="social-btn wa" onclick="trackSocialClick('${p.id}','whatsapp'); window.open('${socialLinks.whatsapp.replace(/'/g, "\\'")}','_blank')">
          <i class="fab fa-whatsapp"></i> WhatsApp
        </button>`;
    }
    if (socialLinks.website) {
      actionButtons += `
        <button class="social-btn" onclick="trackSocialClick('${p.id}','website'); window.open('${socialLinks.website.replace(/'/g, "\\'")}','_blank')">
          <i class="fas fa-globe"></i> Website
        </button>`;
    }
    if (!socialLinks.facebook && !socialLinks.messenger && !socialLinks.whatsapp && !socialLinks.website) {
      actionButtons += `<span style="font-size:0.78rem;color:var(--text-muted);">কোনো লিংক নেই</span>`;
    }
    actionButtons += `</div>`;
  } else if (source === "own") {
    // Own: Cash on Delivery বাটন
    actionButtons = `
      <button class="cod-btn" onclick="requireAuthForCOD('${p.id}', '${escapeHTML(p.name).replace(/'/g, "\\'")}', ${p.currentPrice}, 'own')">
        📦 ক্যাশ অন ডেলিভারি
      </button>
    `;
  }

  return `
    <div class="product-card">
      <div class="product-img-wrap">
        ${sourceBadge}
        ${discountBadge}
        <img src="${img}" alt="${escapeHTML(p.name)}" loading="lazy" onerror="this.src='assets/images/empty-box.svg'">
      </div>
      <div class="product-body">
        <div class="product-name">${escapeHTML(p.name)}</div>
        <div class="price-row">
          <span class="price-current">${formatPrice(p.currentPrice)}</span>
          ${p.originalPrice && discount > 0 ? `<span class="price-original">${formatPrice(p.originalPrice)}</span>` : ""}
        </div>
        <div class="product-actions">
          ${actionButtons}
        </div>
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

/* ---------- Source Tabs (New) ---------- */
function renderSourceTabs() {
  const wrap = document.getElementById("sourceTabs");
  if (!wrap) return;

  let tabs = [
    `<button class="source-tab ${activeSource === "all" ? "active" : ""}" data-source="all">🌐 সব সোর্স</button>`
  ];

  // শুধু enabled sources দেখাবে
  if (enabledSources.includes("daraz")) {
    tabs.push(`<button class="source-tab ${activeSource === "daraz" ? "active" : ""}" data-source="daraz">
      <span class="source-dot" style="background:${getSourceColor('daraz')};"></span> Daraz
    </button>`);
  }
  if (enabledSources.includes("external")) {
    tabs.push(`<button class="source-tab ${activeSource === "external" ? "active" : ""}" data-source="external">
      <span class="source-dot" style="background:${getSourceColor('external')};"></span> অন্যান্য প্রতিষ্ঠান
    </button>`);
  }
  if (enabledSources.includes("own")) {
    tabs.push(`<button class="source-tab ${activeSource === "own" ? "active" : ""}" data-source="own">
      <span class="source-dot" style="background:${getSourceColor('own')};"></span> আমাদের প্রোডাক্ট
    </button>`);
  }

  wrap.innerHTML = tabs.join("");
  wrap.querySelectorAll(".source-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      activeSource = btn.dataset.source;
      renderSourceTabs();
      renderProducts();
    });
  });
}

/* ---------- Source Filter Dropdown (New) ---------- */
function renderSourceFilter() {
  const wrap = document.getElementById("sourceFilterList");
  if (!wrap) return;

  const allSourcesConfig = [
    { id: "daraz", ...SOURCE_CONFIG.daraz },
    { id: "external", ...SOURCE_CONFIG.external },
    { id: "own", ...SOURCE_CONFIG.own }
  ];

  wrap.innerHTML = allSourcesConfig.map(s => `
    <label class="source-filter-item">
      <input type="checkbox" 
             value="${s.id}" 
             ${enabledSources.includes(s.id) ? "checked" : ""}
             onchange="toggleSourceFilter('${s.id}', this.checked)">
      <span class="source-dot" style="background:${s.color};"></span>
      ${s.label}
    </label>
  `).join("");
}

function toggleSourceFilter(sourceId, checked) {
  if (checked) {
    if (!enabledSources.includes(sourceId)) {
      enabledSources.push(sourceId);
    }
  } else {
    enabledSources = enabledSources.filter(s => s !== sourceId);
  }
  setActiveSources(enabledSources);
  renderSourceTabs();
  
  // যদি current active source disabled হয় তাহলে all এ ফিরিয়ে দাও
  if (!enabledSources.includes(activeSource) && activeSource !== "all") {
    activeSource = "all";
  }
  
  renderProducts();
}

function setupSourceFilter() {
  const btn = document.getElementById("sourceFilterBtn");
  const menu = document.getElementById("sourceFilterMenu");
  if (!btn || !menu) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("active");
  });
}

function setupSourceFilterClickOutside() {
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("sourceFilterMenu");
    const btn = document.getElementById("sourceFilterBtn");
    if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
      menu.classList.remove("active");
    }
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