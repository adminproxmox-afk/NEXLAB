import { getOrders, requestOrderReturn } from "../api/orderService.js";
import { getCurrentUser } from "./session.js";
import { toast } from "./notifications.js";
import { formatDate, formatMoney } from "./i18n.js";

const money = formatMoney;
const date = (value) => formatDate(value, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const dateTime = (value) => formatDate(value, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
);
const statuses = {
  processing: ["В обробці", "status-pending"],
  confirmed: ["Підтверджено", "status-pending"],
  shipped: ["Передано перевізнику", "status-pending"],
  delivered: ["Доставлено", "status-done"],
  cancelled: ["Скасовано", "status-cancelled"],
  returned: ["Повернення прийнято", "status-done"],
};

export async function initializeOrdersPage() {
  const root = document.querySelector("[data-orders]");
  if (!root) return;
  root.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-order-return]");
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const output = form.querySelector("[data-return-status]");
    button.disabled = true;
    output.textContent = "Надсилання…";
    try {
      const requestData = await requestOrderReturn(form.dataset.orderReturn, form.elements.reason.value);
      form.outerHTML = `<section class="order-return-status" aria-live="polite"><strong>Заявку на повернення надіслано</strong><p>${safe(requestData.reason)}</p></section>`;
    } catch (error) {
      output.textContent = error.message === "RETURN_NOT_AVAILABLE"
        ? "Заявку можна подати після доставки замовлення."
        : error.message === "RETURN_ALREADY_REQUESTED"
          ? "Ця заявка вже очікує рішення. Онови історію замовлень."
          : "Не вдалося надіслати заявку. Перевір з’єднання та спробуй ще раз.";
      button.disabled = false;
    }
  });
  const orders = await getOrders();
  const userId = getCurrentUser()?.id;
  if (userId) {
    const key = `nexlab_seen_order_statuses_${userId}`;
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
    const changed = [];
    for (const order of orders) {
      const history = Array.isArray(order.statusHistory) && order.statusHistory.length
        ? order.statusHistory
        : [{ status: order.status, date: order.date }];
      const previous = seen[order.id];
      let newEvents = [];
      if (previous && typeof previous === "object" && Number.isInteger(previous.historyLength)) {
        newEvents = history.slice(previous.historyLength);
      } else if (typeof previous === "string" && previous !== order.status) {
        newEvents = [{ status: order.status }];
      }
      if (newEvents.length) changed.push({ order, event: newEvents.at(-1) });
      seen[order.id] = { status: order.status, historyLength: history.length };
    }
    try { localStorage.setItem(key, JSON.stringify(seen)); } catch {}
    if (changed.length) toast(`Оновлення: ${changed.slice(0, 3).map(({ order, event }) => `№ ${order.id} · ${event.note || statuses[event.status]?.[0] || statuses[order.status]?.[0] || order.status}`).join("; ")}`);
  }
  if (!orders.length) {
    root.innerHTML = '<div class="empty-state"><span class="empty-mark">▣</span><h2>Замовлень поки немає</h2><p>Тут з’явиться історія покупок після оформлення.</p><a class="button button-primary" href="catalog.html">До каталогу ↗</a></div>';
    return;
  }
  const created = new URLSearchParams(location.search).get("created");
  root.innerHTML = (orders.some((order) => order.id === created)
    ? `<p class="guide-notice" role="status">Замовлення збережено. ${orders.find((order) => order.id === created)?.verificationRequired ? "Магазин перевірить ціни й наявність перед підтвердженням." : "Воно очікує підтвердження магазину."}</p>`
    : "") + `<div class="orders-list">${orders.map((order) => {
      const [label, className] = statuses[order.status] || statuses.processing;
      const history = order.statusHistory?.length ? order.statusHistory : [{ status: order.status, date: order.date }];
      const carrierNames = { "nova-poshta": "Нова пошта", ukrposhta: "Укрпошта" };
      const paymentNames = { cod: "Післяплата" };
      const returnRequest = order.returnRequest;
      const returnSection = returnRequest?.status === "requested" || returnRequest?.status === "accepted"
        ? `<section class="order-return-status" aria-live="polite"><strong>${returnRequest.status === "accepted" ? "Повернення прийнято" : "Заявку на повернення надіслано"}</strong><p>${safe(returnRequest.reason)}</p>${returnRequest.decisionNote ? `<small>${safe(returnRequest.decisionNote)}</small>` : ""}</section>`
        : order.status === "delivered"
          ? `${returnRequest?.status === "rejected" ? `<section class="order-return-status"><strong>Попередню заявку відхилено</strong>${returnRequest.decisionNote ? `<p>${safe(returnRequest.decisionNote)}</p>` : ""}</section>` : ""}<form class="order-return-form" data-order-return="${safe(order.id)}"><label>Потрібно повернути товар?<textarea name="reason" rows="2" maxlength="1000" required placeholder="Коротко опиши причину"></textarea></label><button class="button button-quiet" type="submit">Подати заявку на повернення</button><span role="status" data-return-status></span></form>`
          : "";
      return `<article class="order-card"><div class="order-top"><div><p class="eyebrow order-id">Замовлення № ${safe(order.id)}</p><time datetime="${safe(order.date)}">${date(order.date)}</time></div><span class="order-status ${className}">${label}</span></div><div class="order-bottom"><span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} шт.</span><strong>${money(order.total)}</strong></div><details class="order-details"><summary>Деталі та відстеження</summary><ul>${order.items.map((item) => `<li><span>${safe(item.name)} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></li>`).join("")}</ul>${order.discount ? `<p>Знижка загалом: ${money(order.discount)} (вже врахована)</p>` : ""}${order.couponCode ? `<p>Купон ${safe(order.couponCode)}: −${money(order.couponDiscount || 0)}</p>` : ""}${order.bundlePromotions?.length ? `<ul class="order-promotion-list">${order.bundlePromotions.map((item) => `<li>Комплект «${safe(item.name)}» −${item.percent}% · ${money(item.discount)}</li>`).join("")}</ul>` : ""}<p class="order-delivery">${safe(order.delivery.name)} · ${safe(order.delivery.phone)}<br>${safe(order.delivery.city)}, ${safe(order.delivery.address)}<br>${safe(carrierNames[order.delivery.carrier] || order.delivery.carrier)} · ${safe(paymentNames[order.delivery.payment] || order.delivery.payment)}${order.trackingNumber ? `<br>Номер відстеження: <strong>${safe(order.trackingNumber)}</strong>` : ""}</p><ol class="order-status-history">${history.map((event) => `<li><strong>${statuses[event.status]?.[0] || safe(event.status)}</strong><time>${dateTime(event.date)}</time>${event.note ? `<small>${safe(event.note)}</small>` : ""}</li>`).join("")}</ol>${returnSection}</details></article>`;
    }).join("")}</div>`;
}
