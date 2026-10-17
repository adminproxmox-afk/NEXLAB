import { acknowledgeStockAlerts, consumeAvailableStockAlerts } from "../api/stockAlertService.js";
import { getProducts } from "../api/productService.js";
import { getCurrentUser } from "./session.js";
import { currentLanguage } from "./i18n.js";
import { toast } from "./notifications.js";

let timer;
let checking = false;
let pendingCheck = false;

async function checkStockAlerts(products) {
  const uid = getCurrentUser()?.id || "";
  if (!uid || document.hidden) return;
  if (checking) {
    pendingCheck = true;
    return;
  }
  checking = true;
  try {
    const alerts = await consumeAvailableStockAlerts(products || await getProducts());
    if (getCurrentUser()?.id !== uid || !alerts.length) return;
    const labels = {
      uk: "Знову в наявності",
      ru: "Снова в наличии",
      en: "Back in stock",
    };
    toast(`${labels[currentLanguage()] || labels.uk}: ${alerts.map((item) => item.name).join(", ")}`);
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

export function initializeStockAlertNotifications(products) {
  if (timer) return;
  void checkStockAlerts(products);
  timer = window.setInterval(() => void checkStockAlerts(), 60_000);
  window.addEventListener("nexlab:auth-updated", () => void checkStockAlerts());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void checkStockAlerts();
  });
}
