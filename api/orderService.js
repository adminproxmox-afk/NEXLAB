import { request } from "./client.js";
export async function getOrders() {
  return (await request("orders")).orders;
}
export async function getOrderById(id) {
  return (await getOrders()).find((order) => order.id === id) || null;
}
export async function createOrder({ items, delivery, requestKey }) {
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
