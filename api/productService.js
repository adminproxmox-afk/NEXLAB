import { products, categories } from "../js/products.js";
import { request } from "./client.js";
export { products, categories };
let pending;
export async function refreshProducts() {
  if (!pending)
    pending = request("products")
      .then((result) => {
        products.splice(0, products.length, ...result.products);
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
  return categories;
}
