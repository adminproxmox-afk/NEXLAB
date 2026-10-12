export const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const money=value=>new Intl.NumberFormat('uk-UA').format(value)+' ₴';

export function projectInventory(project,products){
  const items=project.components.map(component=>({component,product:products.find(item=>item.id===component.productId)}));
  const ready=items.filter(({component,product})=>product&&product.stock>=component.quantity).length;
  const availableValue=items.reduce((sum,{component,product})=>sum+(product?product.price*Math.min(component.quantity,product.stock):0),0);
  return {items,ready,total:items.length,availableValue,complete:ready===items.length};
}

export function projectCover(project,products){
  const items=project.components.slice(0,3).map(({productId})=>products.find(product=>product.id===productId)).filter(Boolean);
  return `<div class="project-cover" aria-hidden="true">${items.map((product,index)=>`<div class="project-cover-photo project-cover-photo-${index+1}"><img src="${safe(product.images?.[0]||'')}" alt="" loading="lazy" decoding="async"></div>`).join('')}<span class="project-cover-id">NXL / ${safe(project.id.toUpperCase())}</span><span class="project-cover-count">${project.components.length} позиції</span></div>`;
}

export function projectCard(project,products){
  const {ready,total}=projectInventory(project,products);
  const url='project.html?id='+encodeURIComponent(project.id);
  return `<article class="project-card">${projectCover(project,products)}<div class="project-card-body"><div class="project-card-kicker"><span>${safe(project.difficulty)}</span><span>${ready}/${total} позицій у наявності</span></div><h3><a href="${url}">${safe(project.name)}</a></h3><p>${safe(project.description)}</p><div class="project-card-meta"><span>${total} компонентів</span><strong>≈ ${money(project.estimatedPrice)}</strong></div><a class="project-card-open" href="${url}">Відкрити проєкт <span aria-hidden="true">↗</span></a></div></article>`;
}
