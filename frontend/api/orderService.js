import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";
import { listFirebaseQuery } from "./firebaseStore.js";

export function normalizeOrder(order) {
  const delivery = order?.delivery && typeof order.delivery === "object"
    ? order.delivery
    : {};
  const items = Array.isArray(order?.items)
    ? order.items
        .filter(
          (item) =>
            item &&
            typeof item.name === "string" &&
            Number.isInteger(item.quantity) &&
            item.quantity > 0 &&
            Number.isFinite(item.price),
        )
        .map((item) => ({
          id: String(item.id || ""),
          name: item.name.slice(0, 200),
          quantity: item.quantity,
          price: item.price,
        }))
    : [];
  return {
    ...order,
    id: String(order?.id || ""),
    date: typeof order?.date === "string" ? order.date : new Date().toISOString(),
    status: ["processing", "confirmed", "shipped", "delivered", "cancelled", "returned"].includes(order?.status)
      ? order.status
      : "processing",
    items,
    total: Number.isFinite(order?.total)
      ? order.total
      : items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    discount: Number.isFinite(order?.discount) ? order.discount : 0,
    couponCode: typeof order?.couponCode === "string" ? order.couponCode : "",
    couponDiscount: Number.isFinite(order?.couponDiscount) ? order.couponDiscount : 0,
    bundleDiscount: Number.isFinite(order?.bundleDiscount) ? order.bundleDiscount : 0,
    bundlePromotions: Array.isArray(order?.bundlePromotions) ? order.bundlePromotions : [],
    trackingNumber: String(order?.trackingNumber || ""),
    statusHistory: Array.isArray(order?.statusHistory) ? order.statusHistory : [{ status: order?.status || "processing", date: order?.date || new Date().toISOString() }],
    delivery: {
      name: String(delivery.name || ""),
      phone: String(delivery.phone || ""),
      city: String(delivery.city || ""),
      address: String(delivery.address || ""),
      carrier: String(delivery.carrier || ""),
      payment: String(delivery.payment || ""),
    },
  };
}

export async function getOrders() {
  if (isFirebaseConfigured()) {
    const { auth } = await getFirebaseServices();
    if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
    const orders = await listFirebaseQuery("orders", "userId", auth.currentUser.uid);
    return orders
      .map(normalizeOrder)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  return (await request("orders")).orders;
}
export async function getOrderById(id) {
  return (await getOrders()).find((order) => order.id === id) || null;
}
export async function requestOrderReturn(orderId, reason) {
  if (isFirebaseConfigured()) {
    const { auth, db, firestoreSdk } = await getFirebaseServices();
    const user = auth.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    const orderRef = firestoreSdk.doc(db, "orders", orderId);
    const snapshot = await firestoreSdk.getDoc(orderRef);
    if (!snapshot.exists() || snapshot.data().userId !== user.uid) throw new Error("ORDER_NOT_FOUND");
    const order = snapshot.data();
    if (order.status !== "delivered") throw new Error("RETURN_NOT_AVAILABLE");
    if (["requested", "accepted"].includes(order.returnRequest?.status)) throw new Error("RETURN_ALREADY_REQUESTED");
    const returnRequest = {
      status: "requested",
      reason: String(reason || "").trim(),
      requestedAt: new Date().toISOString(),
    };
    await firestoreSdk.updateDoc(orderRef, { returnRequest });
    return returnRequest;
  }
  return (await request("orders/return-request", {
    method: "POST",
    body: { orderId, reason },
  })).returnRequest;
}
export async function createOrder({ items, delivery, requestKey, couponCode = "", bundleDiscount = 0, bundlePromotions = [] }) {
  if (isFirebaseConfigured()) {
    const { auth, db, firestoreSdk } = await getFirebaseServices();
    const user = auth.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    const id = requestKey;
    const orderRef = firestoreSdk.doc(db, "orders", id);
    return firestoreSdk.runTransaction(db, async (transaction) => {
      const previous = await transaction.get(orderRef);
      if (previous.exists()) return { id: previous.id, ...previous.data() };
      const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      let couponDiscount = 0;
      let couponRef;
      let couponSnapshot;
      if (couponCode) {
        couponRef = firestoreSdk.doc(db, "coupons", couponCode);
        couponSnapshot = await transaction.get(couponRef);
        const coupon = couponSnapshot.exists() ? couponSnapshot.data() : null;
        if (!coupon || !coupon.active || (coupon.validUntil && Date.parse(coupon.validUntil) < Date.now())
          || (coupon.maxUses !== null && coupon.maxUses !== undefined && coupon.usedCount >= coupon.maxUses))
          throw new Error("COUPON_INVALID");
        // Match the local backend: the minimum cart value is checked before
        // bundle and coupon discounts are applied.
        if (subtotal < coupon.minTotal) throw new Error("COUPON_MINIMUM_NOT_MET");
        couponDiscount = Math.floor((subtotal - bundleDiscount) * coupon.percent / 100);
      }
      const date = new Date().toISOString();
      const saleDiscount = items.reduce((sum, item) => sum + Math.max(0, (item.oldPrice || item.price) - item.price) * item.quantity, 0);
      const order = {
        id,
        userId: user.uid,
        date,
        status: "processing",
        statusHistory: [{ status: "processing", date }],
        items: items.map(({ id: productId, name, quantity, price }) => ({ id: productId, name, quantity, price })),
        total: subtotal - bundleDiscount - couponDiscount,
        discount: saleDiscount + couponDiscount + bundleDiscount,
        couponCode,
        couponDiscount,
        bundleDiscount,
        bundlePromotions,
        delivery: {
          name: String(delivery.name || "").trim(),
          phone: String(delivery.phone || "").replace(/[\s()-]/g, ""),
          city: String(delivery.city || "").trim(),
          address: String(delivery.address || "").trim(),
          carrier: delivery.carrier,
          payment: delivery.payment,
        },
        verificationRequired: true,
      };
      transaction.set(orderRef, order);
      if (couponSnapshot) transaction.update(couponRef, { usedCount: (couponSnapshot.data().usedCount || 0) + 1 });
      return order;
    });
  }
  return (
    await request("orders", {
      method: "POST",
      headers: { "Idempotency-Key": requestKey },
      body: {
        items: items.map(({ id, quantity, price }) => ({
          id,
          quantity,
          expectedPrice: price,
        })),
        delivery,
        couponCode,
      },
    })
  ).order;
}
