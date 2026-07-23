/* ============================================
   Main Site Logic
   (Updated: Fixed Source Filter, Theme & Maintenance Mode)
   ============================================ */

let allProducts = [];
let allCategories = [];
let activeCategory = "all";
let activeSource = "all";
let searchQuery = "";
let enabledSources = [];

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, initializing...");
  
  // ✅ Maintenance Mode Check (সবার আগে)
  checkMaintenanceMode();
  
  // Theme initialize
  initTheme();
  
  // Theme toggle button
  const themeBtn = document.getElementById("themeToggleBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function(e) {
      e.preventDefault();
      toggleTheme();
      console.log("Theme button clicked");
    });
    console.log("Theme button listener attached");
  } else {
    console.error("Theme button NOT found!");
  }

  // Other initializations
  trackVisit();
  loadSiteSettings();
  loadEnabledSources();
  loadCategories();
  loadProducts();
  setupTelegramPopup();
  setupBackToTop();
  setupSourceFilter();
  setupSourceFilterClickOutside();

  // Search input
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener(
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
  }
  
  console.log("Initialization complete");
});

/* ---------- Maintenance Mode ---------- */
async function checkMaintenanceMode() {
  try {
    const doc = await db.collection("siteSettings").doc("maintenance").get();
    if (doc.exists && doc.data().enabled === true) {
      const settings = doc.data();
      showMaintenancePage(settings);
      // Maintenance mode ON থাকলে অন্য কিছু লোড করার দরকার নেই
      return true;
    }
    return false;
  } catch (e) {
    console.error("Maintenance check error:", e);
    return false;
  }
}

function showMaintenancePage(settings) {
  const title = settings.title || "আমরা শীঘ্রই ফিরছি! 🚧";
  const message = settings.message || "আমরা সাইটটি আরও ভালোভাবে সাজানোর জন্য কাজ করছি। কিছুক্ষণ পর আবার ভিজিট করুন।";
  const estimatedTime = settings.estimatedTime || "কাজ চলছে...";
  const telegramLink = settings.telegramLink || TELEGRAM_LINK || "#";
  
  const maintenanceHTML = `
    <div class="maintenance-overlay" id="maintenanceOverlay">
      <div class="maintenance-card">
        <div class="maintenance-icon">🛠️</div>
        <h1>${escapeHTML(title)}</h1>
        <p>${escapeHTML(message)}</p>
        <div class="estimated-time">
          <i class="fas fa-clock"></i> ${escapeHTML(estimatedTime)}
        </div>
        <div class="social-links">
          ${telegramLink !== '#' ? `
            <a href="${telegramLink}" target="_blank" title="Telegram">
              <i class="fab fa-telegram-plane"></i>
            </a>
          ` : ''}
          <a href="mailto:support@privateoffershare.com" title="Email">
            <i class="fas fa-envelope"></i>
          </a>
        </div>
      </div>
    </div>
  `;
  
  // Body এর শেষে maintenance overlay add
  document.body.insertAdjacentHTML('beforeend', maintenanceHTML);
}

/* ---------- Site Settings Load ---------- */
async function loadSiteSettings() {
  try {
    const doc = await db.collection("siteSettings").doc("general").get();
    if (doc.exists) {
      const settings = doc.data();
      if (settings.bannerTitle) {
        document.getElementById("heroTitle").innerHTML = settings.bannerTitle;
      }
      if (settings.bannerSubtitle) {
        document.getElementById("heroSubtitle").textContent = settings.bannerSubtitle;
      }
      if (settings.telegramLink) {
        window.TELEGRAM_LINK = settings.telegramLink;
        const telegramBtn = document.getElementById("telegramHeroBtn");
        if (telegramBtn) {
          telegramBtn.href = settings.telegramLink;
        }
      }
    }
  } catch (e) {
    console.error("Settings load error:", e);
  }
}

/* ---------- Enabled Sources Load ---------- */
async function loadEnabledSources() {
  try {
    const snap = await db.collection("productSources")
      .where("enabled", "==", true)
      .get();
    
    enabledSources = snap.docs.map(d => d.id);
    setActiveSources(enabledSources);
    renderSourceFilter();
    renderSourceTabs();
    renderProducts();
  } catch (e) {
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
  if (!grid) return;
  
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
  if (!grid) return;
  
  let list = allProducts;

  if (enabledSources.length > 0) {
    list = list.filter((p) => enabledSources.includes(p.source || "daraz"));
  }

  if (activeSource !== "all") {
    list = list.filter((p) => p.source === activeSource);
  }

  if (activeCategory !== "all") {
    list = list.filter((p) => p.category === activeCategory);
  }

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

  const sourceBadge = `
    <span class="source-badge ${getSourceBadgeClass(source)}">
      ${getSourceLabel(source)}
    </span>
  `;

  const discountBadge = discount > 0 
    ? `<span class="discount-badge">-${discount}%</span>` 
    : "";

  let actionButtons = "";
  
  if (source === "daraz") {
    actionButtons = `
      <button class="buy-now-btn" onclick="requireAuthThenRedirect('${(p.affiliateLink || "").replace(/'/g, "\\'")}', '${p.id}', 'daraz')">
        এখনই কিনুন — Daraz 🛒
      </button>
    `;
  } else if (source === "external") {
    const socialLinks = p.socialLinks || {};
    actionButtons = `<div class="social-btns">`;
    if (socialLinks.facebook) {
      actionButtons += `
        <button class="social-btn fb" onclick="trackSocialClick('${p.id}','facebook'); window.open('${socialLinks.facebook.replace(/'/g, "\\'")}','_blank')">
          <i class="fab fa-facebook"></i>
        </button>`;
    }
    if (socialLinks.messenger) {
      actionButtons += `
        <button class="social-btn msg" onclick="trackSocialClick('${p.id}','messenger'); window.open('${socialLinks.messenger.replace(/'/g, "\\'")}','_blank')">
          <i class="fab fa-facebook-messenger"></i>
        </button>`;
    }
    if (socialLinks.whatsapp) {
      actionButtons += `
        <button class="social-btn wa" onclick="trackSocialClick('${p.id}','whatsapp'); window.open('${socialLinks.whatsapp.replace(/'/g, "\\'")}','_blank')">
          <i class="fab fa-whatsapp"></i>
        </button>`;
    }
    if (socialLinks.website) {
      actionButtons += `
        <button class="social-btn" onclick="trackSocialClick('${p.id}','website'); window.open('${socialLinks.website.replace(/'/g, "\\'")}','_blank')">
          <i class="fas fa-globe"></i>
        </button>`;
    }
    if (!socialLinks.facebook && !socialLinks.messenger && !socialLinks.whatsapp && !socialLinks.website) {
      actionButtons += `<span style="font-size:0.78rem;color:var(--text-muted);">কোনো লিংক নেই</span>`;
    }
    actionButtons += `</div>`;
  } else if (source === "own") {
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

/* ---------- Source Tabs ---------- */
function renderSourceTabs() {
  const wrap = document.getElementById("sourceTabs");
  if (!wrap) return;

  let tabs = [
    `<button class="source-tab ${activeSource === "all" ? "active" : ""}" data-source="all">🌐 সব সোর্স</button>`
  ];

  if (enabledSources.includes("daraz")) {
    tabs.push(`<button class="source-tab ${activeSource === "daraz" ? "active" : ""}" data-source="daraz">
      <span class="source-dot" style="background:${getSourceColor('daraz')};"></span> Daraz
    </button>`);
  }
  if (enabledSources.includes("external")) {
    tabs.push(`<button class="source-tab ${activeSource === "external" ? "active" : ""}" data-source="external">
      <span class="source-dot" style="background:${getSourceColor('external')};"></span> অন্যান্য
    </button>`);
  }
  if (enabledSources.includes("own")) {
    tabs.push(`<button class="source-tab ${activeSource === "own" ? "active" : ""}" data-source="own">
      <span class="source-dot" style="background:${getSourceColor('own')};"></span> আমাদের
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

/* ---------- Source Filter Dropdown ---------- */
function renderSourceFilter() {
  const wrap = document.getElementById("sourceFilterList");
  if (!wrap) {
    console.error("sourceFilterList element NOT found!");
    return;
  }

  const allSourcesConfig = [
    { id: "daraz", ...SOURCE_CONFIG.daraz },
    { id: "external", ...SOURCE_CONFIG.external },
    { id: "own", ...SOURCE_CONFIG.own }
  ];

  wrap.innerHTML = allSourcesConfig.map(s => `
    <label class="source-filter-item" onclick="event.stopPropagation();">
      <input type="checkbox" 
             value="${s.id}" 
             ${enabledSources.includes(s.id) ? "checked" : ""}
             onchange="toggleSourceFilter('${s.id}', this.checked)">
      <span class="source-dot" style="background:${s.color};"></span>
      ${s.label}
    </label>
  `).join("");
  
  console.log("Source filter rendered:", enabledSources);
}

function toggleSourceFilter(sourceId, checked) {
  console.log("Toggle source:", sourceId, checked);
  if (checked) {
    if (!enabledSources.includes(sourceId)) {
      enabledSources.push(sourceId);
    }
  } else {
    enabledSources = enabledSources.filter(s => s !== sourceId);
  }
  setActiveSources(enabledSources);
  renderSourceTabs();
  
  if (!enabledSources.includes(activeSource) && activeSource !== "all") {
    activeSource = "all";
  }
  
  renderProducts();
}

function setupSourceFilter() {
  const btn = document.getElementById("sourceFilterBtn");
  const menu = document.getElementById("sourceFilterMenu");
  
  if (!btn) {
    console.error("sourceFilterBtn NOT found!");
    return;
  }
  if (!menu) {
    console.error("sourceFilterMenu NOT found!");
    return;
  }

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    menu.classList.toggle("active");
    console.log("Filter menu toggled:", menu.classList.contains("active"));
  });
  
  console.log("Source filter setup complete");
}

function setupSourceFilterClickOutside() {
  document.addEventListener("click", (e) => {
    const menu = document.getElementById("sourceFilterMenu");
    const btn = document.getElementById("sourceFilterBtn");
    
    if (!menu || !btn) return;
    
    // Check if click is outside menu and button
    const isClickInsideMenu = menu.contains(e.target);
    const isClickOnButton = btn.contains(e.target);
    
    if (!isClickInsideMenu && !isClickOnButton) {
      menu.classList.remove("active");
    }
  });
  
  // ✅ মোবাইলে backdrop ক্লিক করলেও বন্ধ হবে
  document.addEventListener("touchstart", (e) => {
    const menu = document.getElementById("sourceFilterMenu");
    const btn = document.getElementById("sourceFilterBtn");
    
    if (!menu || !btn) return;
    
    if (menu.classList.contains("active") && 
        !menu.contains(e.target) && 
        !btn.contains(e.target)) {
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

  const closeBtn = document.getElementById("telegramCloseBtn");
  const skipBtn = document.getElementById("telegramSkipBtn");
  const joinBtn = document.getElementById("telegramJoinBtn");
  
  if (closeBtn) closeBtn.addEventListener("click", closeTelegramModal);
  if (skipBtn) skipBtn.addEventListener("click", closeTelegramModal);
  if (joinBtn) {
    joinBtn.addEventListener("click", () => {
      trackTelegramClick("popup");
      window.open(window.TELEGRAM_LINK || "https://t.me/YOUR_CHANNEL", "_blank");
      closeTelegramModal();
    });
  }
}

function closeTelegramModal() {
  const overlay = document.getElementById("telegramModalOverlay");
  if (overlay) overlay.classList.remove("active");
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