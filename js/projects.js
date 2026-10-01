import { getMyProjects } from '../api/userProjectsService.js';
import { getProjectById } from './projectService.js';
import { getProductById } from './productService.js';
import { productArt, products } from './products.js';
import { getCurrentUser } from './session.js';

const safe=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export async function initializeMyProjects() {
  const root=document.querySelector('[data-my-projects]'); if(!root)return;
  const user=getCurrentUser(); const saved=await getMyProjects(user?.id);
  const records=await Promise.all(saved.map(async record=>({record,project:await getProjectById(record.projectId)})));
  const products=await Promise.all(records.map(({project})=>getProductById(project?.components[0]?.productId)));
  root.innerHTML=records.length?`<div class="my-project-grid">${records.map(({record,project},index)=>project?`<article class="my-project-card"><a href="project.html?id=${encodeURIComponent(project.id)}" class="my-project-art">${products[index]?productArt(products[index],true):''}</a><div class="my-project-copy"><p class="eyebrow">${safe(project.difficulty)}</p><h2>${safe(project.name)}</h2><div class="progress-meta"><span>Готовність</span><strong>${Math.min(100,Math.max(0,record.progress))}%</strong></div><div class="progress-track"><span style="width:${Math.min(100,Math.max(0,record.progress))}%"></span></div><div class="my-project-components">${record.components.map(item=>`<span>${safe(products.find(product=>product.id===item.productId)?.name || item.productId)}</span>`).join('')}</div><a class="text-link" href="project.html?id=${encodeURIComponent(project.id)}">Відкрити проєкт <span>↗</span></a></div></article>`:'').join('')}</div>`:'<div class="empty-state"><span class="empty-mark">◈</span><h2>Збережених проєктів поки немає</h2><p>Обери DIY-проєкт і збережи його у своїй майстерні.</p><a class="button button-primary" href="index.html#projects">Переглянути проєкти <span>↗</span></a></div>';
}
