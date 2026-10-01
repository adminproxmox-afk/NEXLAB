// Static adapter for the product catalog. Replace with fetch('/api/products') in a backend stage.
export { products, categories } from '../js/products.js';
import { products, categories } from '../js/products.js';
export async function getProducts() { return products; }
export async function getProductById(id) { return products.find(product => product.id === id) || null; }
export async function getCategories() { return categories; }
