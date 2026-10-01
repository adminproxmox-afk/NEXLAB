import { getFavorites, toggleFavorite } from './favorites.js';
import { productArt, products } from './products.js';
import { toast } from './notifications.js';
import { getCurrentUser, isAuthenticated } from './session.js';
import { showAuthDialog } from './authGate.js';
import { createOrder } from '../api/orderService.js';

const CART_KEY = 'nexlab-cart-v1';
function readCart() { try { return (JSON.parse(localStorage.getItem(CART_KEY)) || []).map(row=>{const product=products.find(item=>item.id===row.id);return product?{...row,name:product.name,category:product.category}:row;}); } catch { return []; } }
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(new Event('nexlab:cart-updated'));
}

export { getFavorites, toggleFavorite };
export const getCart = readCart;
export const cartCount = () => readCart().reduce((sum,row) => sum + row.quantity,0);
export const cartSubtotal = () => readCart().reduce((sum,row) => sum + (row.oldPrice || row.price) * row.quantity,0);
export const cartDiscount = () => readCart().reduce((sum,row) => sum + ((row.oldPrice || row.price) - row.price) * row.quantity,0);
export const cartTotal = () => readCart().reduce((sum,row) => sum + row.price * row.quantity,0);

// Local storage is the temporary cart service; replace its read/write methods with POST /api/cart later.
export function addToCart(product, quantity = 1) {
  if (!product || product.stock <= 0) return 0;
  const cart = readCart();
  const row = cart.find(item => item.id === product.id);
  const current = row?.quantity || 0;
  const added = Math.min(Math.max(1,quantity),Math.max(0,product.stock-current));
  if (!added) { toast('До кошика додано максимально доступну кількість товару'); return 0; }
  if (row) Object.assign(row,{quantity:current+added,price:product.price,oldPrice:product.oldPrice,stock:product.stock});
  else cart.push({id:product.id,name:product.name,category:product.category,image:product.image,price:product.price,oldPrice:product.oldPrice,stock:product.stock,quantity:added});
  saveCart(cart);
  return added;
}

export function changeQuantity(id, delta) {
  const cart = readCart().map(row => row.id === id ? {...row,quantity:Math.min(row.stock || Infinity,Math.max(1,row.quantity+delta))} : row);
  saveCart(cart);
}

export function removeFromCart(id) { saveCart(readCart().filter(row => row.id !== id)); }
export function clearCart() { saveCart([]); }

const money = value => `${new Intl.NumberFormat('uk-UA').format(value)} ₴`;
const safe = value => String(value || '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function renderCartPage() {
  const root = document.querySelector('[data-cart-items]');
  const summary = document.querySelector('[data-cart-summary]');
  if (!root || !summary) return;
  const cart = readCart();
  document.querySelector('[data-cart-title-count]').textContent = cart.length ? `(${cartCount()})` : '';
  if (!cart.length) {
    root.innerHTML = '<div class="cart-empty"><span class="empty-mark">▣</span><h2>Твій кошик поки порожній</h2><p>Обери компоненти для своєї наступної ідеї.</p><a class="button button-primary" href="catalog.html">До каталогу <span>↗</span></a></div>';
    summary.innerHTML = ''; return;
  }
  root.innerHTML = cart.map(row => `<article class="cart-row"><a href="product.html?id=${encodeURIComponent(row.id)}">${productArt(row)}</a><div><h3>${safe(row.name)}</h3><span class="product-category">${safe(row.category)}</span><div class="cart-row-price">${money(row.price)}${row.oldPrice ? `<del>${money(row.oldPrice)}</del>` : ''}</div><div class="quantity-control"><button type="button" data-quantity="${row.id}" data-delta="-1" aria-label="Зменшити кількість" ${row.quantity <= 1 ? 'disabled' : ''}>−</button><span>${row.quantity}</span><button type="button" data-quantity="${row.id}" data-delta="1" aria-label="Збільшити кількість" ${row.quantity >= row.stock ? 'disabled' : ''}>+</button></div></div><button class="remove-button" type="button" data-remove="${row.id}">Видалити</button></article>`).join('');
  const checkoutNote = isAuthenticated() ? 'Замовлення з’явиться у твоєму профілі після оформлення.' : 'Увійди, щоб оформити замовлення й відстежувати його статус.';
  summary.innerHTML = `<h2>Разом</h2><div class="summary-row"><span>Кількість товарів</span><span>${cartCount()}</span></div><div class="summary-row"><span>Вартість товарів</span><span>${money(cartSubtotal())}</span></div><div class="summary-row"><span>Знижка</span><span>− ${money(cartDiscount())}</span></div><div class="summary-row summary-total"><span>До сплати</span><span>${money(cartTotal())}</span></div><div class="cart-assurance"><span aria-hidden="true">⌁</span><p>${checkoutNote}</p></div><button class="button button-primary" type="button" data-checkout>Оформити замовлення <span>↗</span></button><p class="cart-note">Вартість доставки розрахуємо під час оформлення</p>`;
}

export function bindCartPage() {
  document.addEventListener('click',event => {
    const quantity = event.target.closest('[data-quantity]');
    if (quantity) changeQuantity(quantity.dataset.quantity,Number(quantity.dataset.delta));
    const remove = event.target.closest('[data-remove]');
    if (remove) {
      if (remove.dataset.confirm === 'yes') { removeFromCart(remove.dataset.remove); toast('Товар видалено з кошика'); }
      else { remove.dataset.confirm='yes'; remove.textContent='Підтвердити?'; setTimeout(() => { if (remove.isConnected) { remove.dataset.confirm=''; remove.textContent='Видалити'; } },2500); }
    }
    if (event.target.closest('[data-checkout]')) {
      if (!isAuthenticated()) { showAuthDialog(); return; }
      const items=readCart();
      createOrder({items:items.map(({id,name,quantity,price})=>({id,name,quantity,price})),total:cartTotal(),discount:cartDiscount()},getCurrentUser())
        .then(()=>{clearCart();toast('Замовлення створено. Переглянь його в особистому кабінеті.');setTimeout(()=>location.href='orders.html',700);})
        .catch(()=>toast('Не вдалося оформити замовлення. Спробуй ще раз.'));
    }
  });
}
