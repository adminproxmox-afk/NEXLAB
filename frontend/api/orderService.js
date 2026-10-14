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
    status: ["processing", "delivered", "cancelled", "returned"].includes(order?.status)
      ? order.status
      : "processing",
    items,
    total: Number.isFinite(order?.total)
      ? order.total
      : items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    discount: Number.isFinite(order?.discount) ? order.discount : 0,
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
export async function createOrder({ items, delivery, requestKey }) {
  if (isFirebaseConfigured()) {
    const { auth, db, firestoreSdk } = await getFirebaseServices();
    const user = auth.currentUser;
    if (!user) throw new Error("UNAUTHENTICATED");
    const id = requestKey;
    const orderRef = firestoreSdk.doc(db, "orders", id);
    const previous = await firestoreSdk.getDoc(orderRef);
    if (previous.exists()) return { id: previous.id, ...previous.data() };
    const order = {
      id,
      userId: user.uid,
      date: new Date().toISOString(),
      status: "processing",
      items: items.map(({ id: productId, name, quantity, price }) => ({
        id: productId,
        name,
        quantity,
        price,
      })),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      discount: 0,
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
    await firestoreSdk.setDoc(orderRef, order);
    return order;
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
      },
    })
  ).order;
}
