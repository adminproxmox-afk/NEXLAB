import { getComparisonIds, toggleComparison, clearComparison } from "../api/comparisonService.js";
import { getProductById } from "../api/productService.js";
import { productArt } from "./products.js";
import { addToCart } from "./cart.js";
import { toast } from "./notifications.js";
import { formatMoney } from "./i18n.js";

const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
);
const money = formatMoney;

export async function initializeComparisonPage() {
  const root = document.querySelector("[data-comparison-page]");
  if (!root) return;
  async function render() {
    const products = (await Promise.all(getComparisonIds().map(getProductById))).filter(Boolean);
    if (!products.length) {
      root.innerHTML = '<div class="empty-state"><span class="empty-mark">⇄</span><h1>Поки немає товарів для порівняння</h1><p>Додай до чотирьох товарів у каталозі й порівняй характеристики поруч.</p><a class="button button-primary" href="catalog.html">Відкрити каталог</a></div>';
      return;
    }
    const specNames = [...new Set(products.flatMap((product) => Object.keys(product.specifications || {})))];
    const rows = [
      ["Ціна", (product) => money(product.price)],
      ["Наявність", (product) => product.stock > 0 ? `Є · ${product.stock} шт.` : "Немає"],
      ["Бренд", (product) => product.brand],
      ["Категорія", (product) => product.category],
      ["Рейтинг", (product) => product.reviewsCount ? `${product.rating} / 5 · ${product.reviewsCount} відгуків` : "Ще немає відгуків"],
      ...specNames.map((name) => [name, (product) => product.specifications?.[name] || "—"]),
    ];
    root.innerHTML = `<div class="comparison-heading"><div><p class="eyebrow">ОБЕРИ СВОЇ КОМПОНЕНТИ</p><h1>Порівняння товарів</h1><p>Порівняй ціни, наявність і характеристики поруч.</p></div><button class="button button-quiet" type="button" data-comparison-clear>Очистити список</button></div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th scope="col">Характеристика</th>${products.map((product) => `<th scope="col"><div class="comparison-product">${productArt(product)}<strong>${safe(product.name)}</strong><button class="button button-quiet" type="button" data-comparison-remove="${safe(product.id)}">Прибрати</button><button class="button button-primary" type="button" data-add="${safe(product.id)}" ${product.stock <= 0 ? "disabled" : ""}>До кошика</button></div></th>`).join("")}</tr></thead><tbody>${rows.map(([label, read]) => `<tr><th scope="row">${safe(label)}</th>${products.map((product) => `<td>${safe(read(product))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }
  root.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-comparison-remove]");
    if (remove) {
      toggleComparison(remove.dataset.comparisonRemove);
      render();
    }
    if (event.target.closest("[data-comparison-clear]")) {
      clearComparison();
      render();
    }
    const add = event.target.closest("[data-add]");
    if (add) getProductById(add.dataset.add).then((product) => {
      if (product && addToCart(product)) toast(`${product.name} додано до кошика`);
    });
  });
  await render();
}
