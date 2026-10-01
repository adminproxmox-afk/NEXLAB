import { getUserById } from './users.js';

const SESSION_KEY = 'nexlab_session';

export function login(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({userId:user.id}));
  window.dispatchEvent(new Event('nexlab:auth-updated'));
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('nexlab:auth-updated'));
}

export function getCurrentUser() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    return session?.userId ? getUserById(session.userId) : null;
  } catch { return null; }
}

export const isAuthenticated = () => Boolean(getCurrentUser());
// This role check is only demo UI logic; the server must verify every privileged request.
export const isAdmin = () => getCurrentUser()?.role === 'admin';

export function requireAuth() {
  if (isAuthenticated()) return true;
  const inAdmin = location.pathname.toLowerCase().includes('/admin/');
  const current = `${inAdmin ? 'admin/index.html' : location.pathname.split('/').pop()}${location.search}${location.hash}`;
  const redirect = current || 'profile.html';
  location.href = `${inAdmin ? '../' : ''}login.html?redirect=${encodeURIComponent(redirect)}`;
  return false;
}

export function requireAdmin() { return requireAuth() && isAdmin(); }
