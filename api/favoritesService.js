import { getCurrentUser } from '../js/session.js';

const LEGACY_KEY='nexlab-favorites-v1';
const keyFor=user => user ? `nexlab_favorites_${user.id}` : 'nexlab_guest_favorites';
function read(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } }

export function getFavorites() {
  const user=getCurrentUser(); const key=keyFor(user);
  if (!user && localStorage.getItem(key) === null && localStorage.getItem(LEGACY_KEY)) {
    localStorage.setItem(key,JSON.stringify(read(LEGACY_KEY)));
  }
  return read(key);
}

export function toggleFavorite(id) {
  const items=getFavorites();
  const next=items.includes(id)?items.filter(item=>item!==id):[...items,id];
  localStorage.setItem(keyFor(getCurrentUser()),JSON.stringify(next));
  window.dispatchEvent(new Event('nexlab:favorites-updated'));
  return next.includes(id);
}
