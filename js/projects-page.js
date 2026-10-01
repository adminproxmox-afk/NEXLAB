import { getProjects, getProjectById } from './projectService.js';
import { getProductById } from './productService.js';
import { productArt } from './products.js';
import { addToCart } from './cart.js';
import { toast } from './notifications.js';
import { getCurrentUser } from './session.js';
import { saveMyProject } from '../api/userProjectsService.js';
import { showAuthDialog } from './authGate.js';

const money = value => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const safe = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function renderHomeProjects() {
  const root = document.querySelector('[data-projects]');
  if (!root) return;
  const projects = await getProjects();
  root.innerHTML = projects.map((project,index) => `<article class="project-card"><span class="project-symbol" aria-hidden="true">${['⌁','◈','✳','⌘','◉','ϟ'][index]}</span><span class="project-components">${safe(project.parts)}</span><h3>${safe(project.name)}</h3><p>${safe(project.description)}</p><div class="project-bottom"><span>${project.count} компонентів · ≈ ${money(project.estimatedPrice)}</span><a href="project.html?id=${encodeURIComponent(project.id)}">Переглянути проєкт ↗</a></div></article>`).join('');
}

export async function initializeProjectPage() {
  const root = document.querySelector('[data-project-detail]');
  if (!root) return;
  const project = await getProjectById(new URLSearchParams(location.search).get('id'));
  if (!project) { root.innerHTML = '<div class="empty-state"><span class="empty-mark">⌕</span><h1>Проєкт не знайдено</h1><a class="button button-primary" href="index.html#projects">Переглянути проєкти <span>↗</span></a></div>'; return; }
  document.title = `${project.name} — NEXLAB`;
  const products = await Promise.all(project.components.map(row => getProductById(row.productId)));
  const rows = project.components.map((component,index) => ({...component,product:products[index]}));
  const availableTotal = rows.reduce((sum,row) => sum + (row.product?.stock ? row.product.price * Math.min(row.quantity,row.product.stock) : 0),0);
  root.innerHTML = `<div class="breadcrumbs"><a href="index.html">Головна</a><span>/</span><a href="index.html#projects">Проєкти</a><span>/</span><span>${safe(project.name)}</span></div>
    <div class="project-detail-hero"><div class="project-hero-art">${rows[0]?.product ? productArt(rows[0].product,true) : ''}<span class="project-stamp">NXL / ПОСІБНИК ЗІ СКЛАДАННЯ</span></div><div><p class="eyebrow">DIY-проєкт / ${safe(project.difficulty)}</p><h1>${safe(project.name)}</h1><p>${safe(project.description)}</p><div class="project-total"><span>Вартість набору</span><strong>≈ ${money(project.estimatedPrice)}</strong></div><span class="project-available">Зараз у наявності на ${money(availableTotal)}</span><div class="project-actions"><button class="button button-primary" data-project-add ${availableTotal === 0 ? 'disabled' : ''}>Додати доступні компоненти <span>＋</span></button><button class="button button-quiet" data-save-project>Зберегти в мої проєкти ♡</button></div></div></div>
    <section class="project-components-list"><div class="section-heading"><div><p class="eyebrow">Що знадобиться</p><h2>Компоненти <span>${rows.length}</span></h2></div></div><div class="project-part-grid">${rows.map(row => row.product ? `<article class="project-part ${row.product.stock === 0 ? 'is-unavailable' : ''}"><a href="product.html?id=${encodeURIComponent(row.product.id)}">${productArt(row.product)}</a><div><span class="product-category">${safe(row.product.category)}</span><h3><a href="product.html?id=${encodeURIComponent(row.product.id)}">${safe(row.product.name)}</a></h3><p>${row.quantity} шт. · ${money(row.product.price * row.quantity)}</p><span class="stock ${row.product.stock === 0 ? 'stock-out' : ''}">${row.product.stock > 0 ? `Є в наявності · ${row.product.stock} шт.` : 'Тимчасово немає в наявності'}</span></div></article>` : `<article class="project-part is-unavailable"><div><h3>Компонент недоступний</h3><p>Товар більше не представлений у каталозі</p></div></article>`).join('')}</div></section>`;
  root.addEventListener('click',event => {
    if (event.target.closest('[data-save-project]')) {
      if(!getCurrentUser()){showAuthDialog();return;}
      saveMyProject(project.id).then(()=>toast('Проєкт збережено в особистому кабінеті.')).catch(()=>toast('Не вдалося зберегти проєкт.'));
      return;
    }
    if (!event.target.closest('[data-project-add]')) return;
    let added = 0;
    rows.forEach(row => {
      if (!row.product || row.product.stock <= 0) return;
      addToCart(row.product,Math.min(row.quantity,row.product.stock)); added++;
    });
    toast(added ? `Компоненти проєкту додано до кошика (${added})` : 'Немає доступних компонентів');
  });
}
