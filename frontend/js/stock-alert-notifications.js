import { acknowledgeStockAlerts, consumeAvailableStockAlerts } from "../api/stockAlertService.js";
import { getProducts } from "../api/productService.js";
import { getCurrentUser } from "./session.js";
import { currentLanguage } from "./i18n.js";
import {
  desktopNotificationsEnabled,
  showDesktopNotification,
  toast,
} from "./notifications.js";

let timer;
let checking = false;
let pendingCheck = false;

async function checkStockAlerts() {
  const uid = getCurrentUser()?.id || "";
  if (!uid || (document.hidden && !desktopNotificationsEnabled(uid))) return;
  if (checking) {
    pendingCheck = true;
    return;
  }
  checking = true;
  try {
    const products = await getProducts();
    const alerts = await consumeAvailableStockAlerts(products);
    if (getCurrentUser()?.id !== uid || !alerts.length) return;
    const labels = {
      uk: "Знову в наявності",
      ru: "Снова в наличии",
      en: "Back in stock",
    };
    const title = labels[currentLanguage()] || labels.uk;
    const names = alerts.map((item) => item.name).join(", ");
    if (!showDesktopNotification({
      userId: uid,
      title,
      body: names,
      tag: `nexlab-restock-${alerts.map((item) => item.productId).join("-")}`,
      href: `product.html?id=${encodeURIComponent(alerts[0].productId)}`,
    })) toast(`${title}: ${names}`);
    window.dispatchEvent(new CustomEvent("nexlab:stock-restocked", {
      detail: {
        products: alerts.map(({ productId }) => {
          const product = products.find((item) => item.id === productId);
          return product ? { productId, stock: product.stock } : null;
        }).filter(Boolean),
      },
    }));
    await acknowledgeStockAlerts(alerts);
  } catch (error) {
    if (error.message !== "BACKEND_UNAVAILABLE" && error.message !== "UNAUTHENTICATED")
      console.warn("Restock alerts could not be loaded", error);
  } finally {
    checking = false;
    if (pendingCheck) {
      pendingCheck = false;
      void checkStockAlerts();
    }
  }
}

export function initializeStockAlertNotifications() {
  if (timer) return;
  void checkStockAlerts();
  timer = window.setInterval(() => void checkStockAlerts(), 60_000);
  window.addEventListener("nexlab:auth-updated", () => void checkStockAlerts());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void checkStockAlerts();
  });
}
