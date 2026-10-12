import { getFavorites, toggleFavorite } from "./favorites.js";
import { productArt, products } from "./products.js";
import { toast } from "./notifications.js";
const CART_KEY = "nexlab-cart-v1";
function readCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(saved)) return [];
    const quantities = new Map();
    for (const row of saved) {
      if (!row || !Number.isInteger(row.quantity) || row.quantity < 1) continue;
      quantities.set(row.id, (quantities.get(row.id) || 0) + row.quantity);
    }
    return [...quantities].flatMap(([id, quantity]) => {
      const product = products.find((item) => item.id === id);
      return product?.stock > 0
        ? [{ ...product, quantity: Math.min(quantity, product.stock) }]
        : [];
    });
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify(cart.map(({ id, quantity }) => ({ id, quantity }))),
  );
  window.dispatchEvent(new Event("nexlab:cart-updated"));
}
export function reconcileCart() {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    if (!Array.isArray(saved)) return;
    let removed = 0,
      reduced = 0;
    const cart = readCart();
    for (const row of saved) {
      if (!row || !Number.isInteger(row.quantity) || row.quantity < 1) continue;
      const product = products.find((item) => item.id === row.id),
        current = cart.find((item) => item.id === row.id);
      if (!product || product.stock < 1) removed++;
      else if (!current || current.quantity < row.quantity) reduced++;
    }
    const normalized = cart.map(({ id, quantity }) => ({ id, quantity }));
    if (JSON.stringify(saved) !== JSON.stringify(normalized)) saveCart(cart);
    if (removed || reduced)
      toast(
        removed && reduced
          ? "Кошик оновлено: частину товарів прибрано або зменшено кількість."
          : removed
            ? "Недоступні товари прибрано з кошика."
            : "Кількість у кошику скориговано за актуальними залишками.",
      );
  } catch {
    /* Keep the page usable when browser storage is unavailable or corrupted. */
  }
}
export { getFavorites, toggleFavorite };
export const getCart = readCart;
export const cartCount = () =>
  readCart().reduce((sum, row) => sum + row.quantity, 0);
export const cartSubtotal = () =>
  readCart().reduce(
    (sum, row) =>
      sum + Math.max(row.oldPrice || row.price, row.price) * row.quantity,
    0,
  );
export const cartDiscount = () => cartSubtotal() - cartTotal();
export const cartTotal = () =>
  readCart().reduce((sum, row) => sum + row.price * row.quantity, 0);
export function addToCart(product, quantity = 1) {
  const currentProduct = products.find((item) => item.id === product?.id);
  if (
    !currentProduct ||
    currentProduct.stock <= 0 ||
    !Number.isInteger(quantity) ||
    quantity < 1
  )
    return 0;
  const cart = readCart(),
    row = cart.find((item) => item.id === product.id),
    current = row?.quantity || 0;
  const added = Math.min(quantity, Math.max(0, currentProduct.stock - current));
  if (!added) {
    toast("У кошику вже максимально доступна кількість");
    return 0;
  }
  if (row) row.quantity += added;
  else cart.push({ ...currentProduct, quantity: added });
  saveCart(cart);
  if (added < quantity) toast("Додано " + added + " шт. — решта недоступна");
  return added;
}
export function changeQuantity(id, delta) {
  if (!Number.isInteger(delta)) return;
  saveCart(
    readCart().map((row) =>
      row.id === id
        ? {
            ...row,
            quantity: Math.min(row.stock, Math.max(1, row.quantity + delta)),
          }
        : row,
    ),
  );
}
export function removeFromCart(id) {
  saveCart(readCart().filter((row) => row.id !== id));
}
export function clearCart() {
  saveCart([]);
}
const money = (value) => new Intl.NumberFormat("uk-UA").format(value) + " ₴";
const safe = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export function renderCartPage() {
  const root = document.querySelector("[data-cart-items]"),
    summary = document.querySelector("[data-cart-summary]");
  if (!root || !summary) return;
  const cart = readCart();
  document.querySelector("[data-cart-title-count]").textContent = cart.length
    ? "(" + cartCount() + ")"
    : "";
  if (!cart.length) {
    root.innerHTML =
      '<div class="cart-empty"><span class="empty-mark">▣</span><h2>Твій кошик поки порожній</h2><p>Обери компоненти для своєї наступної ідеї.</p><a class="button button-primary" href="catalog.html">До каталогу ↗</a></div>';
    summary.innerHTML = "";
    return;
  }
  root.innerHTML = cart
    .map(
      (row) =>
        `<article class="cart-row"><a href="product.html?id=${encodeURIComponent(row.id)}">${productArt(row)}</a><div><h3>${safe(row.name)}</h3><span class="product-category">${safe(row.category)}</span><div class="cart-row-price">${money(row.price)}${row.oldPrice > row.price ? `<del>${money(row.oldPrice)}</del>` : ""}</div><div class="quantity-control"><button type="button" data-quantity="${safe(row.id)}" data-delta="-1" aria-label="Зменшити кількість" ${row.quantity <= 1 ? "disabled" : ""}>−</button><span>${row.quantity}</span><button type="button" data-quantity="${safe(row.id)}" data-delta="1" aria-label="Збільшити кількість" ${row.quantity >= row.stock ? "disabled" : ""}>+</button></div></div><button class="remove-button" type="button" data-remove="${safe(row.id)}">Видалити</button></article>`,
    )
    .join("");
  summary.innerHTML = `<h2>Разом</h2><div class="summary-row"><span>Кількість товарів</span><span>${cartCount()}</span></div><div class="summary-row"><span>Вартість товарів</span><span>${money(cartSubtotal())}</span></div><div class="summary-row"><span>Знижка</span><span>− ${money(cartDiscount())}</span></div><div class="summary-row summary-total"><span>Товари до сплати</span><span>${money(cartTotal())}</span></div><a class="button button-primary" href="checkout.html">Перейти до оформлення ↗</a><p class="cart-note">Доставка оплачується окремо за тарифом перевізника.</p>`;
}
export function bindCartPage() {
  document.addEventListener("click", (event) => {
    const quantity = event.target.closest("[data-quantity]");
    if (quantity)
      changeQuantity(quantity.dataset.quantity, Number(quantity.dataset.delta));
    const remove = event.target.closest("[data-remove]");
    if (remove) {
      removeFromCart(remove.dataset.remove);
      toast("Товар видалено з кошика");
    }
  });
}
