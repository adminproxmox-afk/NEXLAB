import {
  getCommunityProjects,
  getCommunityProjectById,
  submitCommunityProject,
  submitCommunityProjectComment,
  submitCommunityProjectQuestion,
  answerCommunityProjectQuestion,
} from "../api/communityProjectService.js";
import { getCurrentUser, hasAdminPermission } from "./session.js";
import { showAuthDialog } from "./authGate.js";
import { toast } from "./notifications.js";
import { formatDate } from "./i18n.js";
import { prepareCommunityImage } from "../api/imageUpload.js";

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
  const isDetailPage = root.hasAttribute("data-community-project-detail");
  const detailId = isDetailPage
    ? new URLSearchParams(location.search).get("id") || ""
    : null;
  let loading = false;
  async function render({ append = false } = {}) {
    if (loading) return;
    loading = true;
    grid.setAttribute("aria-busy", "true");
    try {
      const result = isDetailPage
        ? { projects: [await getCommunityProjectById(detailId)], hasMore: false }
        : await getCommunityProjects({ append });
      const projects = result.projects;
      if (isDetailPage && projects[0]) {
        document.title = `${projects[0].title} — Проєкти спільноти — NEXLAB`;
        const description = document.querySelector('meta[name="description"]');
        if (description) description.content = projects[0].description;
      }
      const cards = projects.map((project) => {
        const currentUser = getCurrentUser();
        const canAnswer = currentUser?.id === project.userId || hasAdminPermission("support");
        const hasRated = currentUser && (project.hasRated || project.comments.some((comment) => comment.userId === currentUser.id));
        return `
        <article class="community-project-card" data-community-card="${safe(project.id)}">
          <a class="community-project-photo" href="${safe(project.photoUrl)}" target="_blank" rel="noopener noreferrer"><img src="${safe(project.photoUrl)}" alt="Фото проєкту: ${safe(project.title)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"></a>
          <div class="community-project-copy"><div class="community-project-meta"><span>${safe(project.userName)}</span><time datetime="${safe(project.date)}">${date(project.date)}</time></div>
            <h2>${isDetailPage ? safe(project.title) : `<a href="community-project.html?id=${encodeURIComponent(project.id)}">${safe(project.title)}</a>`}</h2><p>${safe(project.description)}</p>
            <div class="community-project-links">${project.schematicUrl ? `<a href="${safe(project.schematicUrl)}" target="_blank" rel="noopener noreferrer">Відкрити схему ↗</a>` : ""}<a href="${safe(project.codeUrl)}" target="_blank" rel="noopener noreferrer">Переглянути код ↗</a></div>
            <section class="community-comments" aria-label="Оцінки та коментарі"><h3>Відгуки <span>${project.commentCountApproximate ? `≈${project.commentCount}${project.commentCount >= 30 ? "+" : ""}` : project.commentCount ?? project.comments.length}</span>${project.rating ? `<small> · ${project.ratingApproximate ? "≈ " : ""}★ ${project.rating.toFixed(1)} / 5</small>` : ""}</h3>
              ${project.comments.length ? `<ul>${project.comments.map((comment) => `<li><div><strong>${safe(comment.userName)}</strong><span aria-label="Оцінка ${comment.rating} з 5">${"★".repeat(comment.rating)}${"☆".repeat(5 - comment.rating)}</span></div><p>${safe(comment.text)}</p><time datetime="${safe(comment.date)}">${date(comment.date)}</time></li>`).join("")}</ul>` : '<p class="community-no-comments">Ще немає оцінок. Стань першим, хто поділиться враженням.</p>'}
              ${hasRated ? '<p class="community-no-comments" role="status">Ти вже оцінив цей проєкт.</p>' : `<form class="community-comment-form" data-community-comment-form="${safe(project.id)}"><label>Твоя оцінка<select name="rating" required><option value="5">★★★★★ · 5</option><option value="4">★★★★☆ · 4</option><option value="3">★★★☆☆ · 3</option><option value="2">★★☆☆☆ · 2</option><option value="1">★☆☆☆☆ · 1</option></select></label><label>Коментар<textarea name="text" rows="2" maxlength="1000" required placeholder="Що сподобалось або що варто врахувати?"></textarea></label><button class="button button-quiet" type="submit">Залишити відгук</button><p role="status" data-comment-status></p></form>`}
            </section>
            <section class="community-questions" aria-label="Питання та відповіді"><h3>Питання та відповіді <span>${project.questionCountApproximate ? `≈${project.questionCount}${project.questionCount >= 30 ? "+" : ""}` : project.questionCount ?? (project.questions || []).length}</span></h3>
              ${(project.questions || []).length ? `<ul>${project.questions.map((question) => `<li><div><strong>${safe(question.userName)}</strong><time datetime="${safe(question.date)}">${date(question.date)}</time></div><p class="community-question-text">${safe(question.text)}</p>${question.answer ? `<div class="community-answer"><strong>Відповідь · ${safe(question.answeredBy || project.userName)}</strong><p>${safe(question.answer)}</p>${question.answeredAt ? `<time datetime="${safe(question.answeredAt)}">${date(question.answeredAt)}</time>` : ""}</div>` : `<p class="community-no-answer">Очікує відповіді автора збірки.</p>`}${canAnswer ? `<form class="community-answer-form" data-community-answer-form="${safe(project.id)}" data-question-id="${safe(question.id)}"><label>${question.answer ? "Змінити відповідь" : "Твоя відповідь"}<textarea name="answer" rows="2" maxlength="1000" required>${safe(question.answer || "")}</textarea></label><button class="button button-quiet" type="submit">${question.answer ? "Оновити відповідь" : "Відповісти"}</button><p role="status" data-question-status></p></form>` : ""}</li>`).join("")}</ul>` : '<p class="community-no-comments">Питань поки немає.</p>'}
              <form class="community-question-form" data-community-question-form="${safe(project.id)}"><label>Поставити запитання<textarea name="text" rows="2" maxlength="1000" required placeholder="Запитай про схему, вибір деталей або налаштування"></textarea></label><button class="button button-quiet" type="submit">Надіслати запитання</button><p role="status" data-question-status></p></form>
            </section>
          </div>
        </article>`;
      }).join("");
      if (append) {
        grid.querySelectorAll("[data-community-load-error]").forEach((error) => error.remove());
        grid.querySelector("[data-community-more]")?.remove();
        if (cards) grid.insertAdjacentHTML("beforeend", cards);
      } else {
        grid.innerHTML = cards || '<div class="project-empty"><span aria-hidden="true">◈</span><h2>Тут починається спільнота</h2><p>Поділися першою збіркою, додай фото й код, щоб інші могли її повторити.</p></div>';
      }
      if (result.hasMore) grid.insertAdjacentHTML("beforeend", '<button class="button button-quiet" type="button" data-community-more>Завантажити ще проєкти</button>');
    } catch (error) {
      const missingProject = isDetailPage && error.status === 404;
      const failure = `<div class="project-empty" role="alert" data-community-load-error><h2>${missingProject ? "Проєкт не знайдено" : "Не вдалося завантажити проєкти"}</h2><p>${missingProject ? "Збірку видалено або посилання застаріло." : error.status === 401 || error.message === "UNAUTHENTICATED" ? "Увійди до акаунта й повтори спробу." : "Перевір з’єднання та спробуй ще раз."}</p>${missingProject ? '<a class="button button-quiet" href="community.html">До спільноти</a>' : `<button class="button button-quiet" type="button" data-community-retry${append ? ' data-community-retry-append' : ""}>Спробувати ще раз</button>`}</div>`;
      if (append) grid.insertAdjacentHTML("beforeend", failure);
      else grid.innerHTML = failure;
    } finally {
      loading = false;
      grid.removeAttribute("aria-busy");
    }
  }
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!getCurrentUser()) { showAuthDialog(); return; }
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector("[data-community-form-status]");
    button.disabled = true;
    status.textContent = "Публікуємо…";
    try {
      const photoFile = form.elements.photoFile.files[0];
      const photoUrl = form.elements.photoUrl.value.trim();
      if (photoFile && photoUrl) throw new Error("CHOOSE_ONE_PROJECT_IMAGE");
      if (!photoFile && !photoUrl) throw new Error("PROJECT_IMAGE_REQUIRED");
      const project = Object.fromEntries(new FormData(form));
      project.photoUrl = photoFile ? await prepareCommunityImage(photoFile) : photoUrl;
      delete project.photoFile;
      await submitCommunityProject(project);
      form.reset();
      form.closest("details").open = false;
      status.textContent = "Збірку опубліковано.";
      toast("Твій проєкт з’явився у спільноті.");
      await render();
    } catch (error) {
      status.textContent = error.status === 401 || error.message === "UNAUTHENTICATED"
        ? "Увійди в акаунт, щоб опублікувати збірку."
        : error.message === "CHOOSE_ONE_PROJECT_IMAGE"
          ? "Обери файл фото або вкажи посилання, не обидва варіанти."
          : error.message === "PROJECT_IMAGE_REQUIRED"
            ? "Додай фото файлом або HTTPS-посиланням."
            : error.message === "IMAGE_TOO_LARGE"
              ? "Фото завелике. Обери файл до 12 МБ; перед збереженням його буде стиснуто."
              : error.message === "INVALID_IMAGE_TYPE" || error.message === "INVALID_IMAGE_FILE"
                ? "Підтримуються справжні фото JPG, PNG або WebP."
                : error.message === "IMAGE_CONVERSION_FAILED"
                  ? "Цей браузер не зміг підготувати фото. Спробуй інший файл або HTTPS-посилання."
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
        : error.status === 409 || error.message === "COMMENT_ALREADY_EXISTS"
          ? "Ти вже оцінив цей проєкт."
          : "Не вдалося зберегти. Перевір з’єднання й спробуй ще раз.";
      button.disabled = false;
    }
  });
  root.addEventListener("click", (event) => {
    if (event.target.closest("[data-community-more]")) render({ append: true });
    else if (event.target.closest("[data-community-retry-append]")) render({ append: true });
    else if (event.target.closest("[data-community-retry]")) render();
  });
  await render();
}
