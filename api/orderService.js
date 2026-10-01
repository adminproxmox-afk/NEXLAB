import { getCurrentUser } from '../js/session.js';
import { products } from '../js/products.js';

function key(userId) { return `nexlab_orders_${userId}`; }
function read(userId) { try { return JSON.parse(localStorage.getItem(key(userId))) || []; } catch { return []; } }
function write(userId,orders) { localStorage.setItem(key(userId),JSON.stringify(orders)); }

// Demo order data belongs to the current local user; replace these methods with GET/POST /api/orders.
export async function getOrders(userId=getCurrentUser()?.id) {
  if (!userId) return [];
  const saved=localStorage.getItem(key(userId));
  if (saved !== null) return read(userId).map(order => ({
    ...order,
    items: order.items.map(item => ({
      ...item,
      name: products.find(product => product.id === item.id)?.name || ({
        'Набор для пайки Start':'Стартовий набір для паяння',
        'PLA филамент · 1 кг':'Філамент PLA · 1 кг'
      }[item.name] || item.name)
    }))
  }));
  const date=new Date().toISOString();
  const examples=[
    {id:'10001',userId,date,status:'processing',total:1250,discount:380,items:[{id:'esp32-devkit',name:'ESP32 DevKit V1',quantity:1,price:350},{id:'solder-kit',name:'Стартовий набір для паяння',quantity:1,price:790},{id:'arduino-uno',name:'Arduino UNO R3',quantity:1,price:490}]},
    {id:'10002',userId,date:new Date(Date.now()-86400000*12).toISOString(),status:'delivered',total:540,discount:0,items:[{id:'pla-filament',name:'Філамент PLA · 1 кг',quantity:1,price:540}]}
  ];
  write(userId,examples);
  return examples;
}

export async function getOrderById(id,userId=getCurrentUser()?.id) {
  return (await getOrders(userId)).find(order=>order.id===id) || null;
}

export async function createOrder({items,total,discount=0},user=getCurrentUser()) {
  if (!user) throw new Error('UNAUTHENTICATED');
  const orders=await getOrders(user.id);
  const order={id:String(Date.now()),userId:user.id,date:new Date().toISOString(),status:'processing',items,total,discount};
  write(user.id,[order,...orders]);
  return order;
}
