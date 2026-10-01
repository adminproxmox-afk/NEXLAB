const prefix=location.pathname.toLowerCase().includes('/admin/')?'../':'';
const path=location.pathname.split('/').pop()||'index.html';

export function showAuthDialog() {
  const dialog=document.querySelector('[data-auth-gate]');
  if(dialog?.showModal) {
    const redirect=`${path}${location.search}${location.hash}`;
    dialog.querySelector('[data-gate-login]').href=`${prefix}login.html?redirect=${encodeURIComponent(redirect)}`;
    dialog.querySelector('[data-gate-register]').href=`${prefix}register.html?redirect=${encodeURIComponent(redirect)}`;
    dialog.showModal();
  }
  else location.href=`${prefix}login.html?redirect=${encodeURIComponent(`${path}${location.search}`)}`;
}
