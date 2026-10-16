import { getReviews, createReview } from "../api/reviewService.js";
import { getCurrentUser } from "./session.js";
import { showAuthDialog } from "./authGate.js";
import { toast } from "./notifications.js";
import { refreshProducts } from "../api/productService.js";
import { ratingMarkup } from "./rating.js";
import { hasBackend } from "../api/client.js";
import { formatDate } from "./i18n.js";

const safe = (value) =>
  String(value || "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const date = (value) =>
  formatDate(value, {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

function reviewMarkup(review) {
  return `<article class="review-card"><div class="review-head"><div><strong>${safe(review.userName)}</strong><time>${date(review.date)}</time></div><span class="review-stars" aria-label="Оцінка ${review.rating} з 5">${"★".repeat(review.rating)}${"☆".repeat(5 - review.rating)}</span></div><p>${safe(review.text)}</p>${review.imageUrl ? `<a class="review-photo-link" href="${safe(review.imageUrl)}" target="_blank" rel="noopener noreferrer"><img class="review-photo" src="${safe(review.imageUrl)}" alt="Фото у відгуку користувача ${safe(review.userName)}" loading="lazy" referrerpolicy="no-referrer"></a>` : ""}</article>`;
}

export async function initializeReviews(product) {
  const root = document.querySelector("[data-reviews]");
  if (!root) return;
  async function render() {
    let reviews = [];
    try {
      reviews = await getReviews(product.id);
    } catch (error) {
      if (error.message !== "BACKEND_UNAVAILABLE") throw error;
    }
    root.innerHTML = `<div class="section-heading"><div><p class="eyebrow">Досвід спільноти</p><h2>Відгуки <span data-review-count>${reviews.length}</span></h2></div></div>
      <div class="reviews-layout"><div class="review-list">${reviews.length ? reviews.map(reviewMarkup).join("") : `<div class="empty-inline">${hasBackend() ? "Відгуків поки немає. Поділися враженнями першим." : "Відгуки з’являться після підключення сервера магазину."}</div>`}</div>
      ${hasBackend() ? `<form class="review-form" data-review-form novalidate><h3>Залишити відгук</h3><fieldset><legend>Твоя оцінка</legend><div class="rating-input">${[5, 4, 3, 2, 1].map((rating) => `<label><input type="radio" name="rating" value="${rating}"><span aria-label="${rating} з 5">★</span></label>`).join("")}</div><small class="field-error" data-review-error="rating"></small></fieldset><label>Коментар<textarea name="text" rows="4" maxlength="1000" placeholder="Що варто знати іншим?" required></textarea><small class="field-error" data-review-error="text"></small></label><label>Фото (необов’язково)<input name="imageUrl" type="url" maxlength="2000" pattern="https://.+" placeholder="https://…"><small>Додай пряме HTTPS-посилання на зображення.</small><small class="field-error" data-review-error="imageUrl"></small></label><button class="button button-primary" type="submit">Опублікувати</button></form>` : ""}</div>`;
    root
      .querySelector("[data-review-form]")
      ?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!getCurrentUser()) {
          showAuthDialog();
          return;
        }
        const form = event.currentTarget,
          rating = Number(form.elements.rating.value),
          text = form.elements.text.value.trim(),
          imageUrl = form.elements.imageUrl.value.trim();
        form.querySelector('[data-review-error="rating"]').textContent = rating
          ? ""
          : "Обери оцінку.";
        form.querySelector('[data-review-error="text"]').textContent = text
          ? ""
          : "Напиши кілька слів про товар.";
        if (!rating || !text) return;
        if (imageUrl && (!/^https:\/\//i.test(imageUrl) || !form.elements.imageUrl.validity.valid)) {
          form.querySelector('[data-review-error="imageUrl"]').textContent = "Вкажи коректне HTTPS-посилання або залиш поле порожнім.";
          return;
        }
        const button = form.querySelector('button[type="submit"]');
        if (button.disabled) return;
        button.disabled = true;
        try {
          await createReview({ productId: product.id, rating, text, imageUrl });
          await refreshProducts();
          document.querySelector("[data-product-rating]").innerHTML =
            ratingMarkup(product);
          toast("Відгук опубліковано.");
          await render();
        } catch {
          form.querySelector('[data-review-error="text"]').textContent =
            "Не вдалося зберегти відгук.";
          button.disabled = false;
        }
      });
  }
  await render();
}
