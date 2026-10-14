import { isAuthenticated, isAdmin, requireAuth } from "./session.js";

const protectedPages = new Set([
  "profile.html",
  "orders.html",
  "my-projects.html",
  "checkout.html",
]);

export function protectCurrentPage() {
  const path = location.pathname.toLowerCase();
  const page = path.split("/").pop();
  if (path.includes("/admin/")) {
    if (!isAuthenticated()) {
      requireAuth();
      return false;
    }
    if (!isAdmin()) {
      const root = document.querySelector("[data-admin-content]");
      if (root)
        root.innerHTML =
          '<section class="empty-state"><span class="empty-mark">⌁</span><p class="eyebrow">403 / НЕМАЄ ДОСТУПУ</p><h1>Доступ заборонено</h1><p>Панель керування доступна лише адміністратору.</p><a class="button button-primary" href="../index.html">Повернутися до магазину <span>↗</span></a></section>';
      return false;
    }
    return true;
  }
  return !protectedPages.has(page) || requireAuth();
}
