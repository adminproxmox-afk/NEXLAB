import { getProducts, setShopSettings } from "./productService.js";
import { getProjects } from "./projectService.js";
import { shopConfig } from "../js/shop-config.js";
import {
  deleteFirebaseDocument,
  getFirebaseDocument,
  listFirebaseDocuments,
  saveFirebaseDocument,
  updateFirebaseDocument,
} from "./firebaseStore.js";
import { normalizeOrder } from "./orderService.js";

export async function loadFirebaseAdminData() {
  const [products, projects, reviews, users, settings, orders] =
    await Promise.all([
      getProducts(),
      getProjects(),
      listFirebaseDocuments("reviews"),
      listFirebaseDocuments("users"),
      getFirebaseDocument("settings", "store"),
      listFirebaseDocuments("orders"),
    ]);
  return {
    products,
    projects,
    reviews,
    users: users.map((user) => ({
      ...user,
      orderCount: orders.filter((order) => order.userId === user.id).length,
    })),
    settings: settings || shopConfig,
    orders: orders
      .map(normalizeOrder)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
  };
}

export async function saveFirebaseProduct(product) {
  return saveFirebaseDocument("products", product.id, product);
}

export async function removeFirebaseProduct(id) {
  const product = await getFirebaseDocument("products", id);
  await saveFirebaseDocument("products", id, {
    ...product,
    id,
    deleted: true,
  });
}

export async function saveFirebaseProject(project) {
  return saveFirebaseDocument("projects", project.id, project);
}

export async function removeFirebaseProject(id) {
  const project = await getFirebaseDocument("projects", id);
  await saveFirebaseDocument("projects", id, {
    ...project,
    id,
    deleted: true,
  });
}

export async function saveFirebaseSettings(settings) {
  const saved = await saveFirebaseDocument("settings", "store", settings);
  setShopSettings(saved);
  return saved;
}

export async function removeFirebaseReview(id) {
  await deleteFirebaseDocument("reviews", id);
}

export async function updateFirebaseOrderStatus(id, status) {
  await updateFirebaseDocument("orders", id, { status });
}
