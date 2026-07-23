/* ============================================
   Shared Utility Functions
   (Updated: Fixed Theme Toggle)
   ============================================ */

function showToast(message, type = "success") {
  let wrap = document.querySelector(".toast-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toast-wrap";
    document.body.appendChild(wrap);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  wrap.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

function formatPrice(n) {
  if (n === undefined || n === null) return "৳0";
  return "৳" + Number(n).toLocaleString("en-BD");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function todayKey() {
  return new Date().toISOString().split("T")[0];
}

/* ---------- Theme (Dark/Light) ---------- */
function initTheme() {
  const saved = localStorage.getItem("dn_theme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", preferred);
  updateThemeIcon(preferred);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = (current === "dark") ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("dn_theme", next);
  updateThemeIcon(next);
  console.log("Theme toggled to:", next); // Debug log
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.innerHTML = theme === "dark" ? "☀️" : "🌙";
    btn.title = theme === "dark" ? "Light Mode" : "Dark Mode";
  }
}

/* ---------- Debounce ---------- */
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------- Source Labels & Colors ---------- */
const SOURCE_CONFIG = {
  daraz: {
    label: "Daraz",
    color: "#F57224",
    icon: "fa-bolt",
    badgeClass: "daraz"
  },
  external: {
    label: "অন্যান্য প্রতিষ্ঠান",
    color: "#3B82F6",
    icon: "fa-store",
    badgeClass: "external"
  },
  own: {
    label: "আমাদের প্রোডাক্ট",
    color: "#10B981",
    icon: "fa-star",
    badgeClass: "own"
  }
};

function getSourceLabel(source) {
  return SOURCE_CONFIG[source]?.label || source || "Unknown";
}

function getSourceColor(source) {
  return SOURCE_CONFIG[source]?.color || "#6B6459";
}

function getSourceBadgeClass(source) {
  return SOURCE_CONFIG[source]?.badgeClass || "";
}

/* ---------- Active Sources (LocalStorage Cache) ---------- */
function getActiveSources() {
  try {
    const cached = localStorage.getItem("dn_active_sources");
    if (cached) return JSON.parse(cached);
  } catch (e) {}
  return null;
}

function setActiveSources(sources) {
  localStorage.setItem("dn_active_sources", JSON.stringify(sources));
}