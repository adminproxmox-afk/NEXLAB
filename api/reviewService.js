import { getCurrentUser } from '../js/session.js';

const KEY='nexlab_reviews';
const examples={
  'esp32-devkit':[{id:'sample-1',userName:'Ілля',rating:5,text:'Швидко запустив перший IoT-проєкт, плата одразу визначилася.',date:'2026-09-18'},{id:'sample-2',userName:'Марина',rating:4,text:'Чудова плата для прототипування. Усе відповідає опису.',date:'2026-09-10'}]
};
function read() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }

export async function getReviews(productId) {
  return [...(examples[productId] || []),...read().filter(review=>review.productId===productId)];
}

export async function createReview({productId,rating,text},user=getCurrentUser()) {
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!Number.isInteger(rating) || rating<1 || rating>5) throw new Error('INVALID_RATING');
  if (!text.trim()) throw new Error('EMPTY_REVIEW');
  const review={id:globalThis.crypto?.randomUUID?.() || `review-${Date.now()}`,userId:user.id,userName:user.name,productId,rating,text:text.trim(),date:new Date().toISOString()};
  localStorage.setItem(KEY,JSON.stringify([review,...read()]));
  return review;
}
