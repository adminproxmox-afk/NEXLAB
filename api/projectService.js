import { projects } from "../js/products.js";
import { getProducts } from "./productService.js";
import { request } from "./client.js";
import { isFirebaseConfigured } from "./firebaseAuth.js";
import { listFirebaseDocuments } from "./firebaseStore.js";
export { projects };
let pending;
let firebaseProjectsWarning = "";
export function getFirebaseProjectsWarning() {
  return firebaseProjectsWarning;
}
export async function getProjects() {
  if (!pending) {
    pending = isFirebaseConfigured()
      ? listFirebaseDocuments("projects")
          .then(async (records) => {
            const overrides = new Map(
              records.map((record) => [record.id, record]),
            );
            const merged = projects
              .map((project) => overrides.get(project.id) || project)
              .filter((project) => !project.deleted);
            const known = new Set(projects.map((project) => project.id));
            for (const record of records)
              if (!known.has(record.id) && !record.deleted) merged.push(record);
            const items = await getProducts();
            firebaseProjectsWarning = "";
            return merged.map((project) => ({
              ...project,
              estimatedPrice: project.components.reduce(
                (sum, item) =>
                  sum +
                  (items.find((product) => product.id === item.productId)
                    ?.price || 0) *
                    item.quantity,
                0,
              ),
            }));
          })
          .catch(async (error) => {
            if (
              ![
                "permission-denied",
                "unavailable",
                "firestore/permission-denied",
                "firestore/unavailable",
              ].includes(error.code)
            )
              throw error;
            firebaseProjectsWarning =
              "Показуємо базові DIY-проєкти: не вдалося синхронізувати їх із Firebase. Перевір правила Firestore.";
            return fallbackProjects();
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
