import { getProducts, getProductById } from "./productService.js";
import { productArt } from "./products.js";
import { productCard } from "./product-card.js";
import { addToCart } from "./cart.js";
import { getFavorites, toggleFavorite } from "./favorites.js";
import { toast } from "./notifications.js";
import { initializeReviews } from "./reviews.js";
import { ratingMarkup } from "./rating.js";
import { getComparisonIds } from "../api/comparisonService.js";
import { subscribeToRestock } from "../api/stockAlertService.js";
import { getCurrentUser } from "./session.js";
import { showAuthDialog } from "./authGate.js";
import { formatMoney } from "./i18n.js";

const money = formatMoney;
const safe = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

export async function initializeProductPage() {
  const root = document.querySelector("[data-product-detail]");
  if (!root) return;
  let product = await getProductById(
    new URLSearchParams(location.search).get("id"),
  );
  if (!product) {
    root.innerHTML =
      '<div class="empty-state"><span class="empty-mark">⌕</span><h1>Товар не знайдено</h1><p>Можливо, його вже немає в каталозі.</p><a class="button button-primary" href="catalog.html">До каталогу <span>↗</span></a></div>';
    return;
  }
  document.title = `${product.name} — NEXLAB`;
  const favorite = getFavorites().includes(product.id);
  const compared = getComparisonIds().includes(product.id);
  const thumbs = (product.images.length > 1 ? product.images : [])
    .map(
      (image, index) =>
        `<button type="button" data-gallery-image="${index}" class="${index === 0 ? "is-active" : ""}" aria-label="Зображення ${index + 1}" aria-pressed="${index === 0}">${productArt(product, true, index)}</button>`,
    )
    .join("");
  root.innerHTML = `<div class="detail-gallery"><div class="detail-art" data-gallery-main>${productArt(product, true)}</div><div class="gallery-thumbs">${thumbs}</div><p class="gallery-note">${product.images.length ? `Фото для ознайомлення зі сторінки виробника або продавця; воно не підтверджує фактичну позицію магазину. Відповідність конкретного товару та комплектацію NEXLAB ще не підтвердив.` : `Показано схематичну ілюстрацію; фотографію фактичного товару ще не додано.`}</p></div><div class="detail-content"><div class="detail-copy">
    <div class="breadcrumbs detail-breadcrumb"><a href="index.html">Головна</a><span>/</span><a href="catalog.html">Каталог</a><span>/</span><a href="catalog.html?category=${encodeURIComponent(product.category)}">${safe(product.category)}</a></div>
    <span class="product-category">${safe(product.brand)} · ${safe(product.subcategory)}</span><h1>${safe(product.name)}</h1><p class="product-sku">Артикул ${safe(product.sku)}</p>
    <div class="detail-rating" data-product-rating>${ratingMarkup(product)}</div>
    <div class="detail-price">${money(product.price)}${product.oldPrice ? `<span class="detail-old-price">${money(product.oldPrice)}</span><span class="discount-badge">−${product.discount}%</span>` : ""}</div>
    <p class="detail-stock ${product.stock === 0 ? "detail-out" : ""}">${product.stock > 0 ? `✓ Є в наявності · ${product.stock} шт.` : "Немає в наявності"}</p>${product.stock === 0 ? '<button class="button button-quiet restock-alert-button" type="button" data-stock-alert>Повідомити, коли з’явиться</button>' : ""}
    <p class="detail-description">${safe(product.description)}</p><div class="detail-tags">${product.tags.map((tag) => `<span>${safe(tag)}</span>`).join("")}</div>
    <div class="detail-actions"><div class="detail-quantity"><button type="button" data-detail-quantity="-1" aria-label="Зменшити кількість">−</button><span data-detail-quantity-value>1</span><button type="button" data-detail-quantity="1" aria-label="Збільшити кількість">+</button></div><button class="button button-primary" type="button" data-detail-add ${product.stock === 0 ? "disabled" : ""}>До кошика <span>＋</span></button>
    <button class="favorite-button ${favorite ? "is-favorite" : ""}" type="button" data-detail-favorite aria-label="${favorite ? "Прибрати з обраного" : "Додати до обраного"}" aria-pressed="${favorite}">${favorite ? "♥" : "♡"}</button><button class="button button-quiet" type="button" data-compare="${safe(product.id)}" aria-pressed="${compared}">${compared ? "Прибрати з порівняння" : "Порівняти"}</button></div>
    <div class="detail-specs"><h2>Характеристики</h2>${Object.entries(
      product.specifications,
    )
      .map(
        ([name, value]) =>
          `<div><span>${safe(name)}</span><span>${safe(value)}</span></div>`,
      )
      .join("")}</div></div>
    <section class="similar-products"><div class="section-heading"><div><p class="eyebrow">До цього проєкту</p><h2>Схожі товари</h2></div><a class="text-link" href="catalog.html?category=${encodeURIComponent(product.category)}">До категорії <span>↗</span></a></div><div class="product-grid">${(
      await getProducts()
    )
      .filter(
        (item) => item.category === product.category && item.id !== product.id,
      )
      .slice(0, 4)
      .map(productCard)
      .join(
        "",
      )}</div></section><section class="review-section" data-reviews></section></div>`;
  await initializeReviews(product);
  let quantity = 1;
  root.addEventListener("click", (event) => {
    const stockAlert = event.target.closest("[data-stock-alert]");
    if (stockAlert) {
      if (!getCurrentUser()) {
        showAuthDialog();
        return;
      }
      stockAlert.disabled = true;
      subscribeToRestock(product.id)
        .then(() => {
          stockAlert.textContent = "Стежимо за наявністю";
          toast("Повідомимо в цьому акаунті, коли товар з’явиться.");
        })
        .catch((error) => {
          if (error.message === "PRODUCT_ALREADY_AVAILABLE" && Number.isInteger(error.stock)) {
            product.stock = error.stock;
            const stockLabel = root.querySelector(".detail-stock");
            stockLabel?.classList.remove("detail-out");
            if (stockLabel) stockLabel.textContent = `✓ Є в наявності · ${error.stock} шт.`;
            root.querySelector("[data-detail-add]")?.removeAttribute("disabled");
            stockAlert.remove();
            toast("Товар уже є в наявності.");
            return;
          }
          stockAlert.disabled = false;
          toast(error.message === "PRODUCT_ALREADY_AVAILABLE" ? "Товар уже є в наявності." : "Не вдалося підписатися. Спробуй ще раз.");
        });
      return;
    }
    const qtyButton = event.target.closest("[data-detail-quantity]");
    if (qtyButton) {
      quantity = Math.max(
        1,
        Math.min(
          Math.max(1, product.stock),
          quantity + Number(qtyButton.dataset.detailQuantity),
        ),
      );
      root.querySelector("[data-detail-quantity-value]").textContent = quantity;
    }
    if (event.target.closest("[data-detail-add]")) {
      const added = addToCart(product, quantity);
      if (added) toast(`${product.name} додано до кошика (${added} шт.)`);
    }
    const favoriteButton = event.target.closest("[data-detail-favorite]");
    if (favoriteButton) {
      const saved = toggleFavorite(product.id);
      favoriteButton.classList.toggle("is-favorite", saved);
      favoriteButton.setAttribute("aria-pressed", String(saved));
      favoriteButton.setAttribute(
        "aria-label",
        saved ? "Прибрати з обраного" : "Додати до обраного",
      );
      favoriteButton.textContent = saved ? "♥" : "♡";
      toast(saved ? "Додано до обраного" : "Прибрано з обраного");
    }
    const thumb = event.target.closest("[data-gallery-image]");
    if (thumb) {
      root
        .querySelectorAll("[data-gallery-image]")
        .forEach((button) => {
          button.classList.toggle("is-active", button === thumb);
          button.setAttribute("aria-pressed", String(button === thumb));
        });
      root.querySelector("[data-gallery-main]").innerHTML = productArt(
        product,
        true,
        Number(thumb.dataset.galleryImage),
      );
    }
  });
}
