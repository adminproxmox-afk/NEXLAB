import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {products,projects,productPhotos} from '../js/products.js';
const storage=new Map();
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
globalThis.window={dispatchEvent:()=>{}};
globalThis.document={querySelector:()=>null};
const cart=await import('../js/cart.js');
test('cart uses current prices and clamps quantities to current stock',()=>{
  const p=products[0],original={price:p.price,stock:p.stock};
  storage.clear();assert.equal(cart.addToCart(p,3),3);
  p.price=375;p.stock=2;
  assert.equal(cart.cartTotal(),750);assert.equal(cart.cartCount(),2);assert.equal(cart.addToCart(p,1),0);
  p.stock=0;assert.deepEqual(cart.getCart(),[]);Object.assign(p,original);
});
test('corrupt, duplicate and unknown cart rows cannot introduce arbitrary prices or stock',()=>{
  storage.set('nexlab-cart-v1',JSON.stringify([{id:'esp32-devkit',quantity:1,price:1,stock:999},{id:'esp32-devkit',quantity:2},{id:'missing',quantity:2},{id:'arduino-uno',quantity:-1}]));
  assert.equal(cart.cartCount(),3);assert.equal(cart.cartTotal(),1050);assert.equal(cart.getCart().length,1);
  storage.set('nexlab-cart-v1','invalid');assert.deepEqual(cart.getCart(),[]);
  storage.set('nexlab-cart-v1','{}');assert.deepEqual(cart.getCart(),[]);
});
test('cart reconciliation removes unavailable items and persists reduced quantities',()=>{
  const p=products[0],original=p.stock;
  storage.set('nexlab-cart-v1',JSON.stringify([{id:p.id,quantity:5},{id:'missing-product',quantity:1}]));
  p.stock=3;cart.reconcileCart();
  assert.deepEqual(JSON.parse(storage.get('nexlab-cart-v1')),[{id:p.id,quantity:3}]);
  p.stock=0;cart.reconcileCart();
  assert.deepEqual(JSON.parse(storage.get('nexlab-cart-v1')),[]);
  p.stock=original;
});
test('project costs equal the component totals; real galleries have distinct existing assets',()=>{
  for(const project of projects)assert.equal(project.estimatedPrice,project.components.reduce((s,c)=>s+products.find(p=>p.id===c.productId).price*c.quantity,0));
  for(const images of Object.values(productPhotos)){assert.equal(new Set(images).size,images.length);for(const image of images)assert.ok(existsSync(image));}
  for(const project of projects)assert.ok(existsSync('guides/'+project.id+'.ino')||existsSync(`guides/${project.id}/${project.id}.ino`));
});
