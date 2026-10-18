import {
  getProducts,
  getCategories,
  getProductById,
  loadShopSettings,
  getFirebaseCatalogWarning,
} from "./productService.js";
import { getFirebaseProjectsWarning } from "./projectService.js";
import { isFirebaseConfigured } from "../api/firebaseAuth.js";
import { productCard } from "./product-card.js";
import { initializeCatalog } from "./catalog.js";
import { initializeProductPage } from "./product-page.js";
import {
  renderHomeProjects,
  initializeProjectPage,
  initializeProjectsDirectory,
} from "./projects-page.js";
import {
  addToCart,
  renderCartPage,
  bindCartPage,
  reconcileCart,
} from "./cart.js";
import { toggleFavorite } from "./favorites.js";
import {
  renderSharedLayout,
  bindLayoutEvents,
  toast,
  updateHeaderCounts,
} from "./ui.js";
import { initializeUsers } from "./users.js";
import { initializeAuthForms } from "./auth.js";
import { protectCurrentPage } from "./routeProtection.js";
import { initializeProfile } from "./profile.js";
import { initializeOrdersPage } from "./orders.js";
import { initializeMyProjects } from "./projects.js";
import { getCurrentUser } from "./session.js";
import { initializeCheckout } from "./checkout.js";
import { initializeInfoPage } from "./info-page.js";
import { initializeAdmin } from "./admin.js";
import { toggleComparison } from "../api/comparisonService.js";
import { initializeComparisonPage } from "./comparison.js";
import { initializeCommunityProjects } from "./community-projects.js";
import { initializeOrderNotifications } from "./order-notifications.js";
import { initializeStockAlertNotifications } from "./stock-alert-notifications.js";
import { currentLanguage } from "./i18n.js";

const escapeHTML = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

function initializeConnectionNotice() {
  if (typeof navigator === "undefined") return;
  const notice = document.createElement("div");
  notice.className = "connection-notice";
  notice.setAttribute("role", "status");
  notice.setAttribute("aria-live", "polite");
  notice.hidden = true;
  document.body.prepend(notice);
  let wasOffline = !navigator.onLine;
  let backendUnavailable = false;
  let dismissTimer;
  const messages = {
    uk: {
      offline: "Немає з’єднання. Доступні лише збережені сторінки й локальний каталог.",
      unavailable: "Сервер тимчасово недоступний. Дані не збережуться, поки він не відновиться.",
      restored: "Сервер знову доступний. Перевір, чи збереглася остання дія, перш ніж повторювати її.",
      browserRestored: "З’єднання відновлено. Онови сторінку, щоб завантажити актуальні дані.",
      reload: "Оновити сторінку",
      more: "Детальніше",
    },
    ru: {
      offline: "Нет соединения. Доступны только сохранённые страницы и локальный каталог.",
      unavailable: "Сервер временно недоступен. Данные не сохранятся, пока он не восстановится.",
      restored: "Сервер снова доступен. Проверь, сохранилось ли последнее действие, прежде чем повторять его.",
      browserRestored: "Соединение восстановлено. Обнови страницу, чтобы загрузить актуальные данные.",
      reload: "Обновить страницу",
      more: "Подробнее",
    },
    en: {
      offline: "You are offline. Only saved pages and the local catalog are available.",
      unavailable: "The server is temporarily unavailable. Changes will not be saved until it recovers.",
      restored: "The server is available again. Check whether your last action was saved before repeating it.",
      browserRestored: "Connection restored. Refresh the page to load current data.",
      reload: "Refresh page",
      more: "More information",
    },
  };
  let serverRestored = false;
  const update = () => {
    const copy = messages[currentLanguage()] || messages.uk;
    clearTimeout(dismissTimer);
    if (!navigator.onLine) {
      wasOffline = true;
      notice.innerHTML = `<span>${copy.offline}</span><a href="${new URL("../offline.html", import.meta.url).href}">${copy.more}</a>`;
      notice.hidden = false;
    } else if (backendUnavailable) {
      notice.textContent = copy.unavailable;
      notice.hidden = false;
    } else if (serverRestored) {
      serverRestored = false;
      wasOffline = false;
      notice.textContent = copy.restored;
      notice.hidden = false;
      dismissTimer = window.setTimeout(() => { notice.hidden = true; }, 8_000);
    } else if (wasOffline) {
      wasOffline = false;
      notice.innerHTML = `<span>${copy.browserRestored}</span><button type="button" data-connection-reload>${copy.reload}</button>`;
      notice.hidden = false;
    } else {
      notice.hidden = true;
    }
  };
  notice.addEventListener("click", (event) => {
    if (event.target.closest("[data-connection-reload]")) location.reload();
  });
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  window.addEventListener("nexlab:backend-connection", (event) => {
    backendUnavailable = !event.detail?.available;
    if (!backendUnavailable) serverRestored = true;
    update();
  });
  update();
}

function registerOfflineSupport() {
  if (!("serviceWorker" in navigator)) return;
  const worker = new URL("../service-worker.js", import.meta.url);
  const scope = new URL("../", import.meta.url).pathname;
  navigator.serviceWorker.register(worker, { scope }).catch((error) => {
    console.info("Offline cache could not be registered", error);
  });
}

function registerProjectCoverFallbacks() {
  document.addEventListener("error", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    if (image.matches("[data-cover-photo]")) {
      image.hidden = true;
      return;
    }
    if (image.dataset.loadFailed) return;
    image.dataset.loadFailed = "true";
    image.hidden = true;
    const parent = image.parentElement;
    if (!parent || parent.querySelector(".image-load-fallback")) return;
    parent.classList.add("has-image-load-error");
    parent.querySelector(".photo-source-label")?.remove();
    const fallback = document.createElement("span");
    fallback.className = "image-load-fallback";
    fallback.setAttribute("role", "status");
    fallback.textContent = "Фото тимчасово недоступне";
    parent.append(fallback);
  }, true);
}

function renderHomeCategories(categories) {
  const root = document.querySelector("[data-categories]");
  if (root)
    root.innerHTML = categories
      .map(
        (category) =>
          `<a class="category-card" href="catalog.html?category=${encodeURIComponent(category.name)}"><span class="category-arrow">↗</span><span class="category-icon" aria-hidden="true">${category.icon}</span><strong>${escapeHTML(category.name)}</strong><small>${escapeHTML(category.desc)}</small></a>`,
      )
      .join("");
}

function bindProductButtons() {
  document.addEventListener("click", async (event) => {
    const addButton = event.target.closest("[data-add]");
    if (addButton) {
      const product = await getProductById(addButton.dataset.add);
      if (product && addToCart(product))
        toast(`${product.name} додано до кошика`);
    }
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) {
      const saved = toggleFavorite(favoriteButton.dataset.favorite);
      document.querySelectorAll("[data-favorite]").forEach((button) => {
        if (button.dataset.favorite !== favoriteButton.dataset.favorite) return;
        button.classList.toggle("is-favorite", saved);
        button.setAttribute("aria-pressed", String(saved));
        button.setAttribute(
          "aria-label",
          saved ? "Прибрати з обраного" : "Додати до обраного",
        );
        button.textContent = saved ? "♥" : "♡";
      });
      toast(saved ? "Додано до обраного" : "Прибрано з обраного");
    }
    const compareButton = event.target.closest("[data-compare]");
    if (compareButton) {
      try {
        const ids = toggleComparison(compareButton.dataset.compare);
        document.querySelectorAll("[data-compare]").forEach((button) => {
          const selected = ids.includes(button.dataset.compare);
          button.setAttribute("aria-pressed", String(selected));
          button.classList.toggle("is-compared", selected);
          if (button.classList.contains("compare-toggle")) {
            button.setAttribute("aria-label", selected ? "Прибрати з порівняння" : "Додати до порівняння");
          } else {
            button.textContent = selected ? "Прибрати з порівняння" : "Порівняти";
          }
        });
        updateHeaderCounts();
        toast(ids.includes(compareButton.dataset.compare) ? "Товар додано до порівняння" : "Товар прибрано з порівняння");
      } catch (error) {
        if (error.message === "COMPARISON_LIMIT") toast("Можна порівняти не більше чотирьох товарів.");
        else throw error;
      }
    }
  });
}

async function start() {
  initializeConnectionNotice();
  registerOfflineSupport();
  registerProjectCoverFallbacks();
  initializeOrderNotifications();
  try {
    await initializeUsers();
  } catch (error) {
    console.error("NEXLAB session initialization failed", error);
  }
  const settings = await loadShopSettings();
  renderSharedLayout(settings);
  bindLayoutEvents();
  initializeAuthForms();
  initializeInfoPage(settings);
  if (!protectCurrentPage()) return;
  bindProductButtons();
  bindCartPage();
  if (location.pathname.toLowerCase().includes("/admin/")) {
    const welcome = document.querySelector("[data-admin-welcome]");
    if (welcome)
      welcome.textContent = `Вітаємо, ${getCurrentUser()?.name || "Адміністратор"}`;
  }
  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);
  initializeStockAlertNotifications();
  reconcileCart();
  renderHomeCategories(categories);
  const featured = document.querySelector('[data-products="featured"]');
  if (featured)
    featured.innerHTML = products
      .filter((product) => product.featured)
      .slice(0, 4)
      .map(productCard)
      .join("");
  await Promise.all([
    initializeCatalog(),
    initializeProductPage(),
    initializeProjectPage(),
    initializeProjectsDirectory(),
    renderHomeProjects(),
    initializeProfile(),
    initializeOrdersPage(),
    initializeMyProjects(),
    initializeCheckout(settings),
    initializeAdmin(),
    initializeComparisonPage(),
    initializeCommunityProjects(),
  ]);
  renderCartPage();
  const dataWarnings = [
    getFirebaseCatalogWarning(),
    getFirebaseProjectsWarning(),
  ].filter(Boolean);
  if (dataWarnings.length)
    document
      .querySelector("main")
      ?.insertAdjacentHTML(
        "afterbegin",
        `<p class="service-error" role="status">${dataWarnings.join(" ")}</p>`,
      );
  window.addEventListener("nexlab:cart-updated", renderCartPage);
  window.addEventListener("nexlab:favorites-updated", updateHeaderCounts);
  window.addEventListener("nexlab:comparison-updated", updateHeaderCounts);
  window.addEventListener("storage", (event) => {
    updateHeaderCounts();
    renderCartPage();
    if (
      event.key === "nexlab_guest_favorites" ||
      event.key?.startsWith("nexlab_favorites_")
    )
      window.dispatchEvent(new Event("nexlab:favorites-updated"));
  });
}

start().catch((error) => {
  console.error(error);
  const main = document.querySelector("main");
  if (main)
    main.insertAdjacentHTML(
      "afterbegin",
      isFirebaseConfigured()
        ? '<p class="service-error" role="alert">Не вдалося завантажити дані Firebase. Перевір з’єднання, створення Firestore та опубліковані правила firebase/firestore.rules.</p>'
        : '<p class="service-error" role="alert">Не вдалося з’єднатися з магазином. Запусти сервер NEXLAB і онови сторінку.</p>',
    );
});
