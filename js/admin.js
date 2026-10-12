import {request} from '../api/client.js';
import {categories,getProducts,refreshProducts} from '../api/productService.js';
import {getCurrentUser,isAdmin} from './session.js';

const safe=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('uk-UA').format(value)+' ₴';
const shortDate=value=>new Intl.DateTimeFormat('uk-UA',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(value));
const labels={processing:'В обробці',delivered:'Доставлено',cancelled:'Скасовано',returned:'Повернення прийнято'};
const transitions={processing:['processing','delivered','cancelled'],delivered:['delivered','returned'],cancelled:['cancelled','processing'],returned:['returned']};

function orderCard(order) {
  const items=order.items.map(item=>`<li>${safe(item.name)} × ${item.quantity} <span>${money(item.price*item.quantity)}</span></li>`).join('');
  return `<article class="admin-order profile-panel"><div class="admin-order-heading"><div><p class="eyebrow">Замовлення</p><h3 class="order-id">№ ${safe(order.id)}</h3></div><strong>${money(order.total)}</strong></div>
    <div class="admin-order-details"><p><strong>${safe(order.delivery.name)}</strong><br>${safe(order.delivery.phone)}</p><p>${safe(order.delivery.city)}, ${safe(order.delivery.address)}</p><p>${order.delivery.carrier==='nova-poshta'?'Нова пошта':'Укрпошта'} · ${order.delivery.payment==='cod'?'Післяплата':'Оплата карткою'}</p></div>
    <details><summary>Склад замовлення (${order.items.length})</summary><ul class="admin-order-items">${items}</ul></details>
    <form class="admin-order-form" data-admin-order="${safe(order.id)}"><label>Статус<select name="status">${(transitions[order.status]||[order.status]).map(value=>`<option value="${value}" ${order.status===value?'selected':''}>${labels[value]||safe(value)}</option>`).join('')}</select></label><button class="button button-quiet" type="submit" ${order.status==='returned'?'disabled':''}>Зберегти статус</button><span role="status" data-admin-status></span>${order.status==='delivered'?'<small>Позначай повернення лише після фактичного отримання товару.</small>':''}</form>
  </article>`;
}

const imageKinds=[['board','Плата'],['arduino','Arduino'],['pi','Одноплатний комп’ютер'],['sensor','Датчик'],['display','Дисплей'],['ultrasonic','Ультразвуковий датчик'],['strip','LED-стрічка'],['power','Живлення'],['tool','Інструмент'],['cable','Кабель'],['kit','Набір'],['filament','Філамент'],['components','Компоненти']];
const specsText=specifications=>Object.entries(specifications||{}).map(([key,value])=>`${key}: ${value}`).join('\n');
function productEditor(product) {
  const editing=Boolean(product);
  const value=(key,fallback='')=>safe(product?.[key]??fallback);
  return `<details class="admin-product-editor" ${editing?'':'open'}><summary><span>${editing?safe(product.name):'＋ Додати товар'}</span>${editing?`<small>${money(product.price)} · ${product.stock} шт.</small>`:''}</summary><form class="admin-product-form" data-admin-product="${editing?'edit':'new'}" data-existing="${editing}">
    <label>Артикул (латиницею)<input name="id" value="${value('id')}" pattern="[a-z0-9]+(-[a-z0-9]+)*" maxlength="64" ${editing?'readonly':'required'} placeholder="наприклад, esp32-s3"></label>
    <label>Назва товару<input name="name" value="${value('name')}" maxlength="120" required></label>
    <label>Категорія<select name="category" required>${categories.map(category=>`<option value="${safe(category.name)}" ${product?.category===category.name?'selected':''}>${safe(category.name)}</option>`).join('')}</select></label>
    <label>Бренд<input name="brand" value="${value('brand')}" maxlength="100" required></label><label>Підкатегорія<input name="subcategory" value="${value('subcategory')}" maxlength="120" required></label><label>Модель / SKU<input name="sku" value="${value('sku')}" maxlength="100" required></label>
    <label>Ціна, ₴<input name="price" type="number" min="0" max="10000000" step="1" value="${value('price',0)}" required></label><label>Стара ціна, ₴<input name="oldPrice" type="number" min="0" max="10000000" step="1" value="${value('oldPrice')}" placeholder="Не показувати знижку"></label><label>Залишок, шт.<input name="stock" type="number" min="0" max="100000" step="1" value="${value('stock',0)}" required></label>
    <label>Ілюстрація<select name="image">${imageKinds.map(([id,name])=>`<option value="${id}" ${product?.image===id?'selected':''}>${name}</option>`).join('')}</select></label><label class="admin-wide">Фото товару: HTTPS URL, кожне з нового рядка<textarea name="images" rows="3" placeholder="https://...">${safe((product?.images||[]).join('\n'))}</textarea><small>Також можна вказати шлях assets/images/...</small></label>
    <label class="admin-wide">Опис<textarea name="description" rows="4" maxlength="3000" required>${value('description')}</textarea></label><label class="admin-wide">Теги через кому<input name="tags" value="${value('tags',(product?.tags||[]).join(', '))}" placeholder="ESP32, Wi-Fi, Bluetooth"></label>
    <label class="admin-wide">Характеристики — по одній «назва: значення» на рядок<textarea name="specifications" rows="4" placeholder="Живлення: 5 V&#10;Інтерфейс: USB-C">${safe(specsText(product?.specifications))}</textarea></label>
    <label class="admin-check"><input name="featured" type="checkbox" ${product?.featured?'checked':''}> Показувати на головній</label><label class="admin-check"><input name="isNew" type="checkbox" ${product?.isNew?'checked':''}> Позначити як новинку</label>
    <div class="admin-product-actions"><button class="button button-primary" type="submit">${editing?'Зберегти зміни':'Створити товар'}</button>${editing?`<button class="button button-quiet" type="button" data-delete-product="${safe(product.id)}">Видалити товар</button>`:''}</div><p role="status" data-admin-status></p>
  </form></details>`;
}

export async function initializeAdmin() {
  const root=document.querySelector('[data-admin-content]');
  if(!root||!isAdmin())return;
  root.innerHTML='<p class="eyebrow">NEXLAB / Керування</p><div class="admin-title-row"><div><h1>Панель керування</h1><p>Вітаємо, '+safe(getCurrentUser()?.name||'Адміністратор')+'. Дані зберігаються в SQLite на сервері.</p></div><button class="button button-quiet" type="button" data-admin-refresh>Оновити дані</button></div><p class="service-error" role="alert" data-admin-error hidden></p><section aria-labelledby="admin-summary-title"><h2 id="admin-summary-title">Огляд магазину</h2><div class="admin-metrics" data-admin-metrics></div></section><section class="admin-section"><h2>Замовлення</h2><div class="admin-order-list" data-admin-orders></div></section><section class="admin-section"><h2>Каталог і склад</h2><p class="admin-section-note">Зміни одразу зберігаються у базі магазину.</p><div class="admin-products" data-admin-products></div></section><section class="admin-section"><h2>Відгуки</h2><div class="admin-reviews" data-admin-reviews></div></section><section class="admin-section"><h2>Користувачі</h2><div class="admin-users" data-admin-users></div></section>';
  const errorBox=root.querySelector('[data-admin-error]');
  async function load() {
    errorBox.hidden=true;
    root.querySelector('[data-admin-refresh]').disabled=true;
    try {
      const [products,{orders},{reviews},{users}]=await Promise.all([getProducts(),request('admin/orders'),request('admin/reviews'),request('admin/users')]);
      const active=orders.filter(order=>order.status==='processing').length;
      const lowStock=products.filter(product=>product.stock<5).length;
      const revenue=orders.filter(order=>!['cancelled','returned'].includes(order.status)).reduce((sum,order)=>sum+order.total,0);
      root.querySelector('[data-admin-metrics]').innerHTML=`<article><span>Товари</span><strong>${products.length}</strong></article><article><span>Усі замовлення</span><strong>${orders.length}</strong></article><article><span>В обробці</span><strong>${active}</strong></article><article><span>Користувачі</span><strong>${users.length}</strong></article><article><span>Відгуки</span><strong>${reviews.length}</strong></article><article><span>На складі менше 5 шт.</span><strong>${lowStock}</strong></article><article><span>Сума замовлень без скасувань і повернень</span><strong>${money(revenue)}</strong></article>`;
      root.querySelector('[data-admin-orders]').innerHTML=orders.length?orders.map(orderCard).join(''):'<p class="admin-empty">Замовлень поки немає.</p>';
      root.querySelector('[data-admin-products]').innerHTML=`<button class="button button-primary" type="button" data-admin-add-product>＋ Додати товар</button>${productEditor(null)}${products.map(productEditor).join('')}`;
      root.querySelector('[data-admin-reviews]').innerHTML=reviews.length?reviews.map(review=>`<article class="admin-record"><div><strong>${safe(review.userName)} · ${'★'.repeat(review.rating)}</strong><small>${safe(products.find(item=>item.id===review.productId)?.name||review.productId)} · ${shortDate(review.date)}</small><p>${safe(review.text)}</p></div><button class="button button-quiet" type="button" data-delete-review="${safe(review.id)}" aria-label="Видалити відгук">Видалити</button></article>`).join(''):'<p class="admin-empty">Відгуків поки немає.</p>';
      root.querySelector('[data-admin-users]').innerHTML=users.length?`<div class="admin-user-list">${users.map(account=>`<article class="admin-record"><div><strong>${safe(account.name)}${account.role==='admin'?' · адміністратор':''}</strong><small>${safe(account.email)} · ${shortDate(account.createdAt)}</small>${account.role==='user'?`<small data-reset-result="${safe(account.id)}" role="status"></small>`:''}</div><span>${account.orderCount} замовл.</span>${account.role==='user'?`<button class="button button-quiet" type="button" data-reset-user="${safe(account.id)}">Видати тимчасовий пароль</button>`:''}</article>`).join('')}</div>`:'<p class="admin-empty">Користувачів поки немає.</p>';
    } catch(error) {
      errorBox.textContent=error.message==='BACKEND_UNAVAILABLE'?'Сервер недоступний. Запусти npm start і онови сторінку.':'Не вдалося завантажити дані. Онови сторінку або перевір з’єднання з базою.';
      errorBox.hidden=false;
    } finally {root.querySelector('[data-admin-refresh]').disabled=false;}
  }
  root.addEventListener('click',async event=>{
    if(event.target.closest('[data-admin-refresh]'))return load();
    if(event.target.closest('[data-admin-add-product]')){const editor=root.querySelector('.admin-product-editor');editor.open=true;editor.querySelector('[name=id]').focus();return;}
    const deleteProduct=event.target.closest('[data-delete-product]');
    if(deleteProduct) {
      if(!window.confirm(`Видалити товар «${deleteProduct.dataset.deleteProduct}»?`))return;
      deleteProduct.disabled=true;
      try {await request('admin/products',{method:'DELETE',body:{id:deleteProduct.dataset.deleteProduct}});await refreshProducts();await load();}
      catch {const status=deleteProduct.closest('form').querySelector('[data-admin-status]');status.textContent='Не вдалося видалити товар. Онови сторінку і спробуй ще раз.';deleteProduct.disabled=false;}
      return;
    }
    const button=event.target.closest('[data-delete-review]');if(!button)return;
    if(!window.confirm('Видалити цей відгук?'))return;
    button.disabled=true;
    try {await request('admin/reviews',{method:'DELETE',body:{id:button.dataset.deleteReview}});await load();}
    catch {errorBox.textContent='Не вдалося видалити відгук. Онови сторінку та спробуй ще раз.';errorBox.hidden=false;button.disabled=false;}
  });
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-reset-user]');if(!button)return;
    if(!window.confirm('Видати користувачу новий тимчасовий пароль? Його активні сеанси буде завершено.'))return;
    button.disabled=true;
    const output=root.querySelector(`[data-reset-result="${CSS.escape(button.dataset.resetUser)}"]`);
    try {
      const {temporaryPassword}=await request('admin/users/reset-password',{method:'POST',body:{id:button.dataset.resetUser}});
      output.textContent=`Тимчасовий пароль (покажи користувачу безпечним способом): ${temporaryPassword}`;
      button.textContent='Пароль видано';
    } catch {output.textContent='Не вдалося змінити пароль. Онови сторінку й спробуй ще раз.';button.disabled=false;}
  });
  root.addEventListener('submit',async event=>{
    const productForm=event.target.closest('[data-admin-product]');
    const orderForm=event.target.closest('[data-admin-order]');
    const form=productForm||orderForm;
    if(!form)return;
    event.preventDefault();
    const button=form.querySelector('button'),status=form.querySelector('[data-admin-status]');
    if(button.disabled)return;
    button.disabled=true;status.textContent='Збереження…';
    try {
      if(productForm) {
        const specifications={};
        for(const line of form.elements.specifications.value.split(/\r?\n/)) {if(!line.trim())continue;const colon=line.indexOf(':');if(colon<1)throw new Error('INVALID_SPECS');specifications[line.slice(0,colon).trim()]=line.slice(colon+1).trim();}
        const input={id:form.elements.id.value.trim(),name:form.elements.name.value.trim(),category:form.elements.category.value,description:form.elements.description.value.trim(),brand:form.elements.brand.value.trim(),subcategory:form.elements.subcategory.value.trim(),sku:form.elements.sku.value.trim(),image:form.elements.image.value,price:Number(form.elements.price.value),oldPrice:form.elements.oldPrice.value===''?null:Number(form.elements.oldPrice.value),stock:Number(form.elements.stock.value),tags:form.elements.tags.value.split(',').map(tag=>tag.trim()).filter(Boolean),featured:form.elements.featured.checked,isNew:form.elements.isNew.checked,specifications,images:form.elements.images.value.split(/\r?\n/).map(image=>image.trim()).filter(Boolean)};
        await request('admin/products',{method:form.dataset.existing==='true'?'PATCH':'POST',body:input});
        await refreshProducts();
        if(form.dataset.existing==='true') {const summary=form.closest('details').querySelector('summary');summary.querySelector('span').textContent=input.name;summary.querySelector('small').textContent=`${money(input.price)} · ${input.stock} шт.`;status.textContent='Зміни збережено.';}
        else await load();
      } else {
        if(form.elements.status.value==='returned'&&!window.confirm('Підтверджуєш, що повернений товар фактично отримано і його можна знову додати на склад?')){status.textContent='Статус не змінено.';return;}
        await request('admin/orders',{method:'PATCH',body:{id:form.dataset.adminOrder,status:form.elements.status.value}});
        status.textContent='Статус збережено.';await load();
      }
    } catch(error) {
      status.textContent=error.message==='INVALID_SPECS'?'Характеристику введи у форматі «назва: значення».':error.message==='PRODUCT_EXISTS'?'Такий артикул уже є у каталозі.':error.message==='INVALID_PRODUCT'||error.message==='INVALID_INPUT'?'Перевір обов’язкові поля, ціну, залишок і посилання на фото.':error.message==='OUT_OF_STOCK'?'Недостатньо залишку, щоб відновити замовлення.':error.message==='INVALID_ORDER_TRANSITION'?'Цей перехід статусу недоступний.':'Не вдалося зберегти. Спробуй ще раз.';
    } finally {button.disabled=false;}
  });
  await load();
}
