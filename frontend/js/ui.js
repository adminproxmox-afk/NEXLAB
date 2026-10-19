import { cartCount, getFavorites } from "./cart.js";
import { toast } from "./notifications.js";
import { getCurrentUser, hasAdminAccess, logout } from "./session.js";
import { showAuthDialog } from "./authGate.js";
import { getProducts } from "./productService.js";
import { searchProducts } from "./search.js";
import { getComparisonIds } from "../api/comparisonService.js";
import { currentLanguage, initializeI18n, setLanguage, formatMoney, formatProductCount } from "./i18n.js";
export { showAuthDialog };
export { toast };

const mainContent = document.querySelector("main");
if (mainContent) {
  mainContent.id ||= "main-content";
  mainContent.tabIndex = -1;
  const skipLink = document.createElement("a");
  skipLink.className = "skip-link";
  skipLink.href = `#${mainContent.id}`;
  skipLink.textContent = "Перейти до основного вмісту";
  document.body.prepend(skipLink);
}

initializeI18n();

const prefix = location.pathname.toLowerCase().includes("/admin/") ? "../" : "";
const path = location.pathname.split("/").pop() || "index.html";
const safe = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export function renderSharedLayout(settings = { name: "NEXLAB" }) {
  const storeName = safe(settings.name || "NEXLAB");
  const lightTheme = document.documentElement.dataset.theme === "light";
  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.innerHTML = `<header class="site-header"><div class="header-inner wrap">
      <a class="brand" href="${prefix}index.html" aria-label="${storeName} — головна сторінка"><span class="brand-mark">${storeName.slice(0, 1)}</span>${storeName}</a>
      <nav class="main-nav" id="site-main-nav" data-mobile-nav aria-label="Головна навігація">
        <a href="${prefix}index.html" ${path === "index.html" ? 'aria-current="page"' : ""}>Головна</a>
        <a href="${prefix}catalog.html" ${path === "catalog.html" && !location.search ? 'aria-current="page"' : ""}>Каталог</a>
        <a href="${prefix}projects.html" ${path === "projects.html" || path === "project.html" ? 'aria-current="page"' : ""}>Проєкти</a><a href="${prefix}community.html" ${path === "community.html" ? 'aria-current="page"' : ""}>Спільнота</a><a href="${prefix}catalog.html?tag=sale" ${new URLSearchParams(location.search).get("tag") === "sale" ? 'aria-current="page"' : ""}>Акції</a>
      </nav>
      <div class="header-tools">
        <div class="header-search-wrap"><form class="header-search" data-header-search role="search"><button class="header-search-submit" type="submit" data-header-search-submit aria-label="Шукати товар"><span aria-hidden="true">⌕</span></button><input type="search" placeholder="Шукати товар" aria-label="Пошук товарів" role="combobox" aria-autocomplete="list" aria-haspopup="listbox" aria-controls="header-search-listbox" aria-expanded="false"></form><div class="header-search-results" data-header-search-results role="region" aria-label="Результати пошуку" aria-live="polite" hidden><p data-header-search-message></p><div id="header-search-listbox" role="listbox" aria-label="Підказки пошуку"></div></div></div>
        <a class="tool-link" href="${prefix}favorites.html" aria-label="Обране">♡<span class="tool-count" data-favorite-count hidden>0</span></a>
        <a class="tool-link" href="${prefix}compare.html" aria-label="Порівняння товарів">⇄<span class="tool-count" data-comparison-count hidden>0</span></a>
        <a class="tool-link" href="${prefix}cart.html" aria-label="Кошик">▣<span class="tool-count" data-cart-count hidden>0</span></a>
        <select class="language-select" data-language-select aria-label="Мова сайту"><option value="uk" ${currentLanguage() === "uk" ? "selected" : ""}>UA</option><option value="en" ${currentLanguage() === "en" ? "selected" : ""}>EN</option></select>
        <button class="theme-toggle" type="button" data-theme-toggle aria-label="Перемкнути на ${lightTheme ? "темну" : "світлу"} тему" title="${lightTheme ? "Темна" : "Світла"} тема"><span aria-hidden="true">${lightTheme ? "☾" : "☼"}</span></button>
        <div class="header-account" data-header-account></div>
      </div>
      <button class="menu-toggle" type="button" aria-label="Відкрити меню" aria-expanded="false" aria-controls="site-main-nav" data-menu-toggle><span aria-hidden="true"></span><span aria-hidden="true"></span></button>
    </div></header>`;
  }
  if (!document.querySelector(".skip-link"))
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<a class="skip-link" href="#main-content">Перейти до основного вмісту</a>',
    );
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "main-content";
  const footer = document.querySelector("[data-site-footer]");
  if (footer)
    footer.innerHTML = `<footer class="site-footer"><div class="footer-main wrap">
    <div class="footer-brand"><a class="brand" href="${prefix}index.html"><span class="brand-mark">${storeName.slice(0, 1)}</span>${storeName}</a><p>Електроніка й інструменти для тих, хто перетворює ідеї на пристрої.</p><a class="footer-contact" href="${prefix}contacts.html">Зв’язатися з командою</a></div>
    <div class="footer-column"><strong>Каталог</strong><a href="${prefix}catalog.html?category=Електронні%20компоненти">Електронні компоненти</a><a href="${prefix}catalog.html?category=Мікроконтролери">Мікроконтролери</a><a href="${prefix}catalog.html?category=Інструменти">Інструменти</a><a href="${prefix}catalog.html?category=Комп’ютери">Комп’ютери</a><a href="${prefix}catalog.html?category=3D-друк">3D-друк</a></div>
    <div class="footer-column"><strong>Покупцям</strong><a href="${prefix}delivery.html">Доставка</a><a href="${prefix}payment.html">Оплата</a><a href="${prefix}faq.html">Поширені запитання</a><a href="${prefix}warranty.html">Гарантія</a><a href="${prefix}returns.html">Повернення</a></div>
    <div class="footer-column"><strong>Компанія</strong><a href="${prefix}about.html">Про нас</a><a href="${prefix}contacts.html">Контакти</a><a href="${prefix}privacy.html">Конфіденційність</a><a href="https://github.com/adminproxmox-afk/NEXLAB" target="_blank" rel="noreferrer">GitHub · код проєкту ↗</a>${hasAdminAccess() ? `<a href="${prefix}admin/index.html">Для команди</a>` : ""}<strong class="footer-community-title">Спільнота</strong><a href="${prefix}community.html">Проєкти учасників</a><a href="${prefix}projects.html">Навчальні проєкти</a></div>
  </div><div class="footer-bottom wrap"><span>© ${new Date().getFullYear()} ${storeName}</span><span>Збирай. Перевіряй. Запускай.</span></div></footer>`;
  if (!document.querySelector("[data-auth-gate]"))
    document.body.insertAdjacentHTML(
      "beforeend",
      `<dialog class="auth-gate" data-auth-gate aria-labelledby="auth-gate-title"><button class="auth-gate-close" type="button" data-auth-gate-close aria-label="Закрити">×</button><span class="empty-mark">⌁</span><p class="eyebrow">ОБЛІКОВИЙ ЗАПИС NEXLAB</p><h2 id="auth-gate-title">Для цієї дії потрібно увійти</h2><p>Збережені проєкти прив’язані до облікового запису. Кошик і обране зберігаються в цьому браузері.</p><div class="auth-gate-actions"><a class="button button-primary" data-gate-login href="${prefix}login.html">Увійти</a><a class="button button-quiet" data-gate-register href="${prefix}register.html">Створити обліковий запис</a></div></dialog>`,
    );
  renderHeaderAccount();
  updateHeaderCounts();
}

function renderHeaderAccount() {
  const root = document.querySelector("[data-header-account]");
  if (!root) return;
  const nav = document.querySelector("[data-mobile-nav]");
  nav?.querySelectorAll(".auth-nav-link").forEach((link) => link.remove());
  const user = getCurrentUser();
  if (!user) {
    root.innerHTML = `<div class="auth-header-actions"><a href="${prefix}login.html">Увійти</a><a class="auth-register-link" href="${prefix}register.html">Реєстрація</a></div>`;
    nav?.insertAdjacentHTML(
      "beforeend",
      `<a class="auth-nav-link" href="${prefix}login.html">Увійти</a><a class="auth-nav-link auth-register" href="${prefix}register.html">Реєстрація</a>`,
    );
    return;
  }
  root.innerHTML = `<div class="account-control"><button class="account-toggle" type="button" data-account-toggle aria-expanded="false" aria-controls="header-account-menu"><span class="account-avatar">${safe(user.name.slice(0, 1).toUpperCase())}</span><span>${safe(user.name)}</span><span aria-hidden="true">⌄</span></button><nav class="account-dropdown" id="header-account-menu" data-account-dropdown hidden aria-label="Меню облікового запису"><a href="${prefix}profile.html">Профіль</a><a href="${prefix}orders.html">Мої замовлення</a><a href="${prefix}favorites.html">Обране</a><a href="${prefix}my-projects.html">Мої проєкти</a><a href="${prefix}profile.html#settings">Налаштування</a>${hasAdminAccess() ? `<a class="admin-menu-link" href="${prefix}admin/index.html">⚙ Панель керування</a>` : ""}<button type="button" data-header-logout>Вийти</button></nav></div>`;
}

export function updateHeaderCounts() {
  const cart = document.querySelector("[data-cart-count]");
  const fav = document.querySelector("[data-favorite-count]");
  const compare = document.querySelector("[data-comparison-count]");
  if (cart) {
    cart.textContent = cartCount();
    cart.hidden = cartCount() === 0;
  }
  if (fav) {
    fav.textContent = getFavorites().length;
    fav.hidden = getFavorites().length === 0;
  }
  if (compare) {
    compare.textContent = getComparisonIds().length;
    compare.hidden = getComparisonIds().length === 0;
  }
}

export function bindLayoutEvents() {
  document.querySelector("[data-language-select]")?.addEventListener("change", (event) => {
    setLanguage(event.currentTarget.value);
  });
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-mobile-nav]");
  const isCompactHeader = () =>
    toggle && getComputedStyle(toggle).display !== "none";
  const closeMobileNav = (returnFocus = false) => {
    if (!toggle || !nav || !nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Відкрити меню");
    if (returnFocus) toggle.focus();
  };
  const closeAccountMenu = (returnFocus = false) => {
    const menu = document.querySelector("[data-account-dropdown]");
    const accountToggle = document.querySelector("[data-account-toggle]");
    if (!menu || menu.hidden) return;
    menu.hidden = true;
    accountToggle?.setAttribute("aria-expanded", "false");
    if (returnFocus) accountToggle?.focus();
  };
  toggle?.addEventListener("click", () => {
    if (!nav) return;
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
  });
  document.addEventListener("click", (event) => {
    if (!nav?.classList.contains("is-open") || nav.contains(event.target) || toggle?.contains(event.target)) return;
    closeMobileNav();
  });
  nav?.addEventListener("click", (event) => {
    if (event.target.closest("a") && isCompactHeader())
      closeMobileNav();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMobileNav(true);
      closeAccountMenu(true);
    }
  });
  window.addEventListener("resize", () => {
    if (!isCompactHeader()) closeMobileNav();
  }, { passive: true });
  const search = document.querySelector("[data-header-search]");
  const searchWrap = search?.closest(".header-search-wrap");
  const searchResults = document.querySelector("[data-header-search-results]");
  const searchMessage = searchResults?.querySelector("[data-header-search-message]");
  const searchListbox = searchResults?.querySelector("#header-search-listbox");
  const searchInput = search?.querySelector("input");
  let searchRequest = 0;
  let activeSearchOption = -1;
  const closeSearchResults = () => {
    if (!searchInput || !searchResults) return;
    searchResults.hidden = true;
    searchInput.setAttribute("aria-expanded", "false");
    searchInput.removeAttribute("aria-activedescendant");
    activeSearchOption = -1;
  };
  search?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = searchInput.value.trim();
    location.href = `${prefix}catalog.html${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  });
  search?.addEventListener("click", (event) => {
    if (
      isCompactHeader() &&
      !search.classList.contains("is-open") &&
      event.target.closest("[data-header-search-submit]") &&
      !searchInput.value.trim()
    ) {
      event.preventDefault();
      search.classList.add("is-open");
      searchInput.focus();
    }
  });
  searchInput?.addEventListener("focus", () => search.classList.add("is-open"));
  searchInput?.addEventListener("input", async (event) => {
    const query = event.target.value.trim().toLocaleLowerCase("uk-UA");
    const request = ++searchRequest;
    activeSearchOption = -1;
    searchInput.removeAttribute("aria-activedescendant");
    if (query.length < 2) {
      closeSearchResults();
      searchMessage.textContent = "";
      searchListbox.innerHTML = "";
      return;
    }
    let products;
    try {
      products = await getProducts();
    } catch {
      if (request !== searchRequest) return;
      searchMessage.className = "search-empty";
      searchMessage.textContent = "Не вдалося завантажити каталог. Перевір з’єднання й спробуй ще раз.";
      searchListbox.innerHTML = "";
      searchResults.hidden = false;
      searchInput.setAttribute("aria-expanded", "true");
      return;
    }
    if (request !== searchRequest) return;
    const found = searchProducts(products, query).slice(0, 5);
    searchMessage.className = found.length ? "" : "search-empty";
    searchMessage.textContent = found.length
      ? formatProductCount(found.length)
      : "Нічого не знайдено. Спробуй іншу назву.";
    searchListbox.innerHTML = found.length
      ? `${found.map((product, index) => `<a id="header-search-option-${index}" role="option" aria-selected="false" tabindex="-1" href="${prefix}product.html?id=${encodeURIComponent(product.id)}"><span>${safe(product.category)}</span><strong>${safe(product.name)}</strong><b>${formatMoney(product.price)}</b></a>`).join("")}<a id="header-search-option-all" class="search-all" role="option" aria-selected="false" tabindex="-1" href="${prefix}catalog.html?q=${encodeURIComponent(event.target.value.trim())}">Переглянути всі результати →</a>`
      : "";
    searchResults.hidden = false;
    searchInput.setAttribute("aria-expanded", "true");
  });
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearchResults();
      search.classList.remove("is-open");
      event.currentTarget.blur();
      return;
    }
    if (!["ArrowDown", "ArrowUp"].includes(event.key) || searchResults.hidden) return;
    const options = [...searchResults.querySelectorAll('[role="option"]')];
    if (!options.length) return;
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    activeSearchOption = activeSearchOption < 0
      ? direction > 0 ? 0 : options.length - 1
      : (activeSearchOption + direction + options.length) % options.length;
    options.forEach((option, index) => {
      const active = index === activeSearchOption;
      option.setAttribute("aria-selected", String(active));
      option.classList.toggle("is-active", active);
    });
    searchInput.setAttribute("aria-activedescendant", options[activeSearchOption].id);
    options[activeSearchOption].scrollIntoView({ block: "nearest" });
  });
  searchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || activeSearchOption < 0) return;
    const selected = searchResults.querySelectorAll('[role="option"]')[activeSearchOption];
    if (!selected) return;
    event.preventDefault();
    location.href = selected.href;
  });
  document.addEventListener("click", (event) => {
    if (searchWrap && !searchWrap.contains(event.target)) {
      search.classList.remove("is-open");
      closeSearchResults();
    }
  });
  window.addEventListener("nexlab:cart-updated", updateHeaderCounts);
  window.addEventListener("nexlab:favorites-updated", updateHeaderCounts);
  window.addEventListener("nexlab:auth-updated", () => {
    renderHeaderAccount();
    updateHeaderCounts();
  });
  window.addEventListener("storage", () => {
    renderHeaderAccount();
    updateHeaderCounts();
  });
  document.addEventListener("click", async (event) => {
    const toggle = event.target.closest("[data-account-toggle]");
    if (toggle) {
      const menu = document.querySelector("[data-account-dropdown]");
      const open = menu.hidden;
      menu.hidden = !open;
      toggle.setAttribute("aria-expanded", String(open));
      return;
    }
    if (!event.target.closest(".account-control")) {
      closeAccountMenu();
    }
    if (event.target.closest("[data-header-logout]")) {
      await logout();
      location.href = `${prefix}index.html`;
    }
    if (event.target.closest("[data-auth-gate-close]"))
      document.querySelector("[data-auth-gate]")?.close();
  });
  const dialog = document.querySelector("[data-auth-gate]");
  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") dialog?.close();
  });
}
