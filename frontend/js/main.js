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
import { consumeAvailableStockAlerts } from "../api/stockAlertService.js";
import { initializeCommunityProjects } from "./community-projects.js";

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
  const update = () => {
    if (!navigator.onLine) {
      wasOffline = true;
      notice.innerHTML = `<span>Немає з’єднання. Доступні лише збережені сторінки й локальний каталог.</span><a href="${new URL("../offline.html", import.meta.url).href}">Детальніше</a>`;
      notice.hidden = false;
    } else if (wasOffline) {
      notice.innerHTML = '<span>З’єднання відновлено. Онови дані перед оформленням замовлення.</span><button type="button" data-connection-reload>Оновити сторінку</button>';
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
  try {
    const availableAlerts = await consumeAvailableStockAlerts(products);
    if (availableAlerts.length)
      toast(`Знову в наявності: ${availableAlerts.map((item) => item.name).join(", ")}`);
  } catch (error) {
    if (error.message !== "UNAUTHENTICATED" && error.message !== "BACKEND_UNAVAILABLE")
      console.warn("Restock alerts could not be loaded", error);
  }
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
