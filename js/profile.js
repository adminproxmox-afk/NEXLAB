import { getCurrentUser, logout } from "./session.js";
import { updateProfile, changePassword } from "../api/userService.js";
import { getOrders } from "../api/orderService.js";
import { getMyProjects } from "../api/userProjectsService.js";
import { getFavorites } from "./favorites.js";
import { toast } from "./notifications.js";

const safe = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const date = (value) =>
  new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

function error(form, name, message = "") {
  const field = form.elements.namedItem(name);
  const output = form.querySelector(`[data-error="${name}"]`);
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

export async function initializeProfile() {
  const root = document.querySelector("[data-profile]");
  if (!root) return;
  const user = getCurrentUser();
  if (!user) return;
  const [orders, projects] = await Promise.all([
    getOrders(user.id),
    getMyProjects(user.id),
  ]);
  root.innerHTML = `<div class="page-title"><p class="eyebrow">Особистий простір</p><h1>Мій профіль</h1><p>Керуй даними облікового запису та своїми проєктами.</p></div>
    <div class="profile-layout"><nav class="profile-nav"><a class="is-active" href="#account">Основна інформація</a><a href="orders.html">Мої замовлення <span>${orders.length}</span></a><a href="favorites.html">Обране <span>${getFavorites().length}</span></a><a href="my-projects.html">Мої проєкти <span>${projects.length}</span></a><a href="#settings">Налаштування</a></nav>
    <div class="profile-content"><section class="profile-overview" aria-label="Огляд профілю"><div><span>Замовлення</span><strong>${orders.length}</strong></div><div><span>Обране</span><strong>${getFavorites().length}</strong></div><div><span>Мої проєкти</span><strong>${projects.length}</strong></div></section><section class="profile-panel" id="account"><div class="profile-heading"><span class="profile-avatar">${safe(user.name.slice(0, 1).toUpperCase())}</span><div><p class="eyebrow">Обліковий запис NEXLAB</p><h2>${safe(user.name)}</h2></div></div><dl class="profile-facts"><div><dt>Електронна пошта</dt><dd>${safe(user.email)}</dd></div><div><dt>Дата реєстрації</dt><dd>${date(user.createdAt)}</dd></div><div><dt>Роль</dt><dd>${user.role === "admin" ? "Адміністратор" : "Користувач"}</dd></div></dl>
    <form class="profile-form" data-profile-form novalidate><h3>Основна інформація</h3><label>Ім’я<input name="name" value="${safe(user.name)}" autocomplete="name"><small class="field-error" data-error="name"></small></label><label>Електронна пошта<input name="email" type="email" value="${safe(user.email)}" autocomplete="email"><small class="field-error" data-error="email"></small></label><button class="button button-primary" type="submit">Зберегти зміни</button></form></section>
    <section class="profile-panel" id="settings"><form class="profile-form" data-password-form novalidate><p class="eyebrow">Безпека</p><h3>Змінити пароль</h3><label>Поточний пароль<input name="currentPassword" type="password" autocomplete="current-password"><small class="field-error" data-error="currentPassword"></small></label><label>Новий пароль<input name="newPassword" type="password" autocomplete="new-password"><small class="field-error" data-error="newPassword"></small></label><label>Підтвердження нового пароля<input name="confirmPassword" type="password" autocomplete="new-password"><small class="field-error" data-error="confirmPassword"></small></label><button class="button button-quiet" type="submit">Змінити пароль</button></form></section>
    <button class="logout-button" type="button" data-profile-logout>Вийти з облікового запису</button></div></div>`;
  const profileForm = root.querySelector("[data-profile-form]");
  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(profileForm);
    const name = profileForm.elements.name.value.trim(),
      email = profileForm.elements.email.value.trim();
    let valid = true;
    if (!name) {
      error(profileForm, "name", "Введи своє ім’я.");
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error(profileForm, "email", "Введи коректну адресу електронної пошти.");
      valid = false;
    }
    if (!valid) return;
    try {
      const updated = await updateProfile({ name, email });
      root.querySelector(".profile-heading h2").textContent = updated.name;
      root.querySelector(".profile-avatar").textContent = updated.name
        .slice(0, 1)
        .toUpperCase();
      const facts = root.querySelectorAll(".profile-facts dd");
      facts[0].textContent = updated.email;
      facts[2].textContent =
        updated.role === "admin" ? "Адміністратор" : "Користувач";
      window.dispatchEvent(new Event("nexlab:auth-updated"));
      toast("Профіль оновлено.");
    } catch (err) {
      error(
        profileForm,
        "email",
        err.message === "EMAIL_TAKEN"
          ? "Цю адресу вже використовує інший обліковий запис."
          : "Не вдалося зберегти зміни.",
      );
    }
  });
  const passwordForm = root.querySelector("[data-password-form]");
  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(passwordForm);
    const currentPassword = passwordForm.elements.currentPassword.value,
      newPassword = passwordForm.elements.newPassword.value,
      confirmPassword = passwordForm.elements.confirmPassword.value;
    let valid = true;
    if (!currentPassword) {
      error(passwordForm, "currentPassword", "Введи поточний пароль.");
      valid = false;
    }
    if (newPassword.length < 10) {
      error(
        passwordForm,
        "newPassword",
        "Пароль має містити щонайменше 10 символів.",
      );
      valid = false;
    }
    if (confirmPassword !== newPassword) {
      error(passwordForm, "confirmPassword", "Паролі не збігаються.");
      valid = false;
    }
    if (!valid) return;
    try {
      await changePassword({ currentPassword, newPassword });
      passwordForm.reset();
      toast("Пароль змінено.");
    } catch (err) {
      error(
        passwordForm,
        "currentPassword",
        err.message === "WRONG_PASSWORD"
          ? "Поточний пароль не збігається."
          : "Не вдалося змінити пароль.",
      );
    }
  });
  root
    .querySelector("[data-profile-logout]")
    .addEventListener("click", async () => {
      await logout();
      location.href = "index.html";
    });
}
