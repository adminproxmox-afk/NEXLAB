import {
  getCart,
  cartTotal,
  cartDiscount,
  clearCart,
  reconcileCart,
} from "./cart.js";
import { refreshProducts } from "../api/productService.js";
import { createOrder } from "../api/orderService.js";
import { getCurrentUser } from "./session.js";
import { shopConfig } from "./shop-config.js";
const money = (value) => new Intl.NumberFormat("uk-UA").format(value) + " ₴";
const safe = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
export async function initializeCheckout(settings = shopConfig) {
  const form = document.querySelector("[data-checkout-form]");
  if (!form) return;
  await refreshProducts();
  reconcileCart();
  const summary = document.querySelector("[data-checkout-summary]"),
    message = document.querySelector("[data-checkout-message]");
  form.elements.name.value = getCurrentUser()?.name || "";
  form.elements.carrier.innerHTML = settings.deliveryMethods
    .map(
      (item) =>
        '<option value="' +
        safe(item.id) +
        '">' +
        safe(item.name) +
        "</option>",
    )
    .join("");
  form.elements.payment.innerHTML = settings.paymentMethods
    .map(
      (item) =>
        '<option value="' +
        safe(item.id) +
        '">' +
        safe(item.name) +
        "</option>",
    )
    .join("");
  let requestKey = crypto.randomUUID();
  function render() {
    const items = getCart();
    summary.innerHTML = items.length
      ? `<h2>Твоє замовлення</h2>${items.map((item) => `<div class="summary-row"><span>${safe(item.name)} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("")}<div class="summary-row"><span>Знижка</span><span>− ${money(cartDiscount())}</span></div><div class="summary-row summary-total"><span>Товари до сплати</span><strong>${money(cartTotal())}</strong></div><p>${safe(settings.priceNote)} Доставку оплачуй за тарифом перевізника. Онлайн-оплата не підключена.</p><a class="text-link" href="cart.html">Повернутися до кошика</a>`
      : '<h2>Кошик порожній</h2><a class="button button-primary" href="catalog.html">До каталогу</a>';
    form.querySelector('button[type="submit"]').disabled = !items.length;
  }
  render();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.dataset.busy === "yes") return;
    message.textContent = "";
    if (!form.reportValidity()) return;
    const delivery = Object.fromEntries(new FormData(form));
    delivery.phone = delivery.phone.replace(/[\s()-]/g, "");
    if (!/^\+?380\d{9}$/.test(delivery.phone)) {
      message.textContent = "Введи український номер у форматі +380XXXXXXXXX.";
      form.elements.phone.focus();
      return;
    }
    const items = getCart();
    if (!items.length) {
      render();
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    form.dataset.busy = "yes";
    button.disabled = true;
    button.textContent = "Зберігаємо замовлення…";
    try {
      const payload = JSON.stringify({
        items: items.map(({ id, quantity, price }) => ({
          id,
          quantity,
          price,
        })),
        delivery,
      });
      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(payload),
      );
      const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      try {
        const previous = JSON.parse(
          sessionStorage.getItem("nexlab-checkout-attempt") || "null",
        );
        if (previous?.fingerprint === fingerprint)
          requestKey = previous.requestKey;
        else requestKey = crypto.randomUUID();
        sessionStorage.setItem(
          "nexlab-checkout-attempt",
          JSON.stringify({ fingerprint, requestKey }),
        );
      } catch {
        /* Storage can be unavailable; the current page still retains its retry key. */
      }
      const order = await createOrder({ items, delivery, requestKey });
      sessionStorage.removeItem("nexlab-checkout-attempt");
      clearCart();
      location.href = "orders.html?created=" + encodeURIComponent(order.id);
    } catch (error) {
      const messages = {
        OUT_OF_STOCK:
          "Кількість товарів змінилася. Перевір оновлене замовлення та підтвердь його ще раз.",
        PRICE_CHANGED:
          "Ціна товарів змінилася. Перевір оновлену суму перед підтвердженням.",
        UNAUTHENTICATED: "Сесія завершилася. Увійди ще раз.",
        INVALID_PHONE: "Перевір номер телефону.",
      };
      message.textContent =
        messages[error.message] ||
        "Не вдалося зберегти замовлення. Спробуй ще раз.";
      if (error.status === 409) {
        sessionStorage.removeItem("nexlab-checkout-attempt");
        try {
          await refreshProducts();
          reconcileCart();
        } catch {
          message.textContent +=
            " Не вдалося оновити каталог. Перевір з’єднання.";
        }
        requestKey = crypto.randomUUID();
      }
      if (error.status === 401) {
        location.href = "login.html?redirect=checkout.html";
        return;
      }
    } finally {
      form.dataset.busy = "";
      button.textContent = "Підтвердити замовлення";
      render();
    }
  });
}
