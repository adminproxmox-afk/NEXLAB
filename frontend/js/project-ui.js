export const safe = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
import { formatMoney, currentLanguage } from "./i18n.js";

export const money = formatMoney;
export const componentLabel = (count) => {
  const language = currentLanguage();
  const locale = { uk: "uk-UA", ru: "ru-RU", en: "en-US" }[language];
  const form = new Intl.PluralRules(locale).select(count);
  const word = {
    uk: {
    one: "компонент",
    few: "компоненти",
    many: "компонентів",
    other: "компонента",
    },
    ru: { one: "компонент", few: "компонента", many: "компонентов", other: "компонента" },
    en: { one: "component", other: "components" },
  }[language][form] || {
    uk: { one: "компонент", few: "компоненти", many: "компонентів", other: "компонента" },
    ru: { one: "компонент", few: "компонента", many: "компонентов", other: "компонента" },
    en: { one: "component", other: "components" },
  }[language].other;
  return `${count} ${word}`;
};
export const projectDuration = (project) =>
  project.estimatedHours ||
  ({ Легкий: 1, Середній: 2, Просунутий: 3 }[project.difficulty] || 2);
export const projectDurationLabel = (project) => {
  const hours = projectDuration(project);
  return currentLanguage() === "ru" ? `~${hours} ч.` : currentLanguage() === "en" ? `~${hours} hr` : `~${hours} год.`;
};
const projectAvailabilityLabel = (ready, total) => {
  const language = currentLanguage();
  return language === "en"
    ? `${ready}/${total} parts in stock`
    : language === "ru"
      ? `${ready}/${total} поз. в наличии`
      : `${ready}/${total} позицій у наявності`;
};

export function projectInventory(project, products) {
  const items = project.components.map((component) => ({
    component,
    product: products.find((item) => item.id === component.productId),
  }));
  const ready = items.filter(
    ({ component, product }) => product && product.stock >= component.quantity,
  ).length;
  const availableValue = items.reduce(
    (sum, { component, product }) =>
      sum +
      (product
        ? product.price * Math.min(component.quantity, product.stock)
        : 0),
    0,
  );
  return {
    items,
    ready,
    total: items.length,
    availableValue,
    complete: ready === items.length,
  };
}

export function projectCover(project, products) {
  const items = project.components
    .slice(0, 3)
    .map(({ productId }) =>
      products.find((product) => product.id === productId),
    )
    .filter(Boolean);
  return `<div class="project-cover" aria-hidden="true">${items.map((product, index) => `<div class="project-cover-photo project-cover-photo-${index + 1}"><img src="${safe(product.images?.[0] || "")}" alt="" loading="lazy" decoding="async"></div>`).join("")}<span class="project-cover-id">NXL / ${safe(project.id.toUpperCase())}</span><span class="project-cover-count">${componentLabel(project.components.length)}</span></div>`;
}

export function projectCard(project, products) {
  const { ready, total } = projectInventory(project, products);
  const url = "project.html?id=" + encodeURIComponent(project.id);
  return `<article class="project-card">${projectCover(project, products)}<div class="project-card-body"><div class="project-card-kicker"><span>${safe(project.difficulty)}</span><span>${projectAvailabilityLabel(ready, total)}</span></div><h3><a href="${url}">${safe(project.name)}</a></h3><p>${safe(project.description)}</p><div class="project-card-meta"><span>${componentLabel(total)} · ${projectDurationLabel(project)}</span><strong>≈ ${money(project.estimatedPrice)}</strong></div>${project.bundleDiscountPercent > 0 ? `<p class="project-bundle-discount">−${safe(project.bundleDiscountPercent)}% ${currentLanguage() === "en" ? "off the complete kit" : currentLanguage() === "ru" ? "скидка на полный комплект" : "при купівлі повного комплекту"}</p>` : ""}<a class="project-card-open" href="${url}">${currentLanguage() === "en" ? "View project" : currentLanguage() === "ru" ? "Открыть проект" : "Відкрити проєкт"} <span aria-hidden="true">↗</span></a></div></article>`;
}
