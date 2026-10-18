import {
  getMyProjects,
  updateMyProject,
  deleteMyProject,
} from "../api/userProjectsService.js";
import { getProjectById } from "./projectService.js";
import { getProducts } from "./productService.js";
import { toast } from "./notifications.js";
import { money, projectCover, safe } from "./project-ui.js";
import { isFirebaseConfigured } from "../api/firebaseAuth.js";
import { getProjectSteps } from "./project-guides.js";
import { resolveProductImage } from "./products.js";

export async function initializeMyProjects() {
  const root = document.querySelector("[data-my-projects]");
  if (!root) return;
  async function draw() {
    root.innerHTML = '<p role="status">Завантажуємо твою майстерню…</p>';
    try {
      const [saved, products] = await Promise.all([
        getMyProjects(),
        getProducts(),
      ]);
      const records = await Promise.all(
        saved.map(async (record) => ({
          record,
          project: await getProjectById(record.projectId),
        })),
      );
      const valid = records.filter((item) => item.project);
      if (!valid.length) {
        root.innerHTML =
          '<div class="project-empty"><span aria-hidden="true">◈</span><h2>Майстерня поки порожня</h2><p>Збережи цікавий проєкт — тут зможеш відмічати підготовлені компоненти й стежити за збіркою.</p><a class="button button-primary" href="projects.html">Обрати проєкт <span>↗</span></a></div>';
        return;
      }
      root.innerHTML = `<div class="my-project-grid">${valid
        .map(({ record, project }) => {
          const checklist = project.components.map(
            (_, index) => record.checklist?.[index] === true,
          );
          const steps = getProjectSteps(project);
          const stepChecklist = steps.map(
            (_, index) => record.stepChecklist?.[index] === true,
          );
          const totalTasks = checklist.length + stepChecklist.length;
          const completed = [...checklist, ...stepChecklist].filter(Boolean).length,
            progress = totalTasks
              ? Math.round((completed / totalTasks) * 100)
              : 0;
          return `<article class="my-project-card" data-saved-project="${safe(project.id)}"><a href="project.html?id=${encodeURIComponent(project.id)}" class="my-project-art">${projectCover(project, products)}</a><div class="my-project-copy"><div class="my-project-heading"><p class="eyebrow">${safe(project.difficulty)}</p><a class="my-project-open" href="project.html?id=${encodeURIComponent(project.id)}" aria-label="Відкрити ${safe(project.name)}">↗</a></div><h2><a href="project.html?id=${encodeURIComponent(project.id)}">${safe(project.name)}</a></h2><div class="progress-meta"><span data-progress-label>${completed} із ${totalTasks} завдань виконано</span><strong data-progress-value>${progress}%</strong></div><div class="progress-track" role="progressbar" aria-label="Прогрес навчання: ${safe(project.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span data-progress-fill style="width:${progress}%"></span></div><h3 class="my-project-subheading">Підготуй компоненти</h3><div class="my-project-checklist">${project.components
            .map((item, index) => {
              const product = products.find(
                (entry) => entry.id === item.productId,
              );
              return `<label><input type="checkbox" data-project-check="${index}" ${checklist[index] ? "checked" : ""}><span class="my-project-check-photo">${product?.images?.[0] ? `<img src="${safe(resolveProductImage(product.images[0]))}" alt="" loading="lazy" decoding="async">` : ""}</span><span class="my-project-check-name">${safe(product?.name || item.productId)}${item.quantity > 1 ? ` · ${item.quantity} шт.` : ""}</span><span class="my-project-checkmark" aria-hidden="true">✓</span></label>`;
            })
            .join(
              "",
            )}</div>${steps.length ? `<section class="my-project-learning" aria-label="Навчальні завдання"><h3 class="my-project-subheading">Пройди кроки проєкту</h3><ol>${steps.map((step, index) => `<li><label><input type="checkbox" data-step-check="${index}" ${stepChecklist[index] ? "checked" : ""}><span>${safe(step)}</span></label></li>`).join("")}</ol></section>` : ""}<p class="project-course-complete" data-course-complete ${progress === 100 ? "" : "hidden"} role="status">Проєкт завершено — чудова робота!</p><div class="my-project-footer"><span>Набір ≈ ${money(project.estimatedPrice)}</span><button type="button" class="my-project-remove" data-project-remove>Прибрати з майстерні</button></div></div></article>`;
        })
        .join("")}</div>`;
    } catch (error) {
      root.innerHTML = `<div class="project-empty" role="alert"><h2>Не вдалося завантажити майстерню</h2><p>${error.status === 401 || error.message === "UNAUTHENTICATED" ? "Увійди до облікового запису, щоб переглянути збережені проєкти." : isFirebaseConfigured() ? "Перевір доступ до Firebase та спробуй ще раз." : "Перевір підключення до сервера та спробуй ще раз."}</p><button class="button button-quiet" type="button" data-project-retry>Спробувати ще раз</button></div>`;
    }
  }
  root.addEventListener("change", async (event) => {
    const checkbox = event.target.closest("[data-project-check], [data-step-check]");
    if (!checkbox) return;
    const card = checkbox.closest("[data-saved-project]"),
      checks = [...card.querySelectorAll("[data-project-check]")],
      stepChecks = [...card.querySelectorAll("[data-step-check]")];
    const completed = [...checks, ...stepChecks].filter((input) => input.checked).length,
      totalTasks = checks.length + stepChecks.length,
      progress = totalTasks ? Math.round((completed / totalTasks) * 100) : 0;
    card.querySelector("[data-progress-label]").textContent =
      `${completed} із ${totalTasks} завдань виконано`;
    card.querySelector("[data-progress-value]").textContent = progress + "%";
    card
      .querySelector(".progress-track")
      .setAttribute("aria-valuenow", String(progress));
    card.querySelector("[data-progress-fill]").style.width = progress + "%";
    card.querySelector("[data-course-complete]").hidden = progress !== 100;
    [...checks, ...stepChecks].forEach((input) => (input.disabled = true));
    try {
      await updateMyProject(
        card.dataset.savedProject,
        checks.map((input) => input.checked),
        stepChecks.map((input) => input.checked),
      );
    } catch {
      checkbox.checked = !checkbox.checked;
      const restored = [...checks, ...stepChecks].filter((input) => input.checked).length,
        value = totalTasks ? Math.round((restored / totalTasks) * 100) : 0;
      card.querySelector("[data-progress-label]").textContent =
        `${restored} із ${totalTasks} завдань виконано`;
      card.querySelector("[data-progress-value]").textContent = value + "%";
      card
        .querySelector(".progress-track")
        .setAttribute("aria-valuenow", String(value));
      card.querySelector("[data-progress-fill]").style.width = value + "%";
      card.querySelector("[data-course-complete]").hidden = value !== 100;
      toast(
        "Не вдалося зберегти прогрес. Перевір з’єднання та спробуй ще раз.",
      );
    } finally {
      [...checks, ...stepChecks].forEach((input) => (input.disabled = false));
    }
  });
  root.addEventListener("click", async (event) => {
    if (event.target.closest("[data-project-retry]")) {
      await draw();
      return;
    }
    const button = event.target.closest("[data-project-remove]");
    if (!button) return;
    const card = button.closest("[data-saved-project]");
    button.disabled = true;
    try {
      await deleteMyProject(card.dataset.savedProject);
      toast("Проєкт прибрано з майстерні.");
      await draw();
    } catch {
      button.disabled = false;
      toast("Не вдалося прибрати проєкт. Спробуй ще раз.");
    }
  });
  await draw();
}
