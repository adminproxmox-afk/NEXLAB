import { getProducts, getCategories, getProductById } from './productService.js';
import { productCard } from './product-card.js';
import { initializeCatalog } from './catalog.js';
import { initializeProductPage } from './product-page.js';
import { renderHomeProjects, initializeProjectPage } from './projects-page.js';
import { addToCart, renderCartPage, bindCartPage } from './cart.js';
import { toggleFavorite } from './favorites.js';
import { renderSharedLayout, bindLayoutEvents, toast, updateHeaderCounts } from './ui.js';
import { initializeUsers } from './users.js';
import { initializeAuthForms } from './auth.js';
import { protectCurrentPage } from './routeProtection.js';
import { initializeProfile } from './profile.js';
import { initializeOrdersPage } from './orders.js';
import { initializeMyProjects } from './projects.js';
import { getCurrentUser } from './session.js';

const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function renderHomeCategories(categories) {
  const root = document.querySelector('[data-categories]');
  if (root) root.innerHTML = categories.map(category => `<a class="category-card" href="catalog.html?category=${encodeURIComponent(category.name)}"><span class="category-arrow">↗</span><span class="category-icon" aria-hidden="true">${category.icon}</span><strong>${escapeHTML(category.name)}</strong><small>${escapeHTML(category.desc)}</small></a>`).join('');
}

function bindProductButtons() {
  document.addEventListener('click', async event => {
    const addButton = event.target.closest('[data-add]');
    if (addButton) {
      const product = await getProductById(addButton.dataset.add);
      if (product && addToCart(product)) toast(`${product.name} додано до кошика`);
    }
    const favoriteButton = event.target.closest('[data-favorite]');
    if (favoriteButton) {
      const saved = toggleFavorite(favoriteButton.dataset.favorite);
      document.querySelectorAll('[data-favorite]').forEach(button => {
        if (button.dataset.favorite !== favoriteButton.dataset.favorite) return;
        button.classList.toggle('is-favorite',saved); button.setAttribute('aria-pressed',String(saved)); button.textContent=saved?'♥':'♡';
      });
      toast(saved ? 'Додано до обраного' : 'Прибрано з обраного');
    }
  });
}

async function start() {
  await initializeUsers();
  renderSharedLayout();
  bindLayoutEvents();
  initializeAuthForms();
  if (!protectCurrentPage()) return;
  bindProductButtons();
  bindCartPage();
  if (location.pathname.toLowerCase().includes('/admin/')) {
    const welcome=document.querySelector('[data-admin-welcome]');
    if(welcome) welcome.textContent=`Вітаємо, ${getCurrentUser()?.name || 'Адміністратор'}`;
  }
  const [products,categories] = await Promise.all([getProducts(),getCategories()]);
  renderHomeCategories(categories);
  const featured = document.querySelector('[data-products="featured"]');
  if (featured) featured.innerHTML = products.filter(product => product.featured).slice(0,4).map(productCard).join('');
  await Promise.all([initializeCatalog(),initializeProductPage(),initializeProjectPage(),renderHomeProjects(),initializeProfile(),initializeOrdersPage(),initializeMyProjects()]);
  renderCartPage();
  window.addEventListener('nexlab:cart-updated',renderCartPage);
  window.addEventListener('nexlab:favorites-updated',updateHeaderCounts);
  window.addEventListener('storage',event => {
    updateHeaderCounts(); renderCartPage();
    if (event.key === 'nexlab_guest_favorites' || event.key?.startsWith('nexlab_favorites_')) window.dispatchEvent(new Event('nexlab:favorites-updated'));
  });
}

start();
