import { request, setCsrfToken } from '../api/client.js';
let currentUser = null;
export function setSession({user,csrf}) {
  currentUser = user;
  if (csrf !== undefined) setCsrfToken(csrf);
  window.dispatchEvent(new Event('nexlab:auth-updated'));
  return user;
}
export async function initializeSession() {
  localStorage.removeItem('nexlab_users');
  localStorage.removeItem('nexlab_session');
  try { return setSession(await request('session')); }
  catch(error) {
    if(error.message!=='BACKEND_UNAVAILABLE')throw error;
    setCsrfToken('');
    return setSession({user:null});
  }
}
export async function logout() {setSession(await request('auth/logout',{method:'POST',body:{}}));}
export const getCurrentUser = () => currentUser;
export const isAuthenticated = () => Boolean(currentUser);
export const isAdmin = () => currentUser?.role === 'admin';
export function requireAuth() {
  if (isAuthenticated()) return true;
  const inAdmin = location.pathname.toLowerCase().includes('/admin/');
  const current = (inAdmin ? 'admin/index.html' : location.pathname.split('/').pop()) + location.search + location.hash;
  location.href = (inAdmin ? '../' : '') + 'login.html?redirect=' + encodeURIComponent(current || 'profile.html');
  return false;
}
export function requireAdmin() {return requireAuth() && isAdmin();}
