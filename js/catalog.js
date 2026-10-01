import { getProducts, getCategories } from './productService.js';
import { searchProducts } from './search.js';
import { productCard } from './product-card.js';
import { getFavorites } from './favorites.js';

const safe = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initializeCatalog() {
  if (!document.querySelector('[data-catalog-page]')) return;
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  const params = new URLSearchParams(location.search);
  const controls = document.querySelector('[data-catalog-controls]');
  const title = document.querySelector('[data-catalog-title]');
  const breadcrumb = document.querySelector('[data-catalog-breadcrumbs]');
  const isFavorites = params.get('favorites') === '1' || document.body.hasAttribute('data-favorites-page');
  const isSale = params.get('tag') === 'sale';
  if (isFavorites) title.textContent = 'Обране';
  if (isSale) title.textContent = 'Акції';
  if (isFavorites) breadcrumb.innerHTML = '<a href="index.html">Головна</a><span>/</span><span>Обране</span>';
  else if (isSale) breadcrumb.innerHTML = '<a href="index.html">Головна</a><span>/</span><span>Акції</span>';
  else if (params.get('category')) breadcrumb.innerHTML = `<a href="index.html">Головна</a><span>/</span><a href="catalog.html">Каталог</a><span>/</span><span>${safe(params.get('category'))}</span>`;
  const categoriesOptions = categories.map(item => `<option value="${safe(item.name)}" ${params.get('category') === item.name ? 'selected' : ''}>${safe(item.name)}</option>`).join('');
  const brands = [...new Set(products.map(product => product.brand))].sort();
  controls.innerHTML = `<button class="filter-mobile-toggle" type="button" data-filter-toggle aria-expanded="false">☷ Фільтри <span data-filter-active-count></span></button>
    <div class="catalog-filters" data-filter-panel><div class="filter-head"><strong>Фільтри</strong><button type="button" data-clear-filters>Скинути</button></div>
    <label>Категорія<select data-filter-category><option value="">Усі категорії</option>${categoriesOptions}</select></label>
    <div class="filter-price"><label>Ціна від<input type="number" min="0" placeholder="0" data-price-min></label><label>До, ₴<input type="number" min="0" placeholder="∞" data-price-max></label></div>
    <label>Виробник<select data-filter-brand><option value="">Усі бренди</option>${brands.map(brand => `<option value="${safe(brand)}">${safe(brand)}</option>`).join('')}</select></label>
    <label>Рейтинг<select data-filter-rating><option value="0">Будь-який</option><option value="4">Від 4,0</option><option value="4.5">Від 4,5</option><option value="4.8">Від 4,8</option></select></label>
    <label class="check-filter"><input type="checkbox" data-filter-stock> Лише в наявності</label></div>
    <div class="catalog-results"><div class="catalog-toolbar"><label class="search-field"><span>⌕</span><input type="search" placeholder="Знайти компонент…" data-catalog-search aria-label="Пошук у каталозі"></label>
    <label class="sort-select"><span>Сортування</span><select data-sort><option value="popular">За популярністю</option><option value="price-asc">Спочатку дешевші</option><option value="price-desc">Спочатку дорожчі</option><option value="rating">За рейтингом</option><option value="new">Спочатку новинки</option></select></label></div>
    <div class="catalog-quick-filters" aria-label="Швидкий вибір категорії" data-quick-categories><button type="button" data-quick-category="" class="is-active">Усе</button>${categories.slice(0,5).map(category=>`<button type="button" data-quick-category="${safe(category.name)}">${safe(category.name)}</button>`).join('')}</div>
    <p class="result-count" data-result-count></p><div class="product-grid catalog-grid" data-catalog-grid></div><button class="button button-quiet load-more" data-load-more type="button">Показати ще</button></div>`;
  const search = controls.querySelector('[data-catalog-search]');
  const grid = controls.querySelector('[data-catalog-grid]');
  const count = controls.querySelector('[data-result-count]');
  const more = controls.querySelector('[data-load-more]');
  const filterPanel = controls.querySelector('[data-filter-panel]');
  const filterToggle = controls.querySelector('[data-filter-toggle]');
  const filterInputs = [...controls.querySelectorAll('select,input')].filter(input => input !== search && input.dataset.sort === undefined);
  let limit = 8;
  search.value = params.get('q') || '';
  controls.querySelector('[data-filter-toggle]').addEventListener('click', () => {
    const open = filterPanel.classList.toggle('is-open'); filterToggle.setAttribute('aria-expanded', String(open));
  });

  function update() {
    const minimum = Number(controls.querySelector('[data-price-min]').value || 0);
    const maxValue = controls.querySelector('[data-price-max]').value;
    const maximum = maxValue ? Number(maxValue) : Infinity;
    const category = controls.querySelector('[data-filter-category]').value;
    const brand = controls.querySelector('[data-filter-brand]').value;
    const rating = Number(controls.querySelector('[data-filter-rating]').value);
    const inStock = controls.querySelector('[data-filter-stock]').checked;
    let found = searchProducts(products, search.value).filter(product =>
      (!category || product.category === category) && product.price >= minimum && product.price <= maximum &&
      (!brand || product.brand === brand) && product.rating >= rating && (!inStock || product.stock > 0) &&
      (!isFavorites || getFavorites().includes(product.id)) && (!isSale || product.discount > 0));
    const sort = controls.querySelector('[data-sort]').value;
    if (sort === 'price-asc') found.sort((a,b) => a.price - b.price);
    if (sort === 'price-desc') found.sort((a,b) => b.price - a.price);
    if (sort === 'rating') found.sort((a,b) => b.rating - a.rating);
    if (sort === 'new') found.sort((a,b) => Number(b.isNew) - Number(a.isNew));
    if (sort === 'popular') found.sort((a,b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.reviewsCount - a.reviewsCount);
    const active = [category,minimum > 0,maximum < Infinity,brand,rating > 0,inStock].filter(Boolean).length;
    controls.querySelector('[data-filter-active-count]').textContent = active ? `(${active})` : '';
    count.textContent = found.length ? `Показано ${Math.min(limit,found.length)} з ${found.length} товарів` : 'Товарів не знайдено';
    controls.querySelectorAll('[data-quick-category]').forEach(button => button.classList.toggle('is-active', button.dataset.quickCategory === category));
    grid.innerHTML = found.length ? found.slice(0,limit).map(productCard).join('') : `<div class="no-results"><strong>${isFavorites ? 'В обраному поки порожньо' : 'За цим запитом нічого не знайдено'}</strong><p>Зміни пошуковий запит або скинь фільтри, щоб переглянути інші товари.</p><button class="button button-quiet" type="button" data-clear-filters>Показати всі товари</button></div>`;
    more.hidden = found.length <= limit;
  }

  search.addEventListener('input', () => { limit = 8; update(); });
  filterInputs.forEach(input => input.addEventListener('input', () => { limit = 8; update(); }));
  controls.querySelector('[data-sort]').addEventListener('change', update);
  controls.addEventListener('click', event => {
    const quickCategory = event.target.closest('[data-quick-category]');
    if (quickCategory) {
      controls.querySelector('[data-filter-category]').value = quickCategory.dataset.quickCategory;
      limit = 8; update(); return;
    }
    if (event.target.closest('[data-clear-filters]')) {
      controls.querySelector('[data-filter-category]').value = '';
      controls.querySelector('[data-price-min]').value = '';
      controls.querySelector('[data-price-max]').value = '';
      controls.querySelector('[data-filter-brand]').value = '';
      controls.querySelector('[data-filter-rating]').value = '0';
      controls.querySelector('[data-filter-stock]').checked = false;
      search.value = '';
      if (isFavorites || isSale) location.href = 'catalog.html'; else update();
    }
  });
  more.addEventListener('click', () => { limit += 8; update(); });
  window.addEventListener('nexlab:favorites-updated', update);
  update();
}
