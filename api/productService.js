import { products, categories } from "../js/products.js";
import { shopConfig } from "../js/shop-config.js";
import { request } from "./client.js";
export { products, categories };
let pending;
let currentCategories = categories;
let storeSettings = shopConfig;
export function setShopSettings(settings) {
  storeSettings = settings;
}
export async function loadShopSettings() {
  try {
    storeSettings = (await request("store")).settings;
  } catch (error) {
    if (error.message !== "BACKEND_UNAVAILABLE") throw error;
  }
  return storeSettings;
}
export async function refreshProducts() {
  if (!pending)
    pending = request("products")
      .then((result) => {
        products.splice(0, products.length, ...result.products);
        currentCategories = result.categories || categories;
        storeSettings = result.settings || storeSettings;
        return products;
      })
      .catch((error) => {
        if (error.message === "BACKEND_UNAVAILABLE") return products;
        throw error;
      })
      .finally(() => (pending = null));
  return pending;
}
export async function getProducts() {
  return refreshProducts();
}
export async function getProductById(id) {
  return (await getProducts()).find((product) => product.id === id) || null;
}
export async function getCategories() {
  return currentCategories;
}
