import { getOrders } from "../api/orderService.js";
import { collectOrderNotificationUpdates } from "../api/orderNotificationState.js";
import { getCurrentUser } from "./session.js";
import { toast } from "./notifications.js";
import { currentLanguage, translateText } from "./i18n.js";

const storageKey = (uid) => `nexlab_order_notifications_${uid}`;
const statusCopy = {
  processing: "В обробці",
  confirmed: "Підтверджено",
  shipped: "Передано перевізнику",
  delivered: "Доставлено",
  cancelled: "Скасовано",
  returned: "Повернення прийнято",
};
const noteCopy = {
  "Номер відстеження оновлено": {
    uk: "Номер відстеження оновлено",
    ru: "Номер отслеживания обновлён",
    en: "Tracking number updated",
  },
  "Повернення прийнято після отримання товару": {
    uk: "Повернення прийнято після отримання товару",
    ru: "Возврат принят после получения товара",
    en: "Return accepted after the item was received",
  },
  "Заявку на повернення відхилено": {
    uk: "Заявку на повернення відхилено",
    ru: "Заявку на возврат отклонили",
    en: "Return request declined",
  },
  "Повернення прийнято": {
    uk: "Повернення прийнято",
    ru: "Возврат принят",
    en: "Return accepted",
  },
};
let timer;
let loading = false;

function previousState(uid) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(uid)) || "null");
  } catch {
    return null;
  }
}

function showUpdates(orders) {
  if (!orders.length) return;
  const language = currentLanguage();
  const labels = {
    uk: "Оновлення замовлень",
    ru: "Обновления заказов",
    en: "Order updates",
  };
  const lines = orders.slice(0, 3).map((order) => {
    const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
    const latest = history.at(-1);
    const returnStatus = order.returnRequest?.status;
    const event = returnStatus === "rejected"
      ? "Заявку на повернення відхилено"
      : returnStatus === "accepted" ? "Повернення прийнято" : latest?.note || statusCopy[order.status] || order.status;
    const status = noteCopy[event]?.[language] || translateText(event, language);
    return `№ ${order.id} · ${status}`;
  });
  if (orders.length > lines.length) lines.push(`+${orders.length - lines.length}`);
  toast(`${labels[language] || labels.uk}: ${lines.join("; ")}`);
}

async function checkForUpdates() {
  const uid = getCurrentUser()?.id || "";
  if (!uid || loading || (typeof document !== "undefined" && document.hidden)) {
    return;
  }
  loading = true;
  try {
    const orders = await getOrders();
    if (getCurrentUser()?.id !== uid) return;
    const result = collectOrderNotificationUpdates(orders, previousState(uid));
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(result.state));
    } catch {
      // Notifications still work for this check when browser storage is unavailable.
    }
    showUpdates(result.updates);
  } catch (error) {
    if (error.message !== "BACKEND_UNAVAILABLE" && error.message !== "UNAUTHENTICATED")
      console.warn("Order updates could not be checked", error);
  } finally {
    loading = false;
  }
}

export function initializeOrderNotifications() {
  if (timer) return;
  void checkForUpdates();
  timer = window.setInterval(checkForUpdates, 45_000);
  window.addEventListener("nexlab:auth-updated", checkForUpdates);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void checkForUpdates();
  });
}
