import { getOrders } from '../api/orderService.js';
import { getCurrentUser } from './session.js';

const money=value=>`${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const date=value=>new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
const safe=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const statuses={processing:['В обробці','status-pending'],delivered:['Доставлено','status-done'],cancelled:['Скасовано','status-cancelled']};

export async function initializeOrdersPage() {
  const root=document.querySelector('[data-orders]'); if(!root)return;
  root.innerHTML='<div class="loading-state"><span class="loading-line"></span><span class="loading-line"></span></div>';
  const orders=await getOrders(getCurrentUser()?.id);
  if(!orders.length){root.innerHTML='<div class="empty-state"><span class="empty-mark">▣</span><h2>Замовлень поки немає</h2><p>Тут з’явиться історія покупок після першого оформлення.</p><a class="button button-primary" href="catalog.html">До каталогу <span>↗</span></a></div>';return;}
  root.innerHTML=`<div class="orders-list">${orders.map(order=>{const [label,className]=statuses[order.status]||statuses.processing;return `<article class="order-card"><div class="order-top"><div><p class="eyebrow">Замовлення №${safe(order.id)}</p><time>${date(order.date)}</time></div><span class="order-status ${className}">${label}</span></div><div class="order-bottom"><span>${order.items.reduce((sum,item)=>sum+item.quantity,0)} товарів</span><strong>${money(order.total)}</strong></div><details class="order-details"><summary>Деталі замовлення</summary><ul>${order.items.map(item=>`<li><span>${safe(item.name)} × ${item.quantity}</span><span>${money(item.price*item.quantity)}</span></li>`).join('')}</ul>${order.discount?`<small>Знижка: − ${money(order.discount)}</small>`:''}<p class="demo-note">${order.id.startsWith('1000')?'Демонстраційне замовлення':''}</p></details></article>`;}).join('')}</div>`;
}
