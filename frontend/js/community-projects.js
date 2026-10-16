import {
  getCommunityProjects,
  submitCommunityProject,
  submitCommunityProjectComment,
  submitCommunityProjectQuestion,
  answerCommunityProjectQuestion,
} from "../api/communityProjectService.js";
import { getCurrentUser, hasAdminPermission } from "./session.js";
import { showAuthDialog } from "./authGate.js";
import { toast } from "./notifications.js";
import { formatDate } from "./i18n.js";

const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
);
const date = (value) => formatDate(value, {
  day: "2-digit", month: "long", year: "numeric",
});

export async function initializeCommunityProjects() {
  const root = document.querySelector("[data-community-projects]");
  if (!root) return;
  const grid = root.querySelector("[data-community-project-grid]");
  const form = root.querySelector("[data-community-project-form]");
  async function render() {
    grid.setAttribute("aria-busy", "true");
    try {
      const projects = await getCommunityProjects();
      grid.innerHTML = projects.length ? projects.map((project) => {
        const canAnswer = getCurrentUser()?.id === project.userId || hasAdminPermission("support");
        return `
        <article class="community-project-card" data-community-card="${safe(project.id)}">
          <a class="community-project-photo" href="${safe(project.photoUrl)}" target="_blank" rel="noopener noreferrer"><img src="${safe(project.photoUrl)}" alt="Фото проєкту: ${safe(project.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
          <div class="community-project-copy"><div class="community-project-meta"><span>${safe(project.userName)}</span><time datetime="${safe(project.date)}">${date(project.date)}</time></div>
            <h2>${safe(project.title)}</h2><p>${safe(project.description)}</p>
            <div class="community-project-links">${project.schematicUrl ? `<a href="${safe(project.schematicUrl)}" target="_blank" rel="noopener noreferrer">Відкрити схему ↗</a>` : ""}<a href="${safe(project.codeUrl)}" target="_blank" rel="noopener noreferrer">Переглянути код ↗</a></div>
            <section class="community-comments" aria-label="Оцінки та коментарі"><h3>Відгуки <span>${project.comments.length}</span>${project.rating ? `<small> · ★ ${project.rating.toFixed(1)} / 5</small>` : ""}</h3>
              ${project.comments.length ? `<ul>${project.comments.map((comment) => `<li><div><strong>${safe(comment.userName)}</strong><span aria-label="Оцінка ${comment.rating} з 5">${"★".repeat(comment.rating)}${"☆".repeat(5 - comment.rating)}</span></div><p>${safe(comment.text)}</p><time datetime="${safe(comment.date)}">${date(comment.date)}</time></li>`).join("")}</ul>` : '<p class="community-no-comments">Ще немає оцінок. Стань першим, хто поділиться враженням.</p>'}
              <form class="community-comment-form" data-community-comment-form="${safe(project.id)}"><label>Твоя оцінка<select name="rating" required><option value="5">★★★★★ · 5</option><option value="4">★★★★☆ · 4</option><option value="3">★★★☆☆ · 3</option><option value="2">★★☆☆☆ · 2</option><option value="1">★☆☆☆☆ · 1</option></select></label><label>Коментар<textarea name="text" rows="2" maxlength="1000" required placeholder="Що сподобалось або що варто врахувати?"></textarea></label><button class="button button-quiet" type="submit">Залишити відгук</button><p role="status" data-comment-status></p></form>
            </section>
            <section class="community-questions" aria-label="Питання та відповіді"><h3>Питання та відповіді <span>${(project.questions || []).length}</span></h3>
              ${(project.questions || []).length ? `<ul>${project.questions.map((question) => `<li><div><strong>${safe(question.userName)}</strong><time datetime="${safe(question.date)}">${date(question.date)}</time></div><p class="community-question-text">${safe(question.text)}</p>${question.answer ? `<div class="community-answer"><strong>Відповідь · ${safe(question.answeredBy || project.userName)}</strong><p>${safe(question.answer)}</p>${question.answeredAt ? `<time datetime="${safe(question.answeredAt)}">${date(question.answeredAt)}</time>` : ""}</div>` : `<p class="community-no-answer">Очікує відповіді автора збірки.</p>`}${canAnswer ? `<form class="community-answer-form" data-community-answer-form="${safe(project.id)}" data-question-id="${safe(question.id)}"><label>${question.answer ? "Змінити відповідь" : "Твоя відповідь"}<textarea name="answer" rows="2" maxlength="1000" required>${safe(question.answer || "")}</textarea></label><button class="button button-quiet" type="submit">${question.answer ? "Оновити відповідь" : "Відповісти"}</button><p role="status" data-question-status></p></form>` : ""}</li>`).join("")}</ul>` : '<p class="community-no-comments">Питань поки немає.</p>'}
              <form class="community-question-form" data-community-question-form="${safe(project.id)}"><label>Поставити запитання<textarea name="text" rows="2" maxlength="1000" required placeholder="Запитай про схему, вибір деталей або налаштування"></textarea></label><button class="button button-quiet" type="submit">Надіслати запитання</button><p role="status" data-question-status></p></form>
            </section>
          </div>
        </article>`;
      }).join("") : '<div class="project-empty"><span aria-hidden="true">◈</span><h2>Тут починається спільнота</h2><p>Поділися першою збіркою, додай фото й код, щоб інші могли її повторити.</p></div>';
    } catch (error) {
      grid.innerHTML = `<div class="project-empty" role="alert"><h2>Не вдалося завантажити проєкти</h2><p>${error.status === 401 || error.message === "UNAUTHENTICATED" ? "Увійди до акаунта й повтори спробу." : "Перевір з’єднання та спробуй ще раз."}</p><button class="button button-quiet" type="button" data-community-retry>Спробувати ще раз</button></div>`;
    } finally {
      grid.removeAttribute("aria-busy");
    }
  }
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getCurrentUser()) { showAuthDialog(); return; }
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-community-form-status]");
    button.disabled = true;
    status.textContent = "Публікуємо…";
    try {
      await submitCommunityProject(Object.fromEntries(new FormData(form)));
      form.reset();
      form.closest("details").open = false;
      status.textContent = "Збірку опубліковано.";
      toast("Твій проєкт з’явився у спільноті.");
      await render();
    } catch (error) {
      status.textContent = error.status === 401 || error.message === "UNAUTHENTICATED"
        ? "Увійди в акаунт, щоб опублікувати збірку."
        : "Не вдалося опублікувати. Перевір посилання, з’єднання й спробуй знову.";
    } finally { button.disabled = false; }
  });
  root.addEventListener("submit", async (event) => {
    const questionForm = event.target.closest("[data-community-question-form]");
    const answerForm = event.target.closest("[data-community-answer-form]");
    if (questionForm || answerForm) {
      event.preventDefault();
      if (!getCurrentUser()) { showAuthDialog(); return; }
      const form = questionForm || answerForm;
      const button = form.querySelector('[type="submit"]');
      const status = form.querySelector("[data-question-status]");
      button.disabled = true;
      status.textContent = "Зберігаємо…";
      try {
        if (questionForm) {
          await submitCommunityProjectQuestion({
            projectId: questionForm.dataset.communityQuestionForm,
            text: questionForm.elements.text.value,
          });
          toast("Запитання додано до проєкту.");
        } else {
          await answerCommunityProjectQuestion({
            projectId: answerForm.dataset.communityAnswerForm,
            questionId: answerForm.dataset.questionId,
            answer: answerForm.elements.answer.value,
          });
          toast("Відповідь опубліковано.");
        }
        await render();
      } catch (error) {
        status.textContent = error.status === 401 || error.message === "UNAUTHENTICATED"
          ? "Увійди в акаунт, щоб продовжити."
          : error.status === 403 || error.message === "FORBIDDEN"
            ? "Відповідати на запитання може автор проєкту або підтримка."
            : "Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.";
        button.disabled = false;
      }
      return;
    }
    const commentForm = event.target.closest("[data-community-comment-form]");
    if (!commentForm) return;
    event.preventDefault();
    if (!getCurrentUser()) { showAuthDialog(); return; }
    const button = commentForm.querySelector('[type="submit"]');
    const status = commentForm.querySelector("[data-comment-status]");
    button.disabled = true;
    status.textContent = "Зберігаємо…";
    try {
      await submitCommunityProjectComment({
        projectId: commentForm.dataset.communityCommentForm,
        rating: Number(commentForm.elements.rating.value),
        text: commentForm.elements.text.value,
      });
      await render();
      toast("Дякуємо за оцінку та коментар.");
    } catch (error) {
      status.textContent = error.status === 401 || error.message === "UNAUTHENTICATED"
        ? "Увійди в акаунт, щоб залишити відгук."
        : "Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.";
      button.disabled = false;
    }
  });
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-community-retry]")) render();
  });
  await render();
}
