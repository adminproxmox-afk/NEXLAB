import { cartCount, getFavorites } from "./cart.js";
import { toast } from "./notifications.js";
import { getCurrentUser, isAdmin, logout } from "./session.js";
import { showAuthDialog } from "./authGate.js";
import { getProducts } from "./productService.js";
export { showAuthDialog };
export { toast };

document.addEventListener("click", (event) => {
  if (!event.target.closest("[data-dismiss-announcement]")) return;
  sessionStorage.setItem("nexlab-demo-notice-dismissed", "1");
  document.querySelector("[data-announcement]").hidden = true;
});

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
  const notice = document.querySelector("[data-announcement]");
  if (notice) {
    notice.querySelector("span").textContent =
      settings.demoNotice ||
      "Демонстраційний сайт: каталог і заявки наведено для прикладу. Продажі ще не відкриті — не вводь реальні персональні дані.";
    notice.hidden = sessionStorage.getItem("nexlab-demo-notice-dismissed") === "1";
  }
  const header = document.querySelector("[data-site-header]");
  if (header) {
    header.innerHTML = `<header class="site-header"><div class="header-inner wrap">
      <a class="brand" href="${prefix}index.html" aria-label="${storeName} — головна сторінка"><span class="brand-mark">${storeName.slice(0, 1)}</span>${storeName}</a>
      <nav class="main-nav" data-mobile-nav aria-label="Головна навігація">
        <a href="${prefix}index.html" ${path === "index.html" ? 'aria-current="page"' : ""}>Головна</a>
        <a href="${prefix}catalog.html" ${path === "catalog.html" ? 'aria-current="page"' : ""}>Каталог</a>
        <a href="${prefix}projects.html">Проєкти</a><a href="${prefix}catalog.html?tag=sale">Акції</a>
      </nav>
      <div class="header-tools">
        <div class="header-search-wrap"><form class="header-search" data-header-search role="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Шукати товар" aria-label="Пошук товарів"></form><div class="header-search-results" data-header-search-results hidden></div></div>
        <a class="tool-link" href="${prefix}favorites.html" aria-label="Обране">♡<span class="tool-count" data-favorite-count hidden>0</span></a>
        <a class="tool-link" href="${prefix}cart.html" aria-label="Кошик">▣<span class="tool-count" data-cart-count hidden>0</span></a>
        <div class="header-account" data-header-account></div>
      </div>
      <button class="menu-toggle" type="button" aria-label="Відкрити меню" aria-expanded="false" data-menu-toggle><span></span><span></span></button>
    </div></header>`;
  }
  const footer = document.querySelector("[data-site-footer]");
  if (footer)
    footer.innerHTML = `<footer class="site-footer"><div class="footer-main wrap">
    <div class="footer-brand"><a class="brand" href="${prefix}index.html"><span class="brand-mark">${storeName.slice(0, 1)}</span>${storeName}</a><p>Електроніка й інструменти для тих, хто перетворює ідеї на пристрої.</p><a class="footer-contact" href="${prefix}contacts.html">Зв’язатися з командою</a></div>
    <div class="footer-column"><strong>Каталог</strong><a href="${prefix}catalog.html?category=Електронні%20компоненти">Електронні компоненти</a><a href="${prefix}catalog.html?category=Мікроконтролери">Мікроконтролери</a><a href="${prefix}catalog.html?category=Інструменти">Інструменти</a><a href="${prefix}catalog.html?category=Комп’ютери">Комп’ютери</a><a href="${prefix}catalog.html?category=3D-друк">3D-друк</a></div>
    <div class="footer-column"><strong>Покупцям</strong><a href="${prefix}delivery.html">Доставка</a><a href="${prefix}payment.html">Оплата</a><a href="${prefix}warranty.html">Гарантія</a><a href="${prefix}returns.html">Повернення</a></div>
    <div class="footer-column"><strong>Компанія</strong><a href="${prefix}about.html">Про нас</a><a href="${prefix}contacts.html">Контакти</a><a href="${prefix}privacy.html">Конфіденційність</a><a href="https://github.com/adminproxmox-afk/NEXLAB" target="_blank" rel="noreferrer">GitHub · код проєкту ↗</a>${isAdmin() ? `<a href="${prefix}admin/index.html">Для команди</a>` : ""}</div>
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
  root.innerHTML = `<div class="account-control"><button class="account-toggle" type="button" data-account-toggle aria-expanded="false"><span class="account-avatar">${safe(user.name.slice(0, 1).toUpperCase())}</span><span>${safe(user.name)}</span><span aria-hidden="true">⌄</span></button><nav class="account-dropdown" data-account-dropdown hidden aria-label="Меню облікового запису"><a href="${prefix}profile.html">Профіль</a><a href="${prefix}orders.html">Мої замовлення</a><a href="${prefix}favorites.html">Обране</a><a href="${prefix}my-projects.html">Мої проєкти</a><a href="${prefix}profile.html#settings">Налаштування</a>${isAdmin() ? `<a class="admin-menu-link" href="${prefix}admin/index.html">⚙ Панель керування</a>` : ""}<button type="button" data-header-logout>Вийти</button></nav></div>`;
}

export function updateHeaderCounts() {
  const cart = document.querySelector("[data-cart-count]");
  const fav = document.querySelector("[data-favorite-count]");
  if (cart) {
    cart.textContent = cartCount();
    cart.hidden = cartCount() === 0;
  }
  if (fav) {
    fav.textContent = getFavorites().length;
    fav.hidden = getFavorites().length === 0;
  }
}

export function bindLayoutEvents() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const nav = document.querySelector("[data-mobile-nav]");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Закрити меню" : "Відкрити меню");
  });
  const search = document.querySelector("[data-header-search]");
  const searchWrap = search?.closest(".header-search-wrap");
  const searchResults = document.querySelector("[data-header-search-results]");
  let searchRequest = 0;
  search?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = search.querySelector("input").value.trim();
    location.href = `${prefix}catalog.html${query ? `?q=${encodeURIComponent(query)}` : ""}`;
  });
  search?.addEventListener("click", (event) => {
    if (
      window.matchMedia("(max-width: 700px)").matches &&
      !search.classList.contains("is-open")
    ) {
      event.preventDefault();
      search.classList.add("is-open");
      search.querySelector("input").focus();
    }
  });
  search
    ?.querySelector("input")
    ?.addEventListener("focus", () => search.classList.add("is-open"));
  search?.querySelector("input")?.addEventListener("input", async (event) => {
    const query = event.target.value.trim().toLocaleLowerCase("uk-UA");
    const request = ++searchRequest;
    if (query.length < 2) {
      searchResults.hidden = true;
      searchResults.innerHTML = "";
      return;
    }
    const products = await getProducts();
    if (request !== searchRequest) return;
    const found = products
      .filter((product) =>
        [product.name, product.category, product.brand, ...(product.tags || [])]
          .join(" ")
          .toLocaleLowerCase("uk-UA")
          .includes(query),
      )
      .slice(0, 5);
    searchResults.innerHTML = found.length
      ? `<p>Знайдено ${found.length} товарів</p>${found.map((product) => `<a href="${prefix}product.html?id=${encodeURIComponent(product.id)}"><span>${safe(product.category)}</span><strong>${safe(product.name)}</strong><b>${new Intl.NumberFormat("uk-UA").format(product.price)} ₴</b></a>`).join("")}<a class="search-all" href="${prefix}catalog.html?q=${encodeURIComponent(event.target.value.trim())}">Переглянути всі результати →</a>`
      : `<p class="search-empty">Нічого не знайдено. Спробуй іншу назву.</p>`;
    searchResults.hidden = false;
  });
  search?.querySelector("input")?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      searchResults.hidden = true;
      search.classList.remove("is-open");
      event.currentTarget.blur();
    }
  });
  document.addEventListener("click", (event) => {
    if (searchWrap && !searchWrap.contains(event.target)) {
      search.classList.remove("is-open");
      searchResults.hidden = true;
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
      const menu = document.querySelector("[data-account-dropdown]");
      if (menu) menu.hidden = true;
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
