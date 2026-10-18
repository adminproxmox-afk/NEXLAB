const desktopPreferenceKey = (userId) => `nexlab_desktop_notifications_${userId}`;

export function toast(message) {
  const region = document.querySelector("[data-toast-region]");
  if (!region) return;
  const item = document.createElement("div");
  item.className = "toast";
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 2800);
}

export function desktopNotificationsEnabled(userId) {
  if (!userId || typeof globalThis.Notification === "undefined") return false;
  try {
    return Notification.permission === "granted" &&
      localStorage.getItem(desktopPreferenceKey(userId)) === "enabled";
  } catch {
    return false;
  }
}

export function setDesktopNotificationsEnabled(userId, enabled) {
  if (!userId) return false;
  try {
    if (!enabled) {
      localStorage.removeItem(desktopPreferenceKey(userId));
      return true;
    }
    if (typeof globalThis.Notification === "undefined" || Notification.permission !== "granted") return false;
    localStorage.setItem(desktopPreferenceKey(userId), "enabled");
    return true;
  } catch {
    return false;
  }
}

export async function enableDesktopNotifications(userId) {
  if (!userId || typeof globalThis.Notification === "undefined") return "unsupported";
  try {
    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    if (permission !== "granted") return permission;
    return setDesktopNotificationsEnabled(userId, true) ? "granted" : "unavailable";
  } catch {
    return "unavailable";
  }
}

export function showDesktopNotification({ userId, title, body, tag, href }) {
  if (!desktopNotificationsEnabled(userId) || typeof document === "undefined" || !document.hidden) return false;
  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: new URL("../favicon.svg", import.meta.url).href,
    });
    notification.addEventListener("click", () => {
      window.focus();
      if (href) {
        const target = new URL(href, location.href);
        if (target.origin === location.origin) location.assign(target.href);
      }
      notification.close();
    });
    return true;
  } catch {
    return false;
  }
}
