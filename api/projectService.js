import { projects } from "../js/products.js";
import { getProducts } from "./productService.js";
import { request } from "./client.js";
import { isFirebaseConfigured } from "./firebaseAuth.js";
import { listFirebaseDocuments } from "./firebaseStore.js";
export { projects };
let pending;
export async function getProjects() {
  if (!pending) {
    pending = isFirebaseConfigured()
      ? listFirebaseDocuments("projects").then((records) => {
          const overrides = new Map(records.map((record) => [record.id, record]));
          const merged = projects
            .map((project) => overrides.get(project.id) || project)
            .filter((project) => !project.deleted);
          const known = new Set(projects.map((project) => project.id));
          for (const record of records)
            if (!known.has(record.id) && !record.deleted) merged.push(record);
          return getProducts().then((items) =>
            merged.map((project) => ({
              ...project,
              estimatedPrice: project.components.reduce(
                (sum, item) =>
                  sum +
                  (items.find((product) => product.id === item.productId)
                    ?.price || 0) *
                    item.quantity,
                0,
              ),
            })),
          );
        })
      : request("projects")
          .then((result) => result.projects)
          .catch(async (error) => {
            if (error.message !== "BACKEND_UNAVAILABLE") throw error;
            return fallbackProjects();
          });
    pending = pending.finally(() => (pending = null));
  }
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
