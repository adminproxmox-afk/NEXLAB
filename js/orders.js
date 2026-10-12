import { getOrders } from "../api/orderService.js";
const money = (value) => new Intl.NumberFormat("uk-UA").format(value) + " ₴";
const date = (value) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
const safe = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const statuses = {
  processing: ["В обробці", "status-pending"],
  delivered: ["Доставлено", "status-done"],
  cancelled: ["Скасовано", "status-cancelled"],
  returned: ["Повернення прийнято", "status-done"],
};
export async function initializeOrdersPage() {
  const root = document.querySelector("[data-orders]");
  if (!root) return;
  const orders = await getOrders();
  if (!orders.length) {
    root.innerHTML =
      '<div class="empty-state"><span class="empty-mark">▣</span><h2>Замовлень поки немає</h2><p>Тут з’явиться історія покупок після оформлення.</p><a class="button button-primary" href="catalog.html">До каталогу ↗</a></div>';
    return;
  }
  const created = new URLSearchParams(location.search).get("created");
  root.innerHTML =
    (orders.some((order) => order.id === created)
      ? `<p class="guide-notice" role="status">Замовлення збережено. ${orders.find((order) => order.id === created)?.verificationRequired ? "Магазин перевірить ціни й наявність перед підтвердженням." : "Воно очікує підтвердження магазину."}</p>`
      : "") +
    `<div class="orders-list">${orders
      .map((order) => {
        const [label, className] =
          statuses[order.status] || statuses.processing;
        return `<article class="order-card"><div class="order-top"><div><p class="eyebrow order-id">Замовлення № ${safe(order.id)}</p><time datetime="${safe(order.date)}">${date(order.date)}</time></div><span class="order-status ${className}">${label}</span></div><div class="order-bottom"><span>${order.items.reduce((sum, item) => sum + item.quantity, 0)} шт.</span><strong>${money(order.total)}</strong></div><details class="order-details"><summary>Деталі замовлення</summary><ul>${order.items.map((item) => `<li><span>${safe(item.name)} × ${item.quantity}</span><span>${money(item.price * item.quantity)}</span></li>`).join("")}</ul>${order.discount ? `<p>Знижка від попередніх цін: ${money(order.discount)} (вже врахована)</p>` : ""}<p class="order-delivery">${safe(order.delivery.name)} · ${safe(order.delivery.phone)}<br>${safe(order.delivery.city)}, ${safe(order.delivery.address)}<br>${order.delivery.carrier === "nova-poshta" ? "Нова пошта" : "Укрпошта"} · Післяплата<br>Доставка та комісія за післяплату оплачуються окремо за тарифом перевізника.</p></details></article>`;
      })
      .join("")}</div>`;
}
