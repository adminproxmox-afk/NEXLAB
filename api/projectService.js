import { projects } from "../js/products.js";
import { getProducts } from "./productService.js";
import { request } from "./client.js";
export { projects };
let pending;
export async function getProjects() {
  if (!pending)
    pending = request("projects")
      .then((result) => result.projects)
      .catch(async (error) => {
        if (error.message !== "BACKEND_UNAVAILABLE") throw error;
        return fallbackProjects();
      })
      .finally(() => (pending = null));
  return pending;
}
async function fallbackProjects() {
  const products = await getProducts();
  return projects.map((project) => ({
    ...project,
    estimatedPrice: project.components.reduce(
      (sum, item) =>
        sum +
        (products.find((p) => p.id === item.productId)?.price || 0) *
          item.quantity,
      0,
    ),
  }));
}
export async function getProjectById(id) {
  return (await getProjects()).find((project) => project.id === id) || null;
}
