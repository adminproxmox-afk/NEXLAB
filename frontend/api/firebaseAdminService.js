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
  const previous = await getFirebaseDocument("products", product.id);
  const { id: _id, ...productData } = product;
  const targetStock = Number(product.stock);
  if (!Number.isInteger(targetStock) || targetStock < 0 || targetStock > 100000)
    throw new Error("INVALID_STOCK");
  const savedStock = Number.isInteger(previous?.stock) ? previous.stock : 0;
  await saveFirebaseDocument("products", product.id, {
    ...productData,
    stock: savedStock,
  });
  if (targetStock !== savedStock)
    await saveFirebaseStock(product.id, targetStock, previous ? "manual_adjustment" : "initial_stock");
  return product;
}

export async function importFirebaseCatalog(products) {
  const { functions, functionsSdk } = await getFirebaseServices();
  const callable = functionsSdk.httpsCallable(functions, "importCatalog");
  try {
    return (await callable({ products })).data;
  } catch (error) {
    const mapped = new Error(error.details?.message || error.details || error.message || "CATALOG_IMPORT_FAILED");
    mapped.code = error.code;
    throw mapped;
  }
}

export async function saveFirebaseStock(id, stock, reason = "manual_adjustment") {
  const { functions, functionsSdk } = await getFirebaseServices();
  const callable = functionsSdk.httpsCallable(functions, "adjustStock");
  try {
    return (await callable({ productId: id, targetStock: Number(stock), reason })).data;
  } catch (error) {
    throw new Error(error.details?.message || error.details || error.message || "STOCK_UPDATE_FAILED");
  }
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
  const { functions, functionsSdk } = await getFirebaseServices();
  const callable = functionsSdk.httpsCallable(functions, "updateOrder");
  try {
    return (await callable({ orderId: id, status: update.status, trackingNumber: update.trackingNumber })).data;
  } catch (error) {
    throw new Error(error.details?.message || error.details || error.message || "ORDER_UPDATE_FAILED");
  }
}

export async function reviewFirebaseOrderReturn(id, decision, note = "") {
  const { functions, functionsSdk } = await getFirebaseServices();
  const callable = functionsSdk.httpsCallable(functions, "reviewOrderReturn");
  try {
    return (await callable({ orderId: id, decision, note })).data;
  } catch (error) {
    throw new Error(error.details?.message || error.details || error.message || "RETURN_UPDATE_FAILED");
  }
}
