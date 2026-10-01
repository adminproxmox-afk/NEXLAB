import { login, register } from '../api/authService.js';
import { getUserByEmail } from './users.js';
import { toast } from './notifications.js';

function errorFor(form,name) { return form.querySelector(`[data-error="${name}"]`); }
function setError(form,name,message='') {
  const field = form.elements.namedItem(name);
  const output = errorFor(form,name);
  if (output) output.textContent = message;
  field?.setAttribute('aria-invalid',String(Boolean(message)));
}
function clearErrors(form) { form.querySelectorAll('.field-error').forEach(node => node.textContent=''); form.querySelectorAll('[aria-invalid]').forEach(node => node.removeAttribute('aria-invalid')); }
function setBusy(button,busy,label) { button.disabled=busy; button.textContent=busy?'Зачекай…':label; }

function destination() {
  const target = new URLSearchParams(location.search).get('redirect') || 'profile.html';
  try {
    const url = new URL(target,location.href);
    const base=new URL('.',location.href);
    return url.protocol===base.protocol && url.origin===base.origin && url.pathname.startsWith(base.pathname) && url.pathname.endsWith('.html') ? url.href : new URL('profile.html',location.href).href;
  } catch { return new URL('profile.html',location.href).href; }
}

export function initializeAuthForms() {
  const loginForm = document.querySelector('[data-login-form]');
  loginForm?.addEventListener('submit', async event => {
    event.preventDefault(); clearErrors(loginForm);
    const email=loginForm.elements.email.value.trim(); const password=loginForm.elements.password.value;
    let valid=true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(loginForm,'email','Введи коректну адресу електронної пошти.'); valid=false; }
    if (!password) { setError(loginForm,'password','Введи пароль.'); valid=false; }
    if (!valid) return;
    const button=loginForm.querySelector('button[type="submit"]'); setBusy(button,true,'Увійти');
    try { const user=login({email,password}); toast(`Раді бачити знову, ${user.name}`); location.href=destination(); }
    catch { setError(loginForm,'password','Електронна пошта або пароль не збігаються.'); setBusy(button,false,'Увійти'); }
  });

  const registerForm = document.querySelector('[data-register-form]');
  registerForm?.addEventListener('submit',event => {
    event.preventDefault(); clearErrors(registerForm);
    const name=registerForm.elements.name.value.trim(); const email=registerForm.elements.email.value.trim();
    const password=registerForm.elements.password.value; const confirm=registerForm.elements.confirmPassword.value;
    let valid=true;
    if (!name) { setError(registerForm,'name','Введи своє ім’я.'); valid=false; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(registerForm,'email','Введи коректну адресу електронної пошти.'); valid=false; }
    else if (getUserByEmail(email)) { setError(registerForm,'email','Цю адресу вже зареєстровано.'); valid=false; }
    if (password.length<6) { setError(registerForm,'password','Пароль має містити щонайменше 6 символів.'); valid=false; }
    if (confirm!==password) { setError(registerForm,'confirmPassword','Паролі не збігаються.'); valid=false; }
    if (!registerForm.elements.terms.checked) { setError(registerForm,'terms','Потрібно прийняти умови користування.'); valid=false; }
    if (!valid) return;
    const button=registerForm.querySelector('button[type="submit"]'); setBusy(button,true,'Створити обліковий запис');
    try { const user=register({name,email,password}); toast(`Обліковий запис створено, ${user.name}`); location.href=destination(); }
    catch (error) { setError(registerForm,'email',error.message==='EMAIL_TAKEN'?'Цю адресу вже зареєстровано.':'Не вдалося створити обліковий запис.'); setBusy(button,false,'Створити обліковий запис'); }
  });

  const forgotForm=document.querySelector('[data-forgot-form]');
  document.querySelector('[data-forgot-toggle]')?.addEventListener('click',() => {
    const panel=document.querySelector('[data-forgot-panel]'); panel.hidden=!panel.hidden;
    if (!panel.hidden) panel.querySelector('input').focus();
  });
  forgotForm?.addEventListener('submit',event => {
    event.preventDefault(); clearErrors(forgotForm);
    const email=forgotForm.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError(forgotForm,'email','Введи коректну адресу електронної пошти.'); return; }
    toast(getUserByEmail(email)?'Це демоверсія: для відновлення пароля звернися до служби підтримки.':'Облікового запису з такою адресою не знайдено.');
  });
}
