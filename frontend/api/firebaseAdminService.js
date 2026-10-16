import { getProducts, setShopSettings } from "./productService.js";
import { getProjects } from "./projectService.js";
import { shopConfig } from "../js/shop-config.js";
import { getFirebaseServices } from "./firebaseAuth.js";
import {
  deleteFirebaseDocument,
  getFirebaseDocument,
  listFirebaseDocuments,
  saveFirebaseDocument,
  updateFirebaseDocument,
} from "./firebaseStore.js";
import { normalizeOrder } from "./orderService.js";

export async function loadFirebaseAdminData(permissions = {}) {
  const canOrders = Boolean(permissions.orders);
  const canCatalog = Boolean(permissions.catalog);
  const canWarehouse = Boolean(permissions.warehouse);
  const canSupport = Boolean(permissions.support);
  const canUsers = Boolean(permissions.users);
  const [products, projects, reviews, users, settings, orders, inventoryMovements, coupons] =
    await Promise.all([
      getProducts(),
      canCatalog ? getProjects() : Promise.resolve([]),
      canSupport ? listFirebaseDocuments("reviews") : Promise.resolve([]),
      canUsers ? listFirebaseDocuments("users") : Promise.resolve([]),
      getFirebaseDocument("settings", "store"),
      canOrders ? listFirebaseDocuments("orders") : Promise.resolve([]),
      canWarehouse ? listFirebaseDocuments("inventory_movements") : Promise.resolve([]),
      canCatalog ? listFirebaseDocuments("coupons") : Promise.resolve([]),
    ]);
  return {
    products,
    projects,
    reviews,
    users: users.map((user) => ({
      ...user,
      orderCount: canOrders ? orders.filter((order) => order.userId === user.id).length : null,
    })),
    settings: settings || shopConfig,
    orders: orders
      .map(normalizeOrder)
      .sort((a, b) => new Date(b.date) - new Date(a.date)),
    inventoryMovements: inventoryMovements.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 500),
    coupons: coupons.sort((a, b) => a.code.localeCompare(b.code)),
  };
}

export async function saveFirebaseProduct(product) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const previous = await getFirebaseDocument("products", product.id);
  const change = product.stock - (previous?.stock || 0);
  const batch = firestoreSdk.writeBatch(db);
  const productRef = firestoreSdk.doc(db, "products", product.id);
  const { id: _id, ...productData } = product;
  batch.set(productRef, productData);
  if (change) {
    const movementId = crypto.randomUUID();
    batch.set(firestoreSdk.doc(db, "inventory_movements", movementId), {
      productId: product.id,
      quantityChange: change,
      reason: previous && !previous.deleted ? "manual_adjustment" : "initial_stock",
      date: new Date().toISOString(),
    });
  }
  await batch.commit();
  return product;
}

export async function saveFirebaseStock(id, stock) {
  const { db, firestoreSdk } = await getFirebaseServices();
  const previous = await getFirebaseDocument("products", id);
  const change = Number(stock) - Number(previous?.stock || 0);
  const batch = firestoreSdk.writeBatch(db);
  batch.update(firestoreSdk.doc(db, "products", id), { stock: Number(stock) });
  if (change) {
    batch.set(firestoreSdk.doc(db, "inventory_movements", crypto.randomUUID()), {
      productId: id,
      quantityChange: change,
      reason: "manual_adjustment",
      date: new Date().toISOString(),
    });
  }
  await batch.commit();
  return { id, stock: Number(stock) };
}

export async function updateFirebaseUserRole(id, role) {
  return updateFirebaseDocument("users", id, { role });
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

export async function saveFirebaseCoupon(coupon, { create = false } = {}) {
  if (create && await getFirebaseDocument("coupons", coupon.code))
    throw new Error("COUPON_EXISTS");
  return saveFirebaseDocument("coupons", coupon.code, coupon);
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

export async function updateFirebaseOrderStatus(id, update) {
  await updateFirebaseDocument("orders", id, update);
}

export async function reviewFirebaseOrderReturn(id, decision, note = "") {
  const { auth } = await getFirebaseServices();
  const order = await getFirebaseDocument("orders", id);
  if (!order) throw new Error("ORDER_NOT_FOUND");
  if (order.status !== "delivered" || order.returnRequest?.status !== "requested")
    throw new Error("RETURN_NOT_PENDING");
  const reviewedAt = new Date().toISOString();
  const returnRequest = {
    ...order.returnRequest,
    status: decision,
    reviewedAt,
    reviewedBy: auth.currentUser?.displayName || auth.currentUser?.email || "Адміністратор",
    decisionNote: String(note || "").trim(),
  };
  const update = { returnRequest };
  if (decision === "accepted") {
    update.status = "returned";
    update.statusHistory = [
      ...(Array.isArray(order.statusHistory) ? order.statusHistory : []),
      { status: "returned", date: reviewedAt, note: "Повернення прийнято після отримання товару" },
    ];
  }
  await updateFirebaseDocument("orders", id, update);
  return { ...order, ...update };
}
