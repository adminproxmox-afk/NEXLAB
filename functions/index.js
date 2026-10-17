import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { createHash } from "node:crypto";
import {
  calculateOrder,
  inventoryAction,
  normalizeDelivery,
  normalizeOrderItems,
  validStatusChange,
} from "./order-logic.js";
import { stockAdjustment } from "./stock-logic.js";
import { normalizeCatalogImport } from "./catalog-logic.js";

initializeApp();
const db = getFirestore();

function fail(error) {
  const codes = {
    EMPTY_CART: "invalid-argument",
    INVALID_ITEMS: "invalid-argument",
    INVALID_DELIVERY: "invalid-argument",
    PRODUCT_NOT_FOUND: "not-found",
    OUT_OF_STOCK: "failed-precondition",
    PRICE_CHANGED: "failed-precondition",
    INVALID_STOCK: "invalid-argument",
    INVALID_CATALOG_IMPORT: "invalid-argument",
    INVALID_CATALOG_PRODUCT: "invalid-argument",
    COUPON_INVALID: "failed-precondition",
    COUPON_MINIMUM_NOT_MET: "failed-precondition",
    ORDER_NOT_FOUND: "not-found",
    ORDER_REQUEST_CHANGED: "already-exists",
    FORBIDDEN: "permission-denied",
    INVALID_STATUS: "failed-precondition",
    RETURN_NOT_PENDING: "failed-precondition",
  };
  throw new HttpsError(codes[error.message] || "internal", error.message || "ORDER_FAILED");
}

function requireAuth(request) {
  if (!request.auth) throw new HttpsError("unauthenticated", "UNAUTHENTICATED");
  return request.auth.uid;
}

async function requireOrderManager(uid) {
  const profile = await db.doc(`users/${uid}`).get();
  if (!(["admin", "order_manager"].includes(profile.data()?.role)))
    throw new HttpsError("permission-denied", "FORBIDDEN");
}

async function requireStockManager(uid) {
  const profile = await db.doc(`users/${uid}`).get();
  const role = profile.data()?.role;
  if (!["admin", "catalog_manager", "warehouse"].includes(role))
    throw new HttpsError("permission-denied", "FORBIDDEN");
  return role;
}

async function requireCatalogManager(uid) {
  const profile = await db.doc(`users/${uid}`).get();
  if (!(profile.data()?.role === "admin" || profile.data()?.role === "catalog_manager"))
    throw new HttpsError("permission-denied", "FORBIDDEN");
}

export const adjustStock = onCall({ region: "europe-west1", maxInstances: 10 }, async (request) => {
  const uid = requireAuth(request);
  const role = await requireStockManager(uid);
  const { productId, targetStock, reason } = request.data || {};
  if (typeof productId !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(productId))
    throw new HttpsError("invalid-argument", "INVALID_PRODUCT");
  try {
    return await db.runTransaction(async (transaction) => {
      const productRef = db.doc(`products/${productId}`);
      const productSnapshot = await transaction.get(productRef);
      if (!productSnapshot.exists || productSnapshot.data().deleted)
        throw new Error("PRODUCT_NOT_FOUND");
      const product = productSnapshot.data();
      const adjustment = stockAdjustment(product.stock, targetStock);
      if (!adjustment) return { id: productId, stock: product.stock, changed: false };
      const date = new Date().toISOString();
      const movementRef = db.collection("inventory_movements").doc();
      const initialStock = reason === "initial_stock" && ["admin", "catalog_manager"].includes(role);
      transaction.update(productRef, { stock: adjustment.stock });
      transaction.create(movementRef, {
        productId,
        quantityChange: adjustment.quantityChange,
        reason: initialStock ? "initial_stock" : "manual_adjustment",
        date,
      });
      return { id: productId, stock: adjustment.stock, changed: true };
    });
  } catch (error) {
    fail(error);
  }
});

export const importCatalog = onCall({ region: "europe-west1", maxInstances: 10 }, async (request) => {
  const uid = requireAuth(request);
  await requireCatalogManager(uid);
  let products;
  try {
    products = normalizeCatalogImport(request.data?.products);
  } catch (error) {
    throw new HttpsError("invalid-argument", error.message || "INVALID_CATALOG_IMPORT");
  }
  return db.runTransaction(async (transaction) => {
    const refs = products.map((product) => db.doc(`products/${product.id}`));
    const previous = await Promise.all(refs.map((ref) => transaction.get(ref)));
    const date = new Date().toISOString();
    let movements = 0;
    for (let index = 0; index < products.length; index++) {
      const { id, ...data } = products[index];
      const snapshot = previous[index];
      const oldStock = Number.isInteger(snapshot.data()?.stock) ? snapshot.data().stock : 0;
      const quantityChange = data.stock - oldStock;
      transaction.set(refs[index], { ...data, deleted: false });
      if (quantityChange) {
        transaction.create(db.collection("inventory_movements").doc(), {
          productId: id,
          quantityChange,
          reason: snapshot.exists ? "manual_adjustment" : "initial_stock",
          date,
        });
        movements++;
      }
    }
    return { imported: products.length, movements };
  });
});

export const createOrder = onCall({ region: "europe-west1", maxInstances: 10 }, async (request) => {
  const uid = requireAuth(request);
  const data = request.data || {};
  const requestKey = String(data.requestKey || "");
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(requestKey))
    throw new HttpsError("invalid-argument", "INVALID_REQUEST_KEY");
  const couponCode = String(data.couponCode || "").trim().toUpperCase();
  if (couponCode && !/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(couponCode))
    throw new HttpsError("invalid-argument", "COUPON_INVALID");

  const orderRef = db.doc(`orders/${uid}_${requestKey}`);
  const itemInput = data.items;
  const fingerprint = createHash("sha256").update(JSON.stringify({
    items: itemInput,
    delivery: data.delivery,
    couponCode,
  })).digest("hex");
  try {
    return await db.runTransaction(async (transaction) => {
      const previous = await transaction.get(orderRef);
      if (previous.exists) {
        if (previous.data().requestFingerprint !== fingerprint)
          throw new Error("ORDER_REQUEST_CHANGED");
        return previous.data();
      }
      if (!Array.isArray(itemInput) || itemInput.length < 1 || itemInput.length > 50)
        throw new Error("EMPTY_CART");
      const ids = [...new Set(itemInput.map((item) => item?.id).filter((id) => typeof id === "string"))];
      if (!ids.length || ids.length !== new Set(itemInput.map((item) => item?.id)).size)
        throw new Error("INVALID_ITEMS");
      if (ids.some((id) => !/^[a-zA-Z0-9_-]{1,120}$/.test(id)))
        throw new Error("INVALID_ITEMS");
      const productRefs = ids.map((id) => db.doc(`products/${id}`));
      const settingsRef = db.doc("settings/store");
      const projectsQuery = db.collection("projects");
      const refsToRead = [...productRefs, settingsRef];
      if (couponCode) refsToRead.push(db.doc(`coupons/${couponCode}`));
      const snapshots = await Promise.all(refsToRead.map((ref) => transaction.get(ref)));
      const projectSnapshot = await transaction.get(projectsQuery);
      const productsById = new Map(productRefs.map((ref, index) => [
        ref.id,
        snapshots[index].exists ? { id: ref.id, ...snapshots[index].data() } : null,
      ]));
      const settingsSnapshot = snapshots[productRefs.length];
      const settings = settingsSnapshot.exists ? settingsSnapshot.data() : null;
      const couponSnapshot = couponCode ? snapshots[productRefs.length + 1] : null;
      const coupon = couponSnapshot?.exists ? couponSnapshot.data() : null;
      const items = normalizeOrderItems(itemInput, productsById);
      const delivery = normalizeDelivery(data.delivery, settings);
      const projects = projectSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const totals = calculateOrder(items, projects, coupon, couponCode);
      const date = new Date().toISOString();
      const order = {
        id: orderRef.id,
        userId: uid,
        date,
        status: "processing",
        statusHistory: [{ status: "processing", date }],
        items: items.map(({ id, name, quantity, price }) => ({ id, name, quantity, price })),
        total: totals.total,
        discount: totals.discount,
        couponCode,
        couponDiscount: totals.couponDiscount,
        bundleDiscount: totals.bundleDiscount,
        bundlePromotions: totals.bundlePromotions,
        delivery,
        verificationRequired: false,
        stockReservationManaged: true,
        stockReserved: true,
        requestFingerprint: fingerprint,
      };
      for (const item of items) {
        const ref = db.doc(`products/${item.id}`);
        transaction.update(ref, { stock: item.stock - item.quantity });
        transaction.create(db.collection("inventory_movements").doc(), {
          productId: item.id,
          quantityChange: -item.quantity,
          reason: "order_reserved",
          orderId: order.id,
          date,
        });
      }
      if (couponSnapshot) transaction.update(db.doc(`coupons/${couponCode}`), {
        usedCount: FieldValue.increment(1),
      });
      transaction.create(orderRef, order);
      return order;
    });
  } catch (error) {
    fail(error);
  }
});

export const updateOrder = onCall({ region: "europe-west1", maxInstances: 10 }, async (request) => {
  const uid = requireAuth(request);
  await requireOrderManager(uid);
  const { orderId, status, trackingNumber } = request.data || {};
  if (typeof orderId !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(orderId)
    || ![...new Set(["processing", "confirmed", "shipped", "delivered", "cancelled", "returned"])].includes(status))
    throw new HttpsError("invalid-argument", "INVALID_ORDER");
  try {
    return await db.runTransaction(async (transaction) => {
      const orderRef = db.doc(`orders/${orderId}`);
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
      const order = snapshot.data();
      if (!validStatusChange(order.status, status, order)) throw new Error("INVALID_STATUS");
      const refs = order.items.map((item) => db.doc(`products/${item.id}`));
      const products = await Promise.all(refs.map((ref) => transaction.get(ref)));
      const date = new Date().toISOString();
      const action = inventoryAction(order, status);
      if (action) {
        for (let i = 0; i < order.items.length; i++) {
          const item = order.items[i];
          const product = products[i];
          if (!product.exists) throw new Error("PRODUCT_NOT_FOUND");
          const current = Number.isInteger(product.data().stock) ? product.data().stock : 0;
          if (action === "reserve" && current < item.quantity) throw new Error("OUT_OF_STOCK");
          const change = action === "reserve" ? -item.quantity : item.quantity;
          transaction.update(refs[i], { stock: current + change });
          transaction.create(db.collection("inventory_movements").doc(), {
            productId: item.id,
            quantityChange: change,
            reason: action === "return" ? "order_returned" : action === "release" ? "order_cancelled" : "order_reopened",
            orderId,
            date,
          });
        }
      }
      const history = Array.isArray(order.statusHistory) ? order.statusHistory : [];
      const changed = status !== order.status;
      const tracking = String(trackingNumber || "").trim().slice(0, 80);
      const trackingChanged = tracking !== String(order.trackingNumber || "");
      if (changed) history.push({ status, date });
      else if (trackingChanged) history.push({ status, date, note: "Номер відстеження оновлено" });
      const update = { trackingNumber: tracking, statusHistory: history.slice(-100) };
      if (changed) update.status = status;
      if (action === "reserve") update.stockReserved = true;
      if (action === "release" || action === "return") update.stockReserved = false;
      transaction.update(orderRef, update);
      return { ...order, ...update };
    });
  } catch (error) {
    fail(error);
  }
});

export const reviewOrderReturn = onCall({ region: "europe-west1", maxInstances: 10 }, async (request) => {
  const uid = requireAuth(request);
  await requireOrderManager(uid);
  const { orderId, decision, note = "" } = request.data || {};
  if (! ["accepted", "rejected"].includes(decision))
    throw new HttpsError("invalid-argument", "INVALID_DECISION");
  try {
    return await db.runTransaction(async (transaction) => {
      const orderRef = db.doc(`orders/${orderId}`);
      const snapshot = await transaction.get(orderRef);
      if (!snapshot.exists) throw new Error("ORDER_NOT_FOUND");
      const order = snapshot.data();
      if (order.status !== "delivered" || order.returnRequest?.status !== "requested")
        throw new Error("RETURN_NOT_PENDING");
      const date = new Date().toISOString();
      const returnRequest = {
        ...order.returnRequest,
        status: decision,
        reviewedAt: date,
        reviewedBy: request.auth.token.name || request.auth.token.email || "Менеджер",
        decisionNote: String(note || "").trim().slice(0, 300),
      };
      const update = { returnRequest };
      if (decision === "accepted") {
        if (order.stockReservationManaged === true && order.stockReserved === true) {
          const refs = order.items.map((item) => db.doc(`products/${item.id}`));
          const products = await Promise.all(refs.map((ref) => transaction.get(ref)));
          for (let i = 0; i < order.items.length; i++) {
            const item = order.items[i];
            const product = products[i];
            if (!product.exists) throw new Error("PRODUCT_NOT_FOUND");
            const stock = Number.isInteger(product.data().stock) ? product.data().stock : 0;
            transaction.update(refs[i], { stock: stock + item.quantity });
            transaction.create(db.collection("inventory_movements").doc(), {
              productId: item.id,
              quantityChange: item.quantity,
              reason: "order_returned",
              orderId,
              date,
            });
          }
          update.stockReserved = false;
        }
        update.status = "returned";
        update.statusHistory = [...(order.statusHistory || []), {
          status: "returned",
          date,
          note: "Повернення прийнято після отримання товару",
        }].slice(-100);
      }
      transaction.update(orderRef, update);
      return { ...order, ...update };
    });
  } catch (error) {
    fail(error);
  }
});
