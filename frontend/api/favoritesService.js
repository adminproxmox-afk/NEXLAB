import { getCurrentUser } from "../js/session.js";

const LEGACY_KEY = "nexlab-favorites-v1";
const GUEST_KEY = "nexlab_guest_favorites";
const keyFor = (user) =>
  user ? `nexlab_favorites_${user.id}` : "nexlab_guest_favorites";
function read(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value)
      ? [...new Set(value.filter((item) => typeof item === "string"))]
      : [];
  } catch {
    return [];
  }
}

export function getFavorites() {
  try {
    const user = getCurrentUser(),
      key = keyFor(user);
    if (user) {
      const guest = read(GUEST_KEY),
        legacy = read(LEGACY_KEY);
      if (guest.length || legacy.length) {
        localStorage.setItem(
          key,
          JSON.stringify([...new Set([...read(key), ...guest, ...legacy])]),
        );
        localStorage.removeItem(GUEST_KEY);
        localStorage.removeItem(LEGACY_KEY);
      }
    } else if (
      localStorage.getItem(key) === null &&
      localStorage.getItem(LEGACY_KEY)
    ) {
      localStorage.setItem(key, JSON.stringify(read(LEGACY_KEY)));
      localStorage.removeItem(LEGACY_KEY);
    }
    return read(key);
  } catch {
    return [];
  }
}

export function toggleFavorite(id) {
  const items = getFavorites();
  const next = items.includes(id)
    ? items.filter((item) => item !== id)
    : [...items, id];
  try {
    localStorage.setItem(keyFor(getCurrentUser()), JSON.stringify(next));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event("nexlab:favorites-updated"));
  return next.includes(id);
}
