import { request } from './client.js';
export async function getReviews(productId) {return (await request('reviews?productId='+encodeURIComponent(productId))).reviews;}
export async function createReview(input) {return (await request('reviews',{method:'POST',body:input})).review;}
