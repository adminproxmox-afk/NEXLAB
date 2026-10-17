import { login, register } from "../api/authService.js";
import { hasBackend } from "../api/client.js";
import { toast } from "./notifications.js";
import { requestedAuthDestination, safeAuthDestination } from "./auth-redirect.js";

function errorFor(form, name) {
  return form.querySelector(`[data-error="${name}"]`);
}
function setError(form, name, message = "") {
  const field = form.elements.namedItem(name);
  const output = errorFor(form, name);
  if (output) output.textContent = message;
  field?.setAttribute("aria-invalid", String(Boolean(message)));
}
function clearErrors(form) {
  form
    .querySelectorAll(".field-error")
    .forEach((node) => (node.textContent = ""));
  form
    .querySelectorAll("[aria-invalid]")
    .forEach((node) => node.removeAttribute("aria-invalid"));
}
function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = busy ? "Зачекай…" : label;
}

function destination() {
  return requestedAuthDestination(location.search, location.href)
    || safeAuthDestination("profile.html", location.href);
}

function preserveAuthRedirect() {
  const redirect = requestedAuthDestination(location.search, location.href);
  if (!redirect) return;
  document.querySelectorAll('a[href$="register.html"], a[href$="login.html"]')
    .forEach((link) => {
      const target = new URL(link.getAttribute("href"), location.href);
      target.searchParams.set("redirect", redirect);
      link.href = target.href;
    });
}

export function initializeAuthForms() {
  preserveAuthRedirect();
  if (!hasBackend()) {
    const form = document.querySelector(
      "[data-login-form],[data-register-form]",
    );
    if (form)
      form.insertAdjacentHTML(
        "beforebegin",
        '<p class="demo-notice" role="status">Для облікових записів потрібен запущений сервер NEXLAB або налаштований Firebase. Каталог і проєкти доступні без входу.</p>',
      );
  }
  const loginForm = document.querySelector("[data-login-form]");
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(loginForm);
    const email = loginForm.elements.email.value.trim();
    const password = loginForm.elements.password.value;
    let valid = true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(loginForm, "email", "Введи коректну адресу електронної пошти.");
      valid = false;
    }
    if (!password) {
      setError(loginForm, "password", "Введи пароль.");
      valid = false;
    }
    if (!valid) return;
    const button = loginForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Увійти");
    try {
      const user = await login({ email, password });
      toast(`Раді бачити знову, ${user.name}`);
      location.href = destination();
    } catch (error) {
      setError(
        loginForm,
        "password",
        error.message === "BACKEND_UNAVAILABLE"
          ? "Облікові записи потребують запущеного сервера NEXLAB або налаштованого Firebase."
          : "Електронна пошта або пароль не збігаються.",
      );
      setBusy(button, false, "Увійти");
    }
  });

  const registerForm = document.querySelector("[data-register-form]");
  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(registerForm);
    const name = registerForm.elements.name.value.trim();
    const email = registerForm.elements.email.value.trim();
    const password = registerForm.elements.password.value;
    const confirm = registerForm.elements.confirmPassword.value;
    let valid = true;
    if (!name) {
      setError(registerForm, "name", "Введи своє ім’я.");
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(
        registerForm,
        "email",
        "Введи коректну адресу електронної пошти.",
      );
      valid = false;
    }
    if (password.length < 10) {
      setError(
        registerForm,
        "password",
        "Пароль має містити щонайменше 10 символів.",
      );
      valid = false;
    }
    if (confirm !== password) {
      setError(registerForm, "confirmPassword", "Паролі не збігаються.");
      valid = false;
    }
    if (!registerForm.elements.terms.checked) {
      setError(registerForm, "terms", "Потрібно прийняти умови користування.");
      valid = false;
    }
    if (!valid) return;
    const button = registerForm.querySelector('button[type="submit"]');
    setBusy(button, true, "Створити обліковий запис");
    try {
      const user = await register({ name, email, password, terms: true });
      toast(`Обліковий запис створено, ${user.name}`);
      location.href = destination();
    } catch (error) {
      setError(
        registerForm,
        "email",
        error.message === "EMAIL_TAKEN"
          ? "Цю адресу вже зареєстровано."
          : error.message === "BACKEND_UNAVAILABLE"
            ? "Облікові записи потребують запущеного сервера NEXLAB або налаштованого Firebase."
            : "Не вдалося створити обліковий запис.",
      );
      setBusy(button, false, "Створити обліковий запис");
    }
  });

  const forgotPanel = document.querySelector("[data-forgot-panel]");
  document
    .querySelector("[data-forgot-toggle]")
    ?.addEventListener("click", () => {
      if (forgotPanel) forgotPanel.hidden = !forgotPanel.hidden;
    });
}
