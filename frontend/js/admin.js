import { request } from "../api/client.js";
import {
  categories,
  getProducts,
  refreshProducts,
  setShopSettings,
} from "../api/productService.js";
import { getCurrentUser, hasAdminAccess, hasAdminPermission, isAdmin } from "./session.js";
import { formatMoney, formatDate } from "./i18n.js";
import { allocateNetItemRevenue } from "./admin-analytics.js";
import {
  firebaseSendPasswordReset,
  isFirebaseConfigured,
} from "../api/firebaseAuth.js";
import {
  loadFirebaseAdminData,
  removeFirebaseProduct,
  removeFirebaseProject,
  removeFirebaseReview,
  saveFirebaseProduct,
  importFirebaseCatalog,
  saveFirebaseProject,
  saveFirebaseSettings,
  saveFirebaseCoupon,
  saveFirebaseStock,
  updateFirebaseUserRole,
  reviewFirebaseOrderReturn,
  updateFirebaseOrderStatus,
} from "../api/firebaseAdminService.js";

const safe = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const money = formatMoney;
const shortDate = (value) =>
  formatDate(value, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const labels = {
  processing: "В обробці",
  confirmed: "Підтверджено",
  shipped: "Передано перевізнику",
  delivered: "Доставлено",
  cancelled: "Скасовано",
  returned: "Повернення прийнято",
};
const transitions = {
  processing: ["processing", "confirmed", "cancelled"],
  confirmed: ["confirmed", "shipped", "cancelled"],
  shipped: ["shipped", "delivered"],
  delivered: ["delivered"],
  cancelled: ["cancelled", "processing"],
  returned: ["returned"],
};
const staffRoles = [
  ["user", "Користувач"],
  ["order_manager", "Менеджер замовлень"],
  ["catalog_manager", "Менеджер каталогу"],
  ["warehouse", "Працівник складу"],
  ["support", "Підтримка"],
];
const roleName = (role) => role === "admin" ? "Адміністратор" : (staffRoles.find(([value]) => value === role)?.[1] || "Користувач");

function orderCard(order, settings, users) {
  const account = users.find((user) => user.id === order.userId);
  const searchable = [
    order.id,
    order.delivery.name,
    order.delivery.phone,
    order.delivery.city,
    order.delivery.address,
    account?.email,
    order.trackingNumber,
  ].join(" ");
  const items = order.items
    .map(
      (item) =>
        `<li>${safe(item.name)} × ${item.quantity} <span>${money(item.price * item.quantity)}</span></li>`,
    )
    .join("");
  const returnRequest = order.returnRequest;
  const returnBlock = returnRequest
    ? `<section class="admin-return-request"><strong>Заявка на повернення · ${{ requested: "очікує рішення", accepted: "прийнято", rejected: "відхилено" }[returnRequest.status] || safe(returnRequest.status)}</strong><p>${safe(returnRequest.reason)}</p>${returnRequest.decisionNote ? `<small>Коментар: ${safe(returnRequest.decisionNote)}</small>` : ""}${returnRequest.status === "requested" ? `<div class="admin-return-actions"><button class="button button-primary" type="button" data-review-return="accepted" data-order-id="${safe(order.id)}">Прийняти повернення</button><button class="button button-quiet" type="button" data-review-return="rejected" data-order-id="${safe(order.id)}">Відхилити</button><span role="status" data-return-status></span></div><small>${order.verificationRequired ? "Стара заявка: перед прийняттям звір склад вручну. Після цього система збереже рішення." : "Приймай повернення після фактичного отримання товару. Склад оновиться автоматично."}</small>` : ""}</section>`
    : "";
  return `<article class="admin-order profile-panel" data-order-status="${safe(order.status)}" data-order-search="${safe(searchable)}"><div class="admin-order-heading"><div><p class="eyebrow">Замовлення · ${shortDate(order.date)}</p><h3 class="order-id">№ ${safe(order.id)}</h3></div><strong>${money(order.total)}</strong></div>
    <div class="admin-order-details"><p><strong>${safe(order.delivery.name)}</strong><br>${safe(order.delivery.phone)}${account?.email ? `<br><a href="mailto:${safe(account.email)}">${safe(account.email)}</a>` : ""}</p><p>${safe(order.delivery.city)}, ${safe(order.delivery.address)}</p><p>${safe(settings.deliveryMethods.find((item) => item.id === order.delivery.carrier)?.name || order.delivery.carrier)} · ${safe(settings.paymentMethods.find((item) => item.id === order.delivery.payment)?.name || order.delivery.payment)}</p></div>
    ${order.verificationRequired ? '<p class="guide-notice" role="note">Заявка з GitHub Pages: перед підтвердженням перевір ціни та залишки вручну.</p>' : ""}
    ${returnBlock}
    <details><summary>Склад замовлення (${order.items.length})</summary><ul class="admin-order-items">${items}</ul></details>
    <details class="admin-order-history"><summary>Історія статусу (${(order.statusHistory || []).length || 1})</summary><ol>${(order.statusHistory?.length ? order.statusHistory : [{ status: order.status, date: order.date }]).map((event) => `<li><strong>${labels[event.status] || safe(event.status)}</strong><time>${shortDate(event.date)}</time>${event.note ? `<small>${safe(event.note)}</small>` : ""}</li>`).join("")}</ol></details>
    <form class="admin-order-form" data-admin-order="${safe(order.id)}" data-current-status="${safe(order.status)}" data-current-tracking="${safe(order.trackingNumber || "")}"><input type="hidden" name="statusHistory" value="${safe(JSON.stringify(order.statusHistory || [{ status: order.status, date: order.date }]))}"><label>Статус<select name="status">${(transitions[order.status] || [order.status]).map((value) => `<option value="${value}" ${order.status === value ? "selected" : ""}>${labels[value] || safe(value)}</option>`).join("")}</select></label><label>Номер відстеження<input name="trackingNumber" maxlength="80" value="${safe(order.trackingNumber || "")}" placeholder="Введи перед відправленням"></label><button class="button button-quiet" type="submit" ${order.status === "returned" ? "disabled" : ""}>Зберегти</button><span role="status" data-admin-status></span>${order.status === "delivered" ? "<small>Позначай повернення лише після фактичного отримання товару.</small>" : ""}</form>
  </article>`;
}

function downloadOrdersCsv(orders) {
  const quote = (value) => {
    const text = String(value ?? "");
    return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
  };
  const rows = [
    ["Номер", "Дата", "Статус", "Клієнт", "Телефон", "Місто", "Адреса", "Перевізник", "Відстеження", "Купон", "Знижка", "Товари", "Сума"],
    ...orders.map((order) => [order.id, order.date, labels[order.status] || order.status, order.delivery.name, order.delivery.phone, order.delivery.city, order.delivery.address, order.delivery.carrier, order.trackingNumber, order.couponCode || "", order.discount || 0, order.items.map((item) => `${item.name} × ${item.quantity}`).join("; "), order.total]),
  ];
  const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(quote).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexlab-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadProductsJson(products) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(products, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `nexlab-products-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function orderAnalytics(orders, users, period) {
  const now = Date.now();
  const cutoff = period === "all" ? 0 : now - Number(period) * 24 * 60 * 60 * 1000;
  const selected = orders.filter((order) => {
    const date = new Date(order.date).getTime();
    return Number.isFinite(date) && date >= cutoff;
  });
  const active = selected.filter((order) => !["cancelled", "returned"].includes(order.status));
  const amount = (list) => list.reduce((total, order) => total + (Number(order.total) || 0), 0);
  const customerRows = new Map();
  const productRows = new Map();
  for (const order of active) {
    const user = users.find((item) => item.id === order.userId);
    const key = order.userId || `${order.delivery.phone}:${order.delivery.name}`;
    const customer = customerRows.get(key) || {
      name: user?.name || order.delivery.name || "Клієнт без імені",
      email: user?.email || "",
      phone: order.delivery.phone || "",
      count: 0,
      total: 0,
    };
    customer.count += 1;
    customer.total += Number(order.total) || 0;
    customerRows.set(key, customer);
    for (const item of allocateNetItemRevenue(order)) {
      const product = productRows.get(item.id) || { name: item.name, quantity: 0, total: 0 };
      product.quantity += item.quantity;
      product.total += item.revenue;
      productRows.set(item.id, product);
    }
  }
  const topCustomers = [...customerRows.values()].sort((a, b) => b.total - a.total).slice(0, 5);
  const topProducts = [...productRows.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const list = (rows, render, empty) => rows.length
    ? `<ol class="admin-analytics-list">${rows.map(render).join("")}</ol>`
    : `<p class="admin-analytics-empty">${empty}</p>`;
  return `<div class="admin-analytics-metrics"><article><span>Замовлень без скасувань</span><strong>${active.length}</strong><small>${selected.filter((order) => order.status === "cancelled").length} скасовано · ${selected.filter((order) => order.status === "returned").length} повернено</small></article><article><span>Сума активних замовлень</span><strong>${money(amount(active))}</strong><small>в обробці та доставлені</small></article><article><span>Середній чек</span><strong>${money(active.length ? Math.round(amount(active) / active.length) : 0)}</strong><small>за вибраний період</small></article><article><span>Унікальних клієнтів</span><strong>${customerRows.size}</strong><small>${[...customerRows.values()].filter((row) => row.count > 1).length} замовляли повторно</small></article></div><div class="admin-analytics-columns"><section><h3>Найактивніші клієнти</h3>${list(topCustomers, (row) => `<li><div><strong>${safe(row.name)}</strong><small>${safe(row.email || row.phone)} · ${row.count} замовл.</small></div><b>${money(row.total)}</b></li>`, "За цей період замовлень немає.")}</section><section><h3>Популярні товари</h3>${list(topProducts, (row) => `<li><div><strong>${safe(row.name)}</strong><small>${row.quantity} од. · дохід після знижок</small></div><b>${money(row.total)}</b></li>`, "За цей період проданих товарів немає.")}</section></div>`;
}

const imageKinds = [
  ["board", "Плата"],
  ["arduino", "Arduino"],
  ["pi", "Одноплатний комп’ютер"],
  ["sensor", "Датчик"],
  ["display", "Дисплей"],
  ["ultrasonic", "Ультразвуковий датчик"],
  ["strip", "LED-стрічка"],
  ["power", "Живлення"],
  ["tool", "Інструмент"],
  ["cable", "Кабель"],
  ["kit", "Набір"],
  ["filament", "Філамент"],
  ["components", "Компоненти"],
  ["esp8266", "Плата ESP8266"],
  ["nano", "Arduino Nano"],
  ["bme280", "Модуль BME280"],
  ["pir", "PIR-датчик руху"],
  ["probe", "Температурний зонд"],
  ["soil", "Датчик вологості ґрунту"],
  ["servo", "Сервопривід"],
  ["motor-driver", "Драйвер двигуна"],
  ["relay4", "Чотириканальне реле"],
  ["level-shifter", "Перетворювач рівнів"],
  ["sd-module", "Модуль microSD"],
  ["buzzer", "Бузер-модуль"],
];
const specsText = (specifications) =>
  Object.entries(specifications || {})
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
const methodsText = (items) => items.map(({ id, name }) => `${id} | ${name}`).join("\n");
function productEditor(product) {
  const editing = Boolean(product);
  const value = (key, fallback = "") => safe(product?.[key] ?? fallback);
  const searchable = editing
    ? [
        product.name,
        product.category,
        product.brand,
        product.sku,
        product.id,
      ].join(" ")
    : "";
  return `<details class="admin-product-editor" data-existing="${editing}" data-product-id="${editing ? safe(product.id) : ""}" data-product-search="${safe(searchable)}" ${editing ? "" : "open"}><summary><span>${editing ? safe(product.name) : "＋ Додати товар"}</span>${editing ? `<small>${money(product.price)} · ${product.stock} шт.</small>` : ""}</summary><form class="admin-product-form" data-admin-product="${editing ? "edit" : "new"}" data-existing="${editing}">
    <label>Артикул (латиницею)<input name="id" value="${value("id")}" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" ${editing ? "readonly" : "required"} placeholder="наприклад, esp32-s3"></label>
    <label>Назва товару<input name="name" value="${value("name")}" maxlength="120" required></label>
    <label>Категорія<select name="category" required>${categories.map((category) => `<option value="${safe(category.name)}" ${product?.category === category.name ? "selected" : ""}>${safe(category.name)}</option>`).join("")}</select></label>
    <label>Бренд<input name="brand" value="${value("brand")}" maxlength="100" required></label><label>Підкатегорія<input name="subcategory" value="${value("subcategory")}" maxlength="120" required></label><label>Модель / SKU<input name="sku" value="${value("sku")}" maxlength="100" required></label>
    <label>Ціна, ₴<input name="price" type="number" min="0" max="10000000" step="1" value="${value("price", 0)}" required></label><label>Стара ціна, ₴<input name="oldPrice" type="number" min="0" max="10000000" step="1" value="${value("oldPrice")}" placeholder="Не показувати знижку"></label><label>Залишок, шт.<input name="stock" type="number" min="0" max="100000" step="1" value="${value("stock", 0)}" required></label>
    <label>Ілюстрація<select name="image">${imageKinds.map(([id, name]) => `<option value="${id}" ${product?.image === id ? "selected" : ""}>${name}</option>`).join("")}</select></label><label class="admin-wide">Фото товару: HTTPS URL, кожне з нового рядка<textarea name="images" rows="3" placeholder="https://...">${safe((product?.images || []).join("\n"))}</textarea><small>Також можна вказати шлях assets/images/...</small></label>
    <label class="admin-wide">Опис<textarea name="description" rows="4" maxlength="3000" required>${value("description")}</textarea></label><label class="admin-wide">Теги через кому<input name="tags" value="${value("tags", (product?.tags || []).join(", "))}" placeholder="ESP32, Wi-Fi, Bluetooth"></label>
    <label class="admin-wide">Характеристики — по одній «назва: значення» на рядок<textarea name="specifications" rows="4" placeholder="Живлення: 5 V&#10;Інтерфейс: USB-C">${safe(specsText(product?.specifications))}</textarea></label>
    <label class="admin-check"><input name="featured" type="checkbox" ${product?.featured ? "checked" : ""}> Показувати на головній</label><label class="admin-check"><input name="isNew" type="checkbox" ${product?.isNew ? "checked" : ""}> Позначити як новинку</label>
    <div class="admin-product-actions"><button class="button button-primary" type="submit">${editing ? "Зберегти зміни" : "Створити товар"}</button>${editing ? `<button class="button button-quiet" type="button" data-delete-product="${safe(product.id)}">Видалити товар</button>` : ""}</div><p role="status" data-admin-status></p>
  </form></details>`;
}

function warehouseProductEditor(product) {
  return `<form class="admin-record" data-warehouse-product="${safe(product.id)}" data-product-search="${safe(`${product.name} ${product.sku || ""} ${product.id}`)}"><div><strong>${safe(product.name)}</strong><small>${safe(product.sku || product.id)} · залишок ${Number(product.stock) || 0} шт.</small></div><label>Залишок<input name="stock" type="number" min="0" max="100000" step="1" value="${Number(product.stock) || 0}" required></label><button class="button button-quiet" type="submit">Оновити залишок</button><span role="status" data-admin-status></span></form>`;
}

function projectEditor(project, products) {
  const editing = Boolean(project);
  const value = (key) => safe(project?.[key] ?? "");
  const componentRow = (component = {}) => `<div class="admin-project-component" data-project-component><label>Товар<select data-component-product required>${component.productId && !products.some((product) => product.id === component.productId) ? `<option value="" selected disabled>Товар не знайдено: ${safe(component.productId)}</option>` : ""}${products.map((product) => `<option value="${safe(product.id)}" ${component.productId === product.id ? "selected" : ""}>${safe(product.name)} · ${safe(product.id)}</option>`).join("")}</select></label><label>Кількість<input data-component-quantity type="number" min="1" max="1000" value="${component.quantity || 1}" required></label><button class="button button-quiet" type="button" data-remove-component aria-label="Прибрати компонент">Видалити</button></div>`;
  const search = `${project?.name || ""} ${project?.description || ""} ${project?.components?.map((item) => item.productId).join(" ") || ""}`;
  return `<details class="admin-project-editor" data-project-id="${editing ? safe(project.id) : ""}" data-project-search="${safe(search)}" ${editing ? "" : "open"}><summary><span>${editing ? safe(project.name) : "＋ Створити проєкт"}</span>${editing ? `<small>${project.components.length} компонентів · ${safe(project.difficulty)}</small>` : ""}</summary><form class="admin-project-form" data-admin-project="${editing ? "edit" : "new"}"><div class="admin-settings-grid"><label>Артикул (латиницею)<input name="id" value="${value("id")}" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" ${editing ? "readonly" : "required"} placeholder="наприклад, smart-greenhouse"></label><label>Назва проєкту<input name="name" value="${value("name")}" maxlength="120" required></label><label>Рівень складності<select name="difficulty" required>${["Легкий", "Середній", "Просунутий"].map((level) => `<option value="${level}" ${project?.difficulty === level ? "selected" : ""}>${level}</option>`).join("")}</select></label><label>Знижка за комплект, %<input name="bundleDiscountPercent" type="number" min="0" max="50" step="1" value="${project?.bundleDiscountPercent || 0}" required><small>Автоматично застосовується, якщо покупець додає всі деталі проєкту.</small></label><label>Ілюстрація<select name="image">${imageKinds.map(([id, label]) => `<option value="${id}" ${project?.image === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label class="admin-wide">Опис<textarea name="description" rows="3" maxlength="2000" required>${value("description")}</textarea></label><label class="admin-wide">Кроки складання <small>Кожен крок — з нового рядка; до 20 кроків.</small><textarea name="steps" rows="5" maxlength="10000">${safe((project?.steps || []).join("\n"))}</textarea></label></div><div class="admin-project-components-heading"><h4>Склад проєкту</h4><button class="button button-quiet" type="button" data-add-component>＋ Додати компонент</button></div><div class="admin-project-components">${(project?.components?.length ? project.components : [{}]).map(componentRow).join("")}</div><div class="admin-product-actions"><button class="button button-primary" type="submit">${editing ? "Зберегти проєкт" : "Створити проєкт"}</button>${editing ? `<button class="button button-quiet" type="button" data-delete-project="${safe(project.id)}">Видалити проєкт</button>` : ""}</div><p role="status" data-admin-status></p></form></details>`;
}

function couponEditor(coupon) {
  const editing = Boolean(coupon);
  const value = (key) => safe(coupon?.[key] ?? "");
  return `<form class="admin-coupon-editor profile-panel" data-admin-coupon="${editing ? "edit" : "new"}" data-coupon-used-count="${editing ? Number(coupon.usedCount || 0) : 0}"><div class="admin-settings-grid"><label>Код купона<input name="code" value="${value("code")}" maxlength="24" pattern="[A-Za-z0-9][A-Za-z0-9-]{2,23}" required ${editing ? "readonly" : ""} placeholder="напр. NEXLAB10"></label><label>Знижка, %<input name="percent" type="number" min="1" max="80" step="1" value="${editing ? value("percent") : 10}" required></label><label>Мінімальна сума кошика, ₴<input name="minTotal" type="number" min="0" step="1" value="${editing ? value("minTotal") : 0}" required></label><label>Ліміт використань<input name="maxUses" type="number" min="1" step="1" value="${coupon?.maxUses ?? ""}" placeholder="Без ліміту"></label><label>Діє до<input name="validUntil" type="date" value="${value("validUntil").slice(0, 10)}"></label><label class="check-filter"><input name="active" type="checkbox" ${editing ? coupon.active ? "checked" : "" : "checked"}> Активний купон</label></div>${editing ? `<p class="admin-section-note">Використано: ${Number(coupon.usedCount || 0)}${coupon.maxUses ? ` з ${coupon.maxUses}` : " · без ліміту"}</p>` : ""}<button class="button button-${editing ? "quiet" : "primary"}" type="submit">${editing ? "Зберегти купон" : "＋ Створити купон"}</button><p role="status" data-admin-status></p></form>`;
}

export async function initializeAdmin() {
  const root = document.querySelector("[data-admin-content]");
  if (!root || !hasAdminAccess()) return;
  root.innerHTML = `<div class="admin-title-row"><div><p class="eyebrow">NEXLAB · КЕРУВАННЯ МАГАЗИНОМ</p><h1>Панель керування</h1><p>Вітаємо, ${safe(getCurrentUser()?.name || "Адміністратор")}. Тут можна стежити за замовленнями, каталогом і клієнтами.</p></div><div class="admin-dashboard-actions"><span data-admin-updated>Дані ще не оновлювалися</span><button class="button button-quiet" type="button" data-admin-refresh><span aria-hidden="true">↻</span> Оновити</button></div></div>
    <div class="admin-workspace"><nav class="admin-section-nav" aria-label="Розділи панелі"><a href="#admin-overview" aria-controls="admin-overview">Огляд</a><a href="#admin-orders-section" aria-controls="admin-orders-section">Замовлення <span data-admin-nav-orders>0</span></a><a href="#admin-promotions-section" aria-controls="admin-promotions-section">Купони й набори</a><a href="#admin-products-section" aria-controls="admin-products-section">Товари</a><a href="#admin-inventory-section" aria-controls="admin-inventory-section">Журнал складу</a><a href="#admin-products-section" aria-controls="admin-products-section" data-admin-open-product>＋ Додати товар</a><a href="#admin-projects-section" aria-controls="admin-projects-section">Проєкти</a><a href="#admin-settings-section" aria-controls="admin-settings-section">Налаштування</a><a href="#admin-reviews-section" aria-controls="admin-reviews-section">Відгуки</a><a href="#admin-users-section" aria-controls="admin-users-section">Користувачі</a></nav><div class="admin-workspace-content">
    <p class="service-error" role="alert" data-admin-error hidden></p>
    <section class="admin-overview" id="admin-overview" aria-labelledby="admin-summary-title"><div class="admin-section-heading"><div><p class="eyebrow">ПОТОЧНИЙ СТАН МАГАЗИНУ</p><h2 id="admin-summary-title">Огляд</h2></div></div><div class="admin-metrics" data-admin-metrics></div><div class="admin-attention" data-admin-attention></div><div class="admin-analytics-heading"><div><p class="eyebrow">ЗАМОВЛЕННЯ ТА ПОКУПЦІ</p><h3>Аналітика замовлень</h3></div><label>Період<select data-order-analytics-period><option value="7">7 днів</option><option value="30" selected>30 днів</option><option value="all">Увесь час</option></select></label></div><div data-order-analytics></div></section>
    <section class="admin-section" id="admin-orders-section"><div class="admin-section-heading"><div><p class="eyebrow">ОБСЛУГОВУВАННЯ</p><h2>Замовлення</h2></div><div class="admin-order-tools"><label class="admin-search"><span aria-hidden="true">⌕</span><input type="search" data-order-search-input placeholder="Номер, ім’я, місто" aria-label="Пошук замовлень"></label><button class="button button-quiet" type="button" data-export-orders>Експорт CSV</button></div></div><div class="admin-filter-row"><label>Статус<select data-order-status-filter><option value="all">Усі статуси</option><option value="processing">В обробці</option><option value="confirmed">Підтверджено</option><option value="shipped">Передано перевізнику</option><option value="delivered">Доставлено</option><option value="cancelled">Скасовано</option><option value="returned">Повернення прийнято</option></select></label><span data-admin-order-count></span></div><div class="admin-order-list" data-admin-orders></div><p class="admin-filter-empty" data-order-empty hidden>За цими умовами замовлень не знайдено.</p></section>
    <section class="admin-section" id="admin-inventory-section"><div class="admin-section-heading"><div><p class="eyebrow">СКЛАД</p><h2>Журнал руху залишків</h2><p class="admin-section-note">Останні зміни: резервування замовлення, скасування, повернення та ручне коригування.</p></div></div><div data-admin-inventory></div></section>
      <section class="admin-section" id="admin-promotions-section"><div class="admin-section-heading"><div><p class="eyebrow">ЗАОХОЧЕННЯ ПОКУПКИ</p><h2>Купони й набори</h2><p class="admin-section-note">Купони перевіряються під час оформлення, а знижка комплекту діє лише коли в кошику є всі компоненти проєкту.</p></div></div><div class="admin-coupon-list" data-admin-coupons></div></section><section class="admin-section" id="admin-products-section"><div class="admin-section-heading"><div><p class="eyebrow">АСОРТИМЕНТ І ЗАЛИШКИ</p><h2>Каталог і склад</h2><p class="admin-section-note">Зміни одразу зберігаються в базі магазину.</p></div><div class="admin-product-tools"><label class="admin-search"><span aria-hidden="true">⌕</span><input type="search" data-product-search-input placeholder="Назва, бренд або артикул" aria-label="Пошук товарів"></label><button class="button button-quiet" type="button" data-export-products>Експорт JSON</button><label class="button button-quiet admin-import-button">Імпорт JSON<input type="file" accept="application/json,.json" data-import-products aria-label="Вибрати JSON-файл каталогу"></label></div></div><p class="admin-section-note" data-import-products-status role="status">JSON-масив товарів або об’єкт із полем products. Можна редагувати файл експорту; один пакет — до 200 товарів.</p><div class="admin-filter-row"><span data-admin-product-count></span></div><div class="admin-products" data-admin-products></div><p class="admin-filter-empty" data-product-empty hidden>Товарів за цим запитом не знайдено.</p></section>
    <section class="admin-section" id="admin-projects-section"><div class="admin-section-heading"><div><p class="eyebrow">DIY · ПОКРОКОВІ ЗБІРКИ</p><h2>Проєкти</h2><p class="admin-section-note">Керуй описом, складністю та компонентами; ціна комплекту рахується з актуальних цін товарів.</p></div><label class="admin-search"><span aria-hidden="true">⌕</span><input type="search" data-project-search-input placeholder="Назва або опис" aria-label="Пошук проєктів"></label></div><div class="admin-filter-row"><span data-admin-project-count></span></div><div class="admin-projects"><button class="button button-primary" type="button" data-admin-add-project>＋ Створити проєкт</button><div class="admin-project-list" data-admin-projects></div></div><p class="admin-filter-empty" data-project-empty hidden>Проєктів за цим запитом не знайдено.</p></section>
    <section class="admin-section" id="admin-settings-section"><div class="admin-section-heading"><div><p class="eyebrow">ВИГЛЯД І УМОВИ МАГАЗИНУ</p><h2>Налаштування магазину</h2><p class="admin-section-note">Ці дані показуються покупцям у шапці сайту, оформленні замовлення та інформаційних сторінках.</p></div></div><form class="admin-settings-form profile-panel" data-admin-settings>
      <h3>Назва та контакти</h3><div class="admin-settings-grid"><label>Назва магазину<input name="name" maxlength="80" required></label><label>Ім’я продавця<input name="sellerName" maxlength="120" required></label><label>Місто відправлення<input name="sellerCity" maxlength="100" required></label><label>Телефон підтримки<input name="supportPhone" maxlength="30" placeholder="+380..."></label><label>Електронна пошта<input name="supportEmail" type="email" maxlength="254" placeholder="support@example.com"></label><label>Гарантія, місяців<input name="warrantyMonths" type="number" min="0" max="120" placeholder="Не вказано"></label></div>
      <h3>Доставка й оплата</h3><div class="admin-settings-grid"><label class="admin-wide">Способи доставки <small>По одному на рядок: ідентифікатор | назва. Ідентифікатор використовується у збережених замовленнях.</small><textarea name="deliveryMethods" rows="4" required></textarea></label><label class="admin-wide">Способи оплати <small>По одному на рядок: ідентифікатор | назва.</small><textarea name="paymentMethods" rows="3" required></textarea></label><label class="admin-wide">Пояснення щодо доставки<textarea name="deliveryNote" rows="4" maxlength="2000" required></textarea></label><label class="admin-wide">Примітка про ціни<textarea name="priceNote" rows="3" maxlength="1000" required></textarea></label></div>
      <h3>Інформація для покупців</h3><div class="admin-settings-grid"><label class="admin-wide">Повідомлення про статус магазину<textarea name="demoNotice" rows="3" maxlength="500" required></textarea></label><label class="admin-wide">Інструкція щодо повернення<textarea name="returnInstructions" rows="4" maxlength="2000" required></textarea></label></div><div class="admin-settings-actions"><button class="button button-primary" type="submit">Зберегти налаштування</button><p role="status" data-admin-settings-status></p></div>
    </form></section>
    <section class="admin-section" id="admin-reviews-section"><div class="admin-section-heading"><div><p class="eyebrow">ЗВОРОТНИЙ ЗВ’ЯЗОК</p><h2>Відгуки</h2></div><label class="admin-search"><span aria-hidden="true">⌕</span><input type="search" data-review-search-input placeholder="Товар, ім’я або текст" aria-label="Пошук відгуків"></label></div><div class="admin-reviews" data-admin-reviews></div><p class="admin-filter-empty" data-review-empty hidden>Відгуків за цим запитом не знайдено.</p></section>
    <section class="admin-section" id="admin-users-section"><div class="admin-section-heading"><div><p class="eyebrow">ОБЛІКОВІ ЗАПИСИ</p><h2>Користувачі</h2></div><label class="admin-search"><span aria-hidden="true">⌕</span><input type="search" data-user-search-input placeholder="Ім’я або електронна пошта" aria-label="Пошук користувачів"></label></div><div class="admin-users" data-admin-users></div><p class="admin-filter-empty" data-user-empty hidden>Користувачів за цим запитом не знайдено.</p></section></div></div>`;
  const adminSections = [...root.querySelectorAll(".admin-workspace-content > section[id]")];
  const adminLinks = [...root.querySelectorAll(".admin-section-nav a")];
  const canOrders = hasAdminPermission("orders");
  const canCatalog = hasAdminPermission("catalog");
  const canWarehouse = hasAdminPermission("warehouse");
  const canSupport = hasAdminPermission("support");
  const canUsers = isAdmin() || canSupport;
  const sectionAllowed = (id) => ({
    "admin-overview": canOrders,
    "admin-orders-section": canOrders,
    "admin-inventory-section": canWarehouse,
    "admin-promotions-section": canCatalog,
    "admin-products-section": canCatalog || canWarehouse,
    "admin-projects-section": canCatalog,
    "admin-settings-section": isAdmin(),
    "admin-reviews-section": canSupport,
    "admin-users-section": canUsers,
  })[id] === true;
  adminSections.forEach((section) => { section.hidden = !sectionAllowed(section.id); });
  adminLinks.forEach((link) => {
    const sectionId = link.hash.slice(1);
    const allowed = sectionAllowed(sectionId) && (!link.hasAttribute("data-admin-open-product") || canCatalog);
    link.hidden = !allowed;
  });
  if (!canCatalog) {
    root.querySelector('[data-export-products]')?.setAttribute("hidden", "");
    root.querySelector(".admin-import-button")?.setAttribute("hidden", "");
  }
  const defaultSection = adminSections.find((section) => sectionAllowed(section.id))?.id || "admin-products-section";
  function activateAdminSection({ focusHeading = false } = {}) {
    const requestedId = window.location.hash.slice(1);
    const activeId = adminSections.some((section) => section.id === requestedId && sectionAllowed(section.id))
      ? requestedId
      : defaultSection;
    adminSections.forEach((section) => {
      section.hidden = !sectionAllowed(section.id) || section.id !== activeId;
    });
    adminLinks.forEach((link) => {
      if (link.hash === `#${activeId}`) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    if (focusHeading) {
      const heading = root.querySelector(`#${activeId} h2`);
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }
  window.addEventListener("hashchange", () => activateAdminSection({ focusHeading: true }));
  window.addEventListener("popstate", () => activateAdminSection({ focusHeading: true }));
  activateAdminSection();
  const errorBox = root.querySelector("[data-admin-error]");
  let analyticsOrders = [];
  let analyticsUsers = [];
  const analyticsPeriod = root.querySelector("[data-order-analytics-period]");
  const renderAnalytics = () => {
    root.querySelector("[data-order-analytics]").innerHTML =
      orderAnalytics(analyticsOrders, analyticsUsers, analyticsPeriod.value);
  };
  let currentOrders = [];
  let currentProducts = [];
  analyticsPeriod.addEventListener("change", renderAnalytics);
  async function load() {
    errorBox.hidden = true;
    root.querySelector("[data-admin-refresh]").disabled = true;
    try {
      let data;
      if (isFirebaseConfigured()) {
        data = await loadFirebaseAdminData({
          orders: canOrders,
          catalog: canCatalog,
          warehouse: canWarehouse,
          support: canSupport,
          users: canUsers,
        });
      } else {
        const [products, settingsResponse, ordersResponse, reviewsResponse, usersResponse, projectsResponse, movementsResponse, couponsResponse] = await Promise.all([
          getProducts(),
          request("store"),
          canOrders ? request("admin/orders") : Promise.resolve({ orders: [] }),
          canSupport ? request("admin/reviews") : Promise.resolve({ reviews: [] }),
          canUsers ? request("admin/users") : Promise.resolve({ users: [] }),
          canCatalog ? request("admin/projects") : Promise.resolve({ projects: [] }),
          canWarehouse ? request("admin/inventory-movements") : Promise.resolve({ movements: [] }),
          canCatalog ? request("admin/coupons") : Promise.resolve({ coupons: [] }),
        ]);
        data = {
          products,
          orders: ordersResponse.orders,
          reviews: reviewsResponse.reviews,
          users: usersResponse.users,
          settings: settingsResponse.settings,
          projects: projectsResponse.projects,
          inventoryMovements: movementsResponse.movements,
          coupons: couponsResponse.coupons,
        };
      }
      const { products, settings } = data;
      const orders = data.orders || [];
      const reviews = data.reviews || [];
      const users = data.users || [];
      const projects = data.projects || [];
      const coupons = data.coupons || [];
      currentOrders = orders;
      currentProducts = products;
      analyticsOrders = orders;
      analyticsUsers = users;
      renderAnalytics();
      const settingsForm = root.querySelector("[data-admin-settings]");
      root.querySelector(".admin-title-row .eyebrow").textContent = `${settings.name} · КЕРУВАННЯ МАГАЗИНОМ`;
      if (settingsForm) {
        for (const [key, value] of Object.entries(settings)) {
          const field = settingsForm.elements[key];
          if (field) field.value = Array.isArray(value) ? methodsText(value) : (value ?? "");
        }
      }
      const active = orders.filter(
        (order) => ["processing", "confirmed", "shipped"].includes(order.status),
      ).length;
      const lowStock = products.filter((product) => product.stock < 5).length;
      const revenue = orders
        .filter((order) => !["cancelled", "returned"].includes(order.status))
        .reduce((sum, order) => sum + order.total, 0);
      root.querySelector("[data-admin-metrics]").innerHTML =
        `<a class="admin-metric admin-metric-action" href="#admin-orders-section"><span>Потрібно опрацювати</span><strong>${active}</strong><small>замовлень</small></a><a class="admin-metric" href="#admin-products-section"><span>Товари в каталозі</span><strong>${products.length}</strong><small>позицій</small></a><a class="admin-metric ${lowStock ? "is-warning" : ""}" href="#admin-products-section"><span>Мало на складі</span><strong>${lowStock}</strong><small>менше 5 одиниць</small></a><a class="admin-metric" href="#admin-users-section"><span>Користувачі</span><strong>${users.length}</strong><small>облікових записів</small></a><div class="admin-metric admin-metric-revenue"><span>Сума замовлень</span><strong>${money(revenue)}</strong><small>без скасованих і повернених</small></div>`;
      root.querySelector("[data-admin-nav-orders]").textContent =
        String(active);
      root.querySelector("[data-admin-attention]").innerHTML =
        active || lowStock
          ? `<span class="admin-attention-mark" aria-hidden="true">!</span><div><strong>Є завдання, що потребують уваги</strong><p>${active ? `Замовлень в обробці: ${active}.` : "Нових замовлень немає."} ${lowStock ? `Товарів із залишком менше 5 одиниць: ${lowStock}.` : ""}</p></div><a href="${active ? "#admin-orders-section" : "#admin-products-section"}">Переглянути <span aria-hidden="true">→</span></a>`
          : '<div class="admin-attention-mark is-ok" aria-hidden="true">✓</div><div><strong>Усе спокійно</strong><p>Немає замовлень в обробці або товарів із критично малим залишком.</p></div>';
      root.querySelector("[data-admin-orders]").innerHTML = orders.length
        ? orders.map((order) => orderCard(order, settings, users)).join("")
        : '<p class="admin-empty">Замовлень поки немає.</p>';
      const movements = data.inventoryMovements || [];
      root.querySelector("[data-admin-inventory]").innerHTML = movements.length
        ? `<div class="admin-inventory-list">${movements.map((movement) => {
            const productName = products.find((product) => product.id === movement.productId)?.name || movement.productId;
            const reason = { order_reserved: "Резерв замовлення", order_reopened: "Повторне відкриття замовлення", order_cancelled: "Скасування замовлення", order_returned: "Повернення товару", manual_adjustment: "Ручне коригування", initial_stock: "Початковий залишок" }[movement.reason] || movement.reason;
            return `<article><div><strong>${safe(productName)}</strong><small>${safe(reason)}${movement.orderId ? ` · № ${safe(movement.orderId)}` : ""}</small></div><b class="${movement.quantityChange < 0 ? "is-negative" : ""}">${movement.quantityChange > 0 ? "+" : ""}${movement.quantityChange} шт.</b><time>${shortDate(movement.date)}</time></article>`;
          }).join("")}</div>`
        : '<p class="admin-empty">Історії руху залишків ще немає. На GitHub Pages без серверних функцій журнал обмежений.</p>';
      root.querySelector("[data-admin-products]").innerHTML = canCatalog
        ? `<button class="button button-primary" type="button" data-admin-add-product>＋ Додати товар</button>${productEditor(null)}${products.map(productEditor).join("")}`
        : products.map(warehouseProductEditor).join("");
      root.querySelector("[data-admin-projects]").innerHTML = `${projectEditor(null, products)}${projects.map((project) => projectEditor(project, products)).join("")}`;
      root.querySelector("[data-admin-coupons]").innerHTML = `${couponEditor(null)}${coupons.map(couponEditor).join("")}`;
      root.querySelector("[data-admin-reviews]").innerHTML = reviews.length
        ? reviews
            .map((review) => {
              const productName =
                products.find((item) => item.id === review.productId)?.name ||
                review.productId;
              return `<article class="admin-record" data-review-search="${safe(`${review.userName} ${productName} ${review.text}`)}"><div><strong>${safe(review.userName)} · ${"★".repeat(review.rating)}</strong><small>${safe(productName)} · ${shortDate(review.date)}</small><p>${safe(review.text)}</p>${review.imageUrl ? `<a href="${safe(review.imageUrl)}" target="_blank" rel="noopener noreferrer"><img class="admin-review-photo" src="${safe(review.imageUrl)}" alt="Фото у відгуку" loading="lazy" referrerpolicy="no-referrer"></a>` : ""}</div><button class="button button-quiet" type="button" data-delete-review="${safe(review.id)}" aria-label="Видалити відгук">Видалити</button></article>`;
            })
            .join("")
        : '<p class="admin-empty">Відгуків поки немає.</p>';
      root.querySelector("[data-admin-users]").innerHTML = users.length
        ? `<div class="admin-user-list">${users.map((account) => `<article class="admin-record" data-user-search="${safe(`${account.name} ${account.email}`)}"><div><strong>${safe(account.name)} · ${roleName(account.role)}</strong><small>${safe(account.email)} · ${shortDate(account.createdAt)}</small>${account.role !== "admin" && canUsers ? `<small data-reset-result="${safe(account.id)}" role="status"></small>` : ""}</div><span>${account.orderCount ?? "—"} замовл.</span>${isAdmin() && account.role !== "admin" ? `<label>Роль<select data-role-select="${safe(account.id)}" ${account.id === getCurrentUser()?.id ? "disabled" : ""}>${staffRoles.map(([role, label]) => `<option value="${role}" ${role === account.role ? "selected" : ""}>${label}</option>`).join("")}</select></label><button class="button button-quiet" type="button" data-save-role="${safe(account.id)}" ${account.id === getCurrentUser()?.id ? "disabled" : ""}>Зберегти роль</button>` : ""}${canSupport && account.role === "user" ? `<button class="button button-quiet" type="button" data-reset-user="${safe(account.id)}" data-reset-email="${safe(account.email)}">${isFirebaseConfigured() ? "Надіслати посилання для зміни пароля" : "Видати тимчасовий пароль"}</button>` : ""}</article>`).join("")}</div>`
        : '<p class="admin-empty">Користувачів поки немає.</p>';
      if (isFirebaseConfigured()) {
        errorBox.textContent =
          "Дані зберігаються у Firebase. Перевір ціни й залишки кожного нового замовлення перед підтвердженням: GitHub Pages не має захищеного сервера для автоматичної перевірки та списання складу.";
        errorBox.hidden = false;
      }
      root.querySelector("[data-admin-updated]").textContent =
        `Оновлено о ${formatDate(new Date(), { hour: "2-digit", minute: "2-digit" })}`;
      applyAdminFilters(root);
    } catch (error) {
      errorBox.textContent =
        error.message === "BACKEND_UNAVAILABLE"
          ? "Сервер недоступний. Запусти npm start і онови сторінку."
          : isFirebaseConfigured()
            ? "Не вдалося завантажити дані Firebase. Перевір, що Firestore створено, опубліковано правила з firebase/firestore.rules і роль цього акаунта — admin."
            : "Не вдалося завантажити дані. Онови сторінку або перевір з’єднання з базою.";
      errorBox.hidden = false;
    } finally {
      root.querySelector("[data-admin-refresh]").disabled = false;
    }
  }
  function applyAdminFilters(container) {
    const filter = (selector, inputSelector, emptySelector, searchValue) => {
      const items = [...container.querySelectorAll(selector)];
      const query = container
        .querySelector(inputSelector)
        .value.trim()
        .toLocaleLowerCase("uk-UA");
      let visible = 0;
      items.forEach((item) => {
        const matches = searchValue(item)
          .toLocaleLowerCase("uk-UA")
          .includes(query);
        item.hidden = !matches;
        if (matches) visible++;
      });
      container.querySelector(emptySelector).hidden =
        !items.length || visible > 0;
      return { total: items.length, visible };
    };
    const orderQuery = container
      .querySelector("[data-order-search-input]")
      .value.trim()
      .toLocaleLowerCase("uk-UA");
    const status = container.querySelector("[data-order-status-filter]").value;
    const orderCards = [...container.querySelectorAll("[data-order-status]")];
    let visibleOrders = 0;
    orderCards.forEach((card) => {
      const matches =
        card.dataset.orderSearch
          .toLocaleLowerCase("uk-UA")
          .includes(orderQuery) &&
        (status === "all" || card.dataset.orderStatus === status);
      card.hidden = !matches;
      if (matches) visibleOrders++;
    });
    container.querySelector("[data-order-empty]").hidden =
      !orderCards.length || visibleOrders > 0;
    container.querySelector("[data-admin-order-count]").textContent =
      orderCards.length
        ? `Показано ${visibleOrders} з ${orderCards.length}`
        : "";
    const products = filter(
      ".admin-product-editor[data-existing='true'], [data-warehouse-product]",
      "[data-product-search-input]",
      "[data-product-empty]",
      (item) => item.dataset.productSearch,
    );
    container.querySelector("[data-admin-product-count]").textContent =
      products.total
        ? `Показано ${products.visible} з ${products.total} товарів`
        : "";
    const projects = filter(
      ".admin-project-editor[data-project-id]:not([data-project-id=''])",
      "[data-project-search-input]",
      "[data-project-empty]",
      (item) => `${item.dataset.projectSearch || ""} ${item.querySelector('[name="name"]')?.value || ""} ${item.querySelector('[name="description"]')?.value || ""}`,
    );
    container.querySelector("[data-admin-project-count]").textContent =
      projects.total ? `Показано ${projects.visible} з ${projects.total} проєктів` : "";
    filter(
      "[data-review-search]",
      "[data-review-search-input]",
      "[data-review-empty]",
      (item) => item.dataset.reviewSearch,
    );
    filter(
      "[data-user-search]",
      "[data-user-search-input]",
      "[data-user-empty]",
      (item) => item.dataset.userSearch,
    );
  }
  for (const input of root.querySelectorAll(
    "[data-order-search-input], [data-order-status-filter], [data-product-search-input], [data-project-search-input], [data-review-search-input], [data-user-search-input]",
  )) {
    input.addEventListener("input", () => applyAdminFilters(root));
    input.addEventListener("change", () => applyAdminFilters(root));
  }
  root.addEventListener("click", async (event) => {
    if (event.target.closest("[data-export-orders]")) {
      downloadOrdersCsv(currentOrders);
      return;
    }
    if (event.target.closest("[data-export-products]")) {
      downloadProductsJson(currentProducts);
      return;
    }
    const sectionLink = event.target.closest('a[href^="#admin-"]');
    if (sectionLink && adminSections.some((section) => `#${section.id}` === sectionLink.hash)) {
      event.preventDefault();
      if (window.location.hash !== sectionLink.hash) {
        window.history.pushState(null, "", sectionLink.hash);
      }
      activateAdminSection();
      if (sectionLink.hasAttribute("data-admin-open-product")) {
        const editor = root.querySelector(".admin-product-editor");
        editor.open = true;
        editor.querySelector("[name=id]").focus();
      }
      return;
    }
    if (event.target.closest("[data-admin-refresh]")) return load();
    if (event.target.closest("[data-admin-add-product], [data-admin-open-product]")) {
      const editor = root.querySelector(".admin-product-editor");
      editor.open = true;
      editor.querySelector("[name=id]").focus();
      return;
    }
    if (event.target.closest("[data-admin-add-project]")) {
      const editor = root.querySelector('.admin-project-editor[data-project-id=""]');
      editor.open = true;
      editor.querySelector("[name=id]").focus();
      return;
    }
    if (event.target.closest("[data-add-component]")) {
      const form = event.target.closest("[data-admin-project]");
      const rows = form.querySelector(".admin-project-components");
      const row = rows.firstElementChild.cloneNode(true);
      row.querySelector("[data-component-product]").selectedIndex = 0;
      row.querySelector("[data-component-quantity]").value = "1";
      rows.append(row);
      row.querySelector("[data-component-product]").focus();
      return;
    }
    if (event.target.closest("[data-remove-component]")) {
      const form = event.target.closest("[data-admin-project]");
      const rows = form.querySelectorAll("[data-project-component]");
      if (rows.length === 1) {
        form.querySelector("[data-admin-status]").textContent = "У кожному проєкті має залишитися хоча б один компонент.";
        return;
      }
      event.target.closest("[data-project-component]").remove();
      return;
    }
    const deleteProject = event.target.closest("[data-delete-project]");
    if (deleteProject) {
      if (!window.confirm(`Видалити проєкт «${deleteProject.dataset.deleteProject}»? Його буде також прибрано з майстерень користувачів.`)) return;
      deleteProject.disabled = true;
      try {
        if (isFirebaseConfigured())
          await removeFirebaseProject(deleteProject.dataset.deleteProject);
        else
          await request("admin/projects", { method: "DELETE", body: { id: deleteProject.dataset.deleteProject } });
        await load();
      } catch (error) {
        const status = deleteProject.closest("form").querySelector("[data-admin-status]");
        status.textContent = error.message === "PROJECT_NOT_FOUND" ? "Проєкт уже видалено. Онови список." : "Не вдалося видалити проєкт. Спробуй ще раз.";
        deleteProject.disabled = false;
      }
      return;
    }
    const deleteProduct = event.target.closest("[data-delete-product]");
    if (deleteProduct) {
      if (
        !window.confirm(
          `Видалити товар «${deleteProduct.dataset.deleteProduct}»?`,
        )
      )
        return;
      deleteProduct.disabled = true;
      try {
        if (isFirebaseConfigured())
          await removeFirebaseProduct(deleteProduct.dataset.deleteProduct);
        else
          await request("admin/products", {
            method: "DELETE",
            body: { id: deleteProduct.dataset.deleteProduct },
          });
        await refreshProducts();
        await load();
      } catch {
        const status = deleteProduct
          .closest("form")
          .querySelector("[data-admin-status]");
        status.textContent =
          "Не вдалося видалити товар. Онови сторінку і спробуй ще раз.";
        deleteProduct.disabled = false;
      }
      return;
    }
    const button = event.target.closest("[data-delete-review]");
    if (!button) return;
    if (!window.confirm("Видалити цей відгук?")) return;
    button.disabled = true;
    try {
      if (isFirebaseConfigured())
        await removeFirebaseReview(button.dataset.deleteReview);
      else
        await request("admin/reviews", {
          method: "DELETE",
          body: { id: button.dataset.deleteReview },
        });
      await load();
    } catch {
      errorBox.textContent =
        "Не вдалося видалити відгук. Онови сторінку та спробуй ще раз.";
      errorBox.hidden = false;
      button.disabled = false;
    }
  });
  root.addEventListener("change", async (event) => {
    const input = event.target.closest("[data-import-products]");
    if (!input?.files?.[0]) return;
    const status = root.querySelector("[data-import-products-status]");
    const file = input.files[0];
    input.value = "";
    if (file.size > 2_000_000) {
      status.textContent = "Файл має бути меншим за 2 МБ.";
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const items = Array.isArray(data) ? data : data.products;
      if (!Array.isArray(items) || !items.length || items.length > 200)
        throw new Error("INVALID_IMPORT");
      const ids = new Set();
      for (const product of items) {
        if (!product || typeof product.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.id)
          || ids.has(product.id) || typeof product.name !== "string" || !product.name.trim()
          || !Number.isFinite(Number(product.price)) || Number(product.price) < 0
          || !Number.isInteger(Number(product.stock)) || Number(product.stock) < 0
          || !Array.isArray(product.images) || product.images.some((image) => typeof image !== "string"))
          throw new Error("INVALID_IMPORT");
        ids.add(product.id);
      }
      if (!window.confirm(`Імпортувати ${items.length} товарів? Позиції з однаковими артикулами буде оновлено.`)) return;
      status.textContent = "Імпорт триває…";
      const result = isFirebaseConfigured()
        ? await importFirebaseCatalog(items)
        : await request("admin/products/import", { method: "POST", body: { products: items } });
      await refreshProducts();
      await load();
      status.textContent = `Імпортовано товарів: ${result.imported}.`;
    } catch (error) {
      status.textContent = ["INVALID_IMPORT", "INVALID_CATALOG_IMPORT", "INVALID_CATALOG_PRODUCT", "INVALID_PRODUCT", "INVALID_INPUT"].includes(error.message)
        ? "Файл має містити до 200 коректних товарів: унікальні артикули, назви, ціни, залишки й фото. Каталог не змінено."
        : error.message === "FORBIDDEN" || error.status === 403
          ? "Для імпорту потрібна роль менеджера каталогу."
          : "Не вдалося підтвердити результат. Імпорт атомарний: пакет оновлюється повністю або не змінюється. Онови список і перевір каталог.";
    }
  });
  root.addEventListener("click", async (event) => {
    const returnButton = event.target.closest("[data-review-return]");
    if (returnButton) {
      const decision = returnButton.dataset.reviewReturn;
      const note = decision === "rejected"
        ? window.prompt("Причина відмови (необов’язково):", "")
        : "";
      if (note === null) return;
      if (decision === "accepted" && !window.confirm("Прийняти повернення? У локальному режимі товар повернеться на склад.")) return;
      const card = returnButton.closest(".admin-order");
      const output = card.querySelector("[data-return-status]");
      returnButton.disabled = true;
      output.textContent = "Збереження…";
      try {
        if (isFirebaseConfigured()) await reviewFirebaseOrderReturn(returnButton.dataset.orderId, decision, note);
        else await request("admin/orders/return", { method: "PATCH", body: { id: returnButton.dataset.orderId, decision, note } });
        await refreshProducts();
        await load();
      } catch (error) {
        output.textContent = error.message === "RETURN_NOT_PENDING"
          ? "Заявку вже розглянули. Онови список."
          : "Не вдалося зберегти рішення. Перевір з’єднання та спробуй ще раз.";
        returnButton.disabled = false;
      }
      return;
    }
    const roleButton = event.target.closest("[data-save-role]");
    if (roleButton) {
      const id = roleButton.dataset.saveRole;
      const role = root.querySelector(`[data-role-select="${CSS.escape(id)}"]`)?.value;
      roleButton.disabled = true;
      try {
        if (isFirebaseConfigured()) await updateFirebaseUserRole(id, role);
        else await request("admin/users/role", { method: "PATCH", body: { id, role } });
        await load();
        root.querySelector(`[data-user-search] [data-role-select="${CSS.escape(id)}"]`)?.insertAdjacentHTML("afterend", '<small role="status">Роль оновлено.</small>');
      } catch (error) {
        const output = root.querySelector(`[data-reset-result="${CSS.escape(id)}"]`);
        if (output) output.textContent = error.message === "CANNOT_CHANGE_OWN_ROLE"
          ? "Не можна змінити власну роль."
          : error.message === "LAST_ADMIN"
            ? "У системі має залишитися щонайменше один адміністратор."
            : "Не вдалося змінити роль. Перевір з’єднання та права доступу.";
        roleButton.disabled = false;
      }
      return;
    }
    const button = event.target.closest("[data-reset-user]");
    if (!button) return;
    const email = button.dataset.resetEmail || button.closest(".admin-record").querySelector("small").textContent.split(" · ")[0];
    if (!window.confirm(
      isFirebaseConfigured()
        ? `Надіслати посилання для зміни пароля на ${email}?`
        : "Видати користувачу новий тимчасовий пароль? Його активні сеанси буде завершено.",
    ))
      return;
    button.disabled = true;
    const output = root.querySelector(
      `[data-reset-result="${CSS.escape(button.dataset.resetUser)}"]`,
    );
    try {
      if (isFirebaseConfigured()) {
        await firebaseSendPasswordReset(email);
        output.textContent = "Посилання надіслано на електронну пошту користувача.";
        button.textContent = "Посилання надіслано";
      } else {
        const { temporaryPassword } = await request(
          "admin/users/reset-password",
          { method: "POST", body: { id: button.dataset.resetUser } },
        );
        output.textContent = `Тимчасовий пароль (покажи користувачу безпечним способом): ${temporaryPassword}`;
        button.textContent = "Пароль видано";
      }
    } catch {
      output.textContent =
        "Не вдалося змінити пароль. Онови сторінку й спробуй ще раз.";
      button.disabled = false;
    }
  });
  root.addEventListener("submit", async (event) => {
    const stockForm = event.target.closest("[data-warehouse-product]");
    const productForm = event.target.closest("[data-admin-product]");
    const projectForm = event.target.closest("[data-admin-project]");
    const couponForm = event.target.closest("[data-admin-coupon]");
    const orderForm = event.target.closest("[data-admin-order]");
    const settingsForm = event.target.closest("[data-admin-settings]");
    const form = stockForm || productForm || projectForm || couponForm || orderForm || settingsForm;
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]'),
      status = form.querySelector("[data-admin-status], [data-admin-settings-status]");
    if (button.disabled) return;
    button.disabled = true;
    status.textContent = "Збереження…";
    try {
      if (stockForm) {
        const stock = Number(form.elements.stock.value);
        if (!Number.isInteger(stock) || stock < 0 || stock > 100000) throw new Error("INVALID_STOCK");
        if (isFirebaseConfigured()) await saveFirebaseStock(form.dataset.warehouseProduct, stock);
        else await request("admin/products", { method: "PATCH", body: { id: form.dataset.warehouseProduct, stock } });
        await refreshProducts();
        await load();
        const saved = root.querySelector(`[data-warehouse-product="${CSS.escape(form.dataset.warehouseProduct)}"]`);
        if (saved) saved.querySelector("[data-admin-status]").textContent = "Залишок оновлено, зміну записано в журнал.";
      } else if (settingsForm) {
        const parseMethods = (value) => value.split(/\r?\n/).filter((line) => line.trim()).map((line) => {
          const divider = line.indexOf("|");
          if (divider < 1 || !line.slice(0, divider).trim() || !line.slice(divider + 1).trim()) throw new Error("INVALID_SETTINGS_METHODS");
          return { id: line.slice(0, divider).trim(), name: line.slice(divider + 1).trim() };
        });
        const settings = {
          name: settingsForm.elements.name.value.trim(),
          sellerName: settingsForm.elements.sellerName.value.trim(),
          sellerCity: settingsForm.elements.sellerCity.value.trim(),
          supportPhone: settingsForm.elements.supportPhone.value.trim() || null,
          supportEmail: settingsForm.elements.supportEmail.value.trim() || null,
          warrantyMonths: settingsForm.elements.warrantyMonths.value === "" ? null : Number(settingsForm.elements.warrantyMonths.value),
          deliveryMethods: parseMethods(settingsForm.elements.deliveryMethods.value),
          paymentMethods: parseMethods(settingsForm.elements.paymentMethods.value),
          deliveryNote: settingsForm.elements.deliveryNote.value.trim(),
          priceNote: settingsForm.elements.priceNote.value.trim(),
          demoNotice: settingsForm.elements.demoNotice.value.trim(),
          returnInstructions: settingsForm.elements.returnInstructions.value.trim(),
        };
        const savedSettings = isFirebaseConfigured()
          ? await saveFirebaseSettings(settings)
          : (await request("admin/settings", { method: "PUT", body: settings })).settings;
        setShopSettings(savedSettings);
        status.textContent = "Налаштування збережено. Вони вже діють на сайті.";
      } else if (couponForm) {
        const date = form.elements.validUntil.value;
        const coupon = {
          code: form.elements.code.value.trim().toUpperCase(),
          percent: Number(form.elements.percent.value),
          minTotal: Number(form.elements.minTotal.value),
          maxUses: form.elements.maxUses.value === "" ? null : Number(form.elements.maxUses.value),
          usedCount: Number(form.dataset.couponUsedCount || 0),
          validUntil: date ? `${date}T23:59:59.999Z` : null,
          active: form.elements.active.checked,
        };
        if (isFirebaseConfigured()) await saveFirebaseCoupon(coupon, { create: form.dataset.adminCoupon === "new" });
        else await request("admin/coupons", {
          method: form.dataset.adminCoupon === "edit" ? "PATCH" : "POST",
          body: coupon,
        });
        await load();
        const editor = [...root.querySelectorAll("[data-admin-coupon]")].find((item) => item.elements.code.value === coupon.code);
        if (editor) editor.querySelector("[data-admin-status]").textContent = "Купон збережено.";
      } else if (projectForm) {
        const input = {
          id: form.elements.id.value.trim(),
          name: form.elements.name.value.trim(),
          description: form.elements.description.value.trim(),
          difficulty: form.elements.difficulty.value,
          bundleDiscountPercent: Number(form.elements.bundleDiscountPercent.value),
          image: form.elements.image.value,
          steps: form.elements.steps.value.split(/\r?\n/).map((step) => step.trim()).filter(Boolean),
          components: [...form.querySelectorAll("[data-project-component]")].map((row) => ({
            productId: row.querySelector("[data-component-product]").value,
            quantity: Number(row.querySelector("[data-component-quantity]").value),
          })),
        };
        if (isFirebaseConfigured()) await saveFirebaseProject(input);
        else
          await request("admin/projects", {
            method: form.dataset.adminProject === "edit" ? "PATCH" : "POST",
            body: input,
          });
        await load();
        const editor = [...root.querySelectorAll(".admin-project-editor")].find((item) => item.dataset.projectId === input.id);
        if (editor) {
          editor.open = true;
          editor.querySelector("[data-admin-status]").textContent = "Проєкт збережено.";
        }
      } else if (productForm) {
        const specifications = {};
        for (const line of form.elements.specifications.value.split(/\r?\n/)) {
          if (!line.trim()) continue;
          const colon = line.indexOf(":");
          if (colon < 1) throw new Error("INVALID_SPECS");
          specifications[line.slice(0, colon).trim()] = line
            .slice(colon + 1)
            .trim();
        }
        const input = {
          id: form.elements.id.value.trim(),
          name: form.elements.name.value.trim(),
          category: form.elements.category.value,
          description: form.elements.description.value.trim(),
          brand: form.elements.brand.value.trim(),
          subcategory: form.elements.subcategory.value.trim(),
          sku: form.elements.sku.value.trim(),
          image: form.elements.image.value,
          price: Number(form.elements.price.value),
          oldPrice:
            form.elements.oldPrice.value === ""
              ? null
              : Number(form.elements.oldPrice.value),
          stock: Number(form.elements.stock.value),
          tags: form.elements.tags.value
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          featured: form.elements.featured.checked,
          isNew: form.elements.isNew.checked,
          specifications,
          images: form.elements.images.value
            .split(/\r?\n/)
            .map((image) => image.trim())
            .filter(Boolean),
        };
        if (isFirebaseConfigured()) await saveFirebaseProduct(input);
        else
          await request("admin/products", {
            method: form.dataset.existing === "true" ? "PATCH" : "POST",
            body: input,
          });
        await refreshProducts();
        if (form.dataset.existing === "true") {
          await load();
          const editor = [
            ...root.querySelectorAll(".admin-product-editor"),
          ].find((item) => item.dataset.productId === input.id);
          if (editor) {
            editor.open = true;
            editor.querySelector("[data-admin-status]").textContent =
              "Зміни збережено.";
          }
        } else await load();
      } else {
        if (
          form.elements.status.value === "returned" &&
          !window.confirm(
            "Підтверджуєш, що повернений товар фактично отримано і його можна знову додати на склад?",
          )
        ) {
          status.textContent = "Статус не змінено.";
          return;
        }
        if (isFirebaseConfigured())
          await updateFirebaseOrderStatus(
            form.dataset.adminOrder,
            {
              status: form.elements.status.value,
              trackingNumber: form.elements.trackingNumber.value.trim(),
              statusHistory: (() => {
                const history = JSON.parse(form.elements.statusHistory.value);
                const changed = form.elements.status.value !== form.dataset.currentStatus;
                const trackingChanged = form.elements.trackingNumber.value.trim() !== form.dataset.currentTracking;
                if (changed) history.push({ status: form.elements.status.value, date: new Date().toISOString() });
                else if (trackingChanged) history.push({ status: form.dataset.currentStatus, date: new Date().toISOString(), note: "Номер відстеження оновлено" });
                return history;
              })(),
            },
          );
        else
          await request("admin/orders", {
            method: "PATCH",
            body: {
              id: form.dataset.adminOrder,
              status: form.elements.status.value,
              trackingNumber: form.elements.trackingNumber.value.trim(),
            },
          });
        status.textContent = "Статус збережено.";
        await load();
      }
    } catch (error) {
      status.textContent =
        error.message === "COUPON_EXISTS"
          ? "Такий код уже є. Відкрий його у списку нижче, щоб змінити умови."
          : error.message === "INVALID_COUPON"
            ? "Перевір формат коду, відсоток, мінімальну суму, ліміт і дату завершення."
            : error.message === "PROJECT_EXISTS"
          ? "Такий артикул проєкту вже використовується."
          : error.message === "INVALID_PROJECT_COMPONENT"
            ? "У складі є товар, якого немає в каталозі. Онови сторінку та перевір компоненти."
            : error.message === "INVALID_PROJECT"
              ? "Перевір артикул, назву, опис і склад проєкту."
              : error.message === "INVALID_SETTINGS_METHODS" || error.message === "INVALID_SETTINGS"
                ? "Перевір способи: кожен рядок має містити унікальний латинський ID, символ | та назву."
                : error.message === "INVALID_SPECS"
                  ? "Характеристику введи у форматі «назва: значення»."
                  : error.message === "PRODUCT_EXISTS"
                    ? "Такий артикул уже є у каталозі."
                    : error.message === "INVALID_PRODUCT" || error.message === "INVALID_INPUT"
                      ? "Перевір обов’язкові поля, ціну, залишок і посилання на фото."
                      : error.message === "OUT_OF_STOCK"
                        ? "Недостатньо залишку, щоб відновити замовлення."
                        : error.message === "TRACKING_REQUIRED"
                          ? "Вкажи номер відстеження перед передачею перевізнику."
                          : error.message === "INVALID_ORDER_TRANSITION"
                            ? "Цей перехід статусу недоступний."
                            : "Не вдалося зберегти. Спробуй ще раз.";
    } finally {
      button.disabled = false;
    }
  });
  await load();
}
