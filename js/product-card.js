import { productArt } from './products.js';
import { getFavorites } from './favorites.js';
import { ratingMarkup } from './rating.js';

const money = value => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function productCard(product) {
  const favorite = getFavorites().includes(product.id);
  return `<article class="product-card">
    <a href="product.html?id=${encodeURIComponent(product.id)}" aria-label="Докладніше: ${escapeHTML(product.name)}">${productArt(product)}</a>
    <button class="favorite-button ${favorite ? 'is-favorite' : ''}" type="button" data-favorite="${product.id}" aria-label="${favorite ? 'Прибрати з обраного' : 'Додати до обраного'}" aria-pressed="${favorite}">${favorite ? '♥' : '♡'}</button>
    <div class="product-meta"><span class="product-category">${escapeHTML(product.category)} · ${escapeHTML(product.brand)}</span><a class="product-name" href="product.html?id=${encodeURIComponent(product.id)}">${escapeHTML(product.name)}</a>
    <div class="product-rating" aria-label="${product.reviewsCount ? `Оцінка ${product.rating} з 5` : `Ще немає відгуків`}">${ratingMarkup(product)}</div>
    <div class="product-bottom"><div><div class="product-price">${money(product.price)}${product.oldPrice ? `<del>${money(product.oldPrice)}</del>` : ''}</div><span class="stock ${product.stock === 0 ? 'stock-out' : ''}">${product.stock ? 'Є в наявності' : 'Немає в наявності'}</span></div><button class="add-button" type="button" data-add="${product.id}" aria-label="Додати ${escapeHTML(product.name)} до кошика" ${product.stock === 0 ? 'disabled' : ''}><span>До кошика</span><b aria-hidden="true">+</b></button></div></div>
  </article>`;
}
