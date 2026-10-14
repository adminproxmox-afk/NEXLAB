import { getProjects, getProjectById } from "./projectService.js";
import { getProductById, getProducts } from "./productService.js";
import { productArt } from "./products.js";
import { addToCart } from "./cart.js";
import { toast } from "./notifications.js";
import { getCurrentUser } from "./session.js";
import { getMyProjects, saveMyProject } from "../api/userProjectsService.js";
import { showAuthDialog } from "./authGate.js";
import { renderProjectGuide, projectGuides } from "./project-guides.js";
import {
  money,
  componentLabel,
  projectCard,
  projectCover,
  projectDuration,
  projectInventory,
  safe,
} from "./project-ui.js";

export async function renderHomeProjects() {
  const root = document.querySelector("[data-projects]");
  if (!root) return;
  const [projects, products] = await Promise.all([
    getProjects(),
    getProducts(),
  ]);
  root.innerHTML = projects
    .slice(0, 3)
    .map((project) => projectCard(project, products))
    .join("");
}

export async function initializeProjectsDirectory() {
  const root = document.querySelector("[data-projects-directory]");
  if (!root) return;
  const [projects, products] = await Promise.all([
    getProjects(),
    getProducts(),
  ]);
  const grid = root.querySelector("[data-project-grid]");
  const search = root.querySelector("[data-project-search]");
  const count = root.querySelector("[data-project-count]");
  const filters = [...root.querySelectorAll("[data-project-filter]")];
  let difficulty = "all";
  function render() {
    const query = search.value.trim().toLocaleLowerCase("uk-UA");
    const visible = projects.filter((project) => {
      const matchesDifficulty =
        difficulty === "all" || project.difficulty === difficulty;
      const components = project.components
        .map(
          ({ productId }) =>
            products.find((product) => product.id === productId)?.name || "",
        )
        .join(" ");
      const matchesQuery =
        !query ||
        `${project.name} ${project.description} ${components}`
          .toLocaleLowerCase("uk-UA")
          .includes(query);
      return matchesDifficulty && matchesQuery;
    });
    const noun = {
      one: "проєкт",
      few: "проєкти",
      many: "проєктів",
      other: "проєкту",
    }[new Intl.PluralRules("uk-UA").select(visible.length)];
    count.textContent = `${visible.length} ${noun}`;
    grid.innerHTML = visible.length
      ? visible.map((project) => projectCard(project, products)).join("")
      : '<div class="project-empty"><span aria-hidden="true">⌕</span><h2>Нічого не знайдено</h2><p>Зміни пошук або обери інший рівень складності.</p><button class="button button-quiet" type="button" data-project-reset>Скинути фільтри</button></div>';
  }
  search.addEventListener("input", render);
  filters.forEach((button) =>
    button.addEventListener("click", () => {
      difficulty = button.dataset.projectFilter;
      filters.forEach((filter) => {
        const active = filter === button;
        filter.classList.toggle("is-active", active);
        filter.setAttribute("aria-pressed", String(active));
      });
      render();
    }),
  );
  grid.addEventListener("click", (event) => {
    if (!event.target.closest("[data-project-reset]")) return;
    difficulty = "all";
    search.value = "";
    filters.forEach((filter, index) => {
      const active = index === 0;
      filter.classList.toggle("is-active", active);
      filter.setAttribute("aria-pressed", String(active));
    });
    render();
    search.focus();
  });
  render();
}

export async function initializeProjectPage() {
  const root = document.querySelector("[data-project-detail]");
  if (!root) return;
  const project = await getProjectById(
    new URLSearchParams(location.search).get("id"),
  );
  if (!project) {
    root.innerHTML =
      '<div class="empty-state"><span class="empty-mark">⌕</span><h1>Проєкт не знайдено</h1><p>Перевір посилання або обери іншу ідею з каталогу.</p><a class="button button-primary" href="projects.html">Переглянути проєкти <span>↗</span></a></div>';
    return;
  }
  document.title = `${project.name} — NEXLAB`;
  const products = await Promise.all(
    project.components.map((row) => getProductById(row.productId)),
  );
  const rows = project.components.map((component, index) => ({
    ...component,
    product: products[index],
  }));
  const inventory = projectInventory(project, products.filter(Boolean));
  const availableCount = rows.reduce(
    (sum, row) =>
      sum + (row.product ? Math.min(row.quantity, row.product.stock) : 0),
    0,
  );
  const savedProjects = getCurrentUser()
    ? await getMyProjects().catch(() => [])
    : [];
  const isSaved = savedProjects.some(
    (record) => record.projectId === project.id,
  );
  root.innerHTML = `<div class="breadcrumbs"><a href="index.html">Головна</a><span>/</span><a href="projects.html">Проєкти</a><span>/</span><span>${safe(project.name)}</span></div>
    <div class="project-detail-hero"><div class="project-detail-visual">${projectCover(project, products.filter(Boolean))}<a class="project-visual-link" href="#build-guide">${projectGuides[project.id] ? "Перейти до схеми" : "Перейти до кроків"} <span aria-hidden="true">↓</span></a></div><div class="project-detail-copy"><p class="eyebrow">Майстерня NEXLAB / ${safe(project.difficulty)} · ~${projectDuration(project)} год.</p><h1>${safe(project.name)}</h1><p class="project-lead">${safe(project.description)}</p><div class="project-facts"><div><strong>${rows.length}</strong><span>${componentLabel(rows.length)} у наборі</span></div><div><strong>${inventory.ready}/${rows.length}</strong><span>позицій доступно</span></div><div><strong>${inventory.complete ? "Так" : "Частково"}</strong><span>повний набір зараз</span></div></div><div class="project-cost"><div><span>Повний комплект</span><strong>≈ ${money(project.estimatedPrice)}</strong></div><div><span>Доступні позиції</span><strong>${money(inventory.availableValue)}</strong></div></div>${!inventory.complete ? '<p class="project-stock-note">Частини компонентів зараз немає в наявності. Можна додати доступні, а решту відкрити в каталозі.</p>' : ""}<div class="project-actions"><button class="button button-primary" data-project-add ${availableCount === 0 ? "disabled" : ""}>${inventory.complete ? "Додати комплект" : "Додати доступні компоненти"} <span aria-hidden="true">＋</span></button><button class="button button-quiet" data-save-project data-saved="${isSaved}" ${isSaved ? 'aria-label="Відкрити проєкт у моїй майстерні"' : ""}>${isSaved ? "У моїй майстерні ✓" : "Зберегти в майстерню ♡"}</button></div><p class="project-demo-note">Ціни та залишки демонстраційні. Перед складанням перевір сумісність компонентів.</p></div></div>
    <section class="project-components-list" id="components"><div class="section-heading"><div><p class="eyebrow">Склад набору</p><h2>Що знадобиться <span>${rows.length}</span></h2></div><a class="text-link" href="catalog.html">Увесь каталог <span>↗</span></a></div><div class="project-part-grid">${rows.map((row) => (row.product ? `<article class="project-part ${row.product.stock < row.quantity ? "is-unavailable" : ""}"><a class="project-part-image" href="product.html?id=${encodeURIComponent(row.product.id)}">${productArt(row.product)}</a><div class="project-part-copy"><span class="product-category">${safe(row.product.category)}</span><h3><a href="product.html?id=${encodeURIComponent(row.product.id)}">${safe(row.product.name)}</a></h3><div class="project-part-price"><span>${row.quantity} шт.</span><strong>${money(row.product.price * row.quantity)}</strong></div><span class="stock ${row.product.stock < row.quantity ? "stock-out" : ""}">${row.product.stock >= row.quantity ? `Є в наявності · ${row.product.stock} шт.` : row.product.stock ? `Потрібно ${row.quantity}, є ${row.product.stock} шт.` : "Тимчасово немає в наявності"}</span><a class="project-part-link" href="product.html?id=${encodeURIComponent(row.product.id)}">Деталі товару ↗</a></div></article>` : `<article class="project-part is-unavailable"><div class="project-part-copy"><h3>Компонент недоступний</h3><p>Товар більше не представлений у каталозі.</p></div></article>`)).join("")}</div></section>`;
  try {
    await renderProjectGuide(project, root);
    const section = root.querySelector(".project-guide");
    if (section) section.id = "build-guide";
  } catch {
    root.insertAdjacentHTML(
      "beforeend",
      '<section class="project-guide" id="build-guide"><p class="service-error" role="status">Інструкція тимчасово недоступна. Перевір адресу сторінки або спробуй пізніше.</p></section>',
    );
  }
  root.addEventListener("click", async (event) => {
    const saveButton = event.target.closest("[data-save-project]");
    if (saveButton) {
      if (saveButton.dataset.saved === "true") {
        location.href = "my-projects.html";
        return;
      }
      if (!getCurrentUser()) {
        showAuthDialog();
        return;
      }
      saveButton.disabled = true;
      try {
        await saveMyProject(project.id);
        saveButton.dataset.saved = "true";
        saveButton.textContent = "У моїй майстерні ✓";
        toast("Проєкт збережено в твоїй майстерні.");
      } catch {
        toast("Не вдалося зберегти проєкт. Спробуй ще раз.");
      } finally {
        saveButton.disabled = false;
      }
      return;
    }
    if (!event.target.closest("[data-project-add]")) return;
    let added = 0;
    rows.forEach((row) => {
      if (row.product && row.product.stock > 0)
        added += addToCart(
          row.product,
          Math.min(row.quantity, row.product.stock),
        );
    });
    toast(
      added
        ? `До кошика додано ${added} компонентів проєкту.`
        : "Зараз немає доступних компонентів для додавання.",
    );
  });
}
