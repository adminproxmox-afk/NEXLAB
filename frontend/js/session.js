import { request, setCsrfToken } from "../api/client.js";
import { firebaseLogout, firebaseSession, isFirebaseConfigured } from "../api/firebaseAuth.js";
let currentUser = null;
export function setSession({ user, csrf }) {
  currentUser = user;
  if (csrf !== undefined) setCsrfToken(csrf);
  window.dispatchEvent(new Event("nexlab:auth-updated"));
  return user;
}
export async function initializeSession() {
  localStorage.removeItem("nexlab_users");
  localStorage.removeItem("nexlab_session");
  if (isFirebaseConfigured()) {
    const session = await firebaseSession();
    return setSession(session);
  }
  try {
    return setSession(await request("session"));
  } catch (error) {
    if (error.message !== "BACKEND_UNAVAILABLE") throw error;
    setCsrfToken("");
    return setSession({ user: null });
  }
}
export async function logout() {
  if (isFirebaseConfigured()) {
    await firebaseLogout();
    return setSession({ user: null, csrf: "firebase" });
  }
  setSession(await request("auth/logout", { method: "POST", body: {} }));
}
export const getCurrentUser = () => currentUser;
export const isAuthenticated = () => Boolean(currentUser);
export const isAdmin = () => currentUser?.role === "admin";
const rolePermissions = {
  order_manager: ["orders"],
  catalog_manager: ["catalog"],
  warehouse: ["warehouse"],
  support: ["support"],
};
export const hasAdminAccess = () => isAdmin() || Boolean(rolePermissions[currentUser?.role]);
export const hasAdminPermission = (permission) => isAdmin() || Boolean(rolePermissions[currentUser?.role]?.includes(permission));
export function requireAuth() {
  if (isAuthenticated()) return true;
  const inAdmin = location.pathname.toLowerCase().includes("/admin/");
  const current =
    (inAdmin ? "admin/index.html" : location.pathname.split("/").pop()) +
    location.search +
    location.hash;
  location.href =
    (inAdmin ? "../" : "") +
    "login.html?redirect=" +
    encodeURIComponent(current || "profile.html");
  return false;
}
export function requireAdmin() {
  return requireAuth() && isAdmin();
}
