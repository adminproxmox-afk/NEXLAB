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
import { isFirebaseConfigured } from "../api/firebaseAuth.js";
import { getCoupon, getBundlePromotion } from "../api/promotionService.js";
import { formatMoney } from "./i18n.js";
const money = formatMoney;
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
  const couponInput = form.querySelector("[data-coupon-code]");
  const couponMessage = form.querySelector("[data-coupon-message]");
  const applyCouponButton = form.querySelector("[data-apply-coupon]");
  let appliedCoupon = null;
  let bundlePromotion = await getBundlePromotion(getCart()).catch(() => ({ discount: 0, promotions: [] }));
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
    const couponDiscount = appliedCoupon?.discount || 0;
    summary.innerHTML = items.length
      ? `<h2>Твоє замовлення</h2>${items.map((item) => `<div class="summary-row"><span>${safe(item.name)} × ${item.quantity}</span><strong>${money(item.price * item.quantity)}</strong></div>`).join("")}${bundlePromotion.promotions.map((promotion) => `<div class="summary-row"><span>Комплект «${safe(promotion.name)}» · −${promotion.percent}%</span><span>− ${money(promotion.discount)}</span></div>`).join("")}${appliedCoupon ? `<div class="summary-row"><span>Купон ${safe(appliedCoupon.code)} · −${appliedCoupon.percent}%</span><span>− ${money(couponDiscount)}</span></div>` : ""}<div class="summary-row"><span>Знижка загалом</span><span>− ${money(cartDiscount() + bundlePromotion.discount + couponDiscount)}</span></div><div class="summary-row summary-total"><span>Товари до сплати</span><strong>${money(Math.max(0, cartTotal() - bundlePromotion.discount - couponDiscount))}</strong></div><p>${safe(settings.priceNote)} Доставку оплачуй за тарифом перевізника. Онлайн-оплата не підключена.</p>${isFirebaseConfigured() ? "<p>Це заявка на замовлення. Магазин перевірить актуальні ціни й наявність перед підтвердженням.</p>" : ""}<a class="text-link" href="cart.html">Повернутися до кошика</a>`
      : '<h2>Кошик порожній</h2><a class="button button-primary" href="catalog.html">До каталогу</a>';
    form.querySelector('button[type="submit"]').disabled = !items.length;
    applyCouponButton.textContent = appliedCoupon ? "Скасувати" : "Застосувати";
  }
  render();
  applyCouponButton.addEventListener("click", async () => {
    if (appliedCoupon) {
      appliedCoupon = null;
      couponInput.value = "";
      couponMessage.textContent = "Купон скасовано.";
      render();
      return;
    }
    applyCouponButton.disabled = true;
    couponMessage.textContent = "Перевіряємо купон…";
    try {
      const coupon = await getCoupon(couponInput.value, cartTotal(), bundlePromotion.discount);
      appliedCoupon = coupon;
      couponInput.value = coupon.code;
      couponMessage.textContent = `Купон застосовано: знижка ${coupon.percent}% (${money(coupon.discount)}).`;
      render();
    } catch (error) {
      couponMessage.textContent = error.message === "COUPON_MINIMUM_NOT_MET"
        ? "Кошик не досягає мінімальної суми для цього купона."
        : error.message === "COUPON_INVALID"
          ? "Купон не знайдено, він вимкнений або його ліміт вичерпано."
          : "Не вдалося перевірити купон. Перевір з’єднання та спробуй ще раз.";
    } finally { applyCouponButton.disabled = false; }
  });
  couponInput.addEventListener("input", () => {
    if (appliedCoupon && couponInput.value.trim().toUpperCase() !== appliedCoupon.code) {
      appliedCoupon = null;
      couponMessage.textContent = "Змінив код — застосуй купон ще раз.";
      render();
    }
  });
  window.addEventListener("nexlab:cart-updated", async () => {
    bundlePromotion = await getBundlePromotion(getCart()).catch(() => ({ discount: 0, promotions: [] }));
    if (appliedCoupon) {
      try { appliedCoupon = await getCoupon(appliedCoupon.code, cartTotal(), bundlePromotion.discount); }
      catch { appliedCoupon = null; couponMessage.textContent = "Умови купона змінилися. Застосуй його ще раз."; }
    }
    render();
  });
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
      bundlePromotion = await getBundlePromotion(items).catch(() => ({ discount: 0, promotions: [] }));
      const payload = JSON.stringify({
        items: items.map(({ id, quantity, price }) => ({
          id,
          quantity,
          price,
        })),
        delivery,
        couponCode: appliedCoupon?.code || "",
        bundleDiscount: bundlePromotion.discount,
        bundlePromotions: bundlePromotion.promotions,
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
      const order = await createOrder({
        items,
        delivery,
        requestKey,
        couponCode: appliedCoupon?.code || "",
        bundleDiscount: bundlePromotion.discount,
        bundlePromotions: bundlePromotion.promotions,
      });
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
        COUPON_INVALID: "Купон більше не діє або його ліміт використань вичерпано. Перевір кошик і застосуй інший купон.",
        COUPON_MINIMUM_NOT_MET: "Сума кошика більше не відповідає умовам купона.",
      };
      message.textContent =
        messages[error.message] ||
        (error.code === "permission-denied" ||
        error.code === "firestore/permission-denied"
          ? "Firebase відхилив запис. Опублікуй актуальні правила з firebase/firestore.rules у Firebase Console і спробуй знову."
          : "Не вдалося зберегти замовлення. Спробуй ще раз.");
      if (["COUPON_INVALID", "COUPON_MINIMUM_NOT_MET"].includes(error.message)) {
        appliedCoupon = null;
        couponMessage.textContent = messages[error.message];
      }
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
