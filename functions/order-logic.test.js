import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateOrder,
  inventoryAction,
  normalizeDelivery,
  normalizeOrderItems,
  validStatusChange,
} from "./order-logic.js";

const products = new Map([
  ["board", { name: "Board", price: 350, oldPrice: 400, stock: 5 }],
  ["sensor", { name: "Sensor", price: 100, stock: 10 }],
]);

test("server uses current catalog prices and flags a stale displayed price", () => {
  assert.throws(() => normalizeOrderItems([
    { id: "board", quantity: 1, price: 1, expectedPrice: 1 },
  ], products), { message: "PRICE_CHANGED" });
  const [item] = normalizeOrderItems([{ id: "board", quantity: 1, price: 1 }], products);
  assert.equal(item.price, 350);
});

test("validates stock and merges repeated product rows", () => {
  const items = normalizeOrderItems([
    { id: "sensor", quantity: 2 },
    { id: "sensor", quantity: 3 },
  ], products);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantity, 5);
  assert.throws(() => normalizeOrderItems([{ id: "sensor", quantity: 11 }], products), {
    message: "OUT_OF_STOCK",
  });
});

test("server calculates bundle and coupon discounts from catalog values", () => {
  const items = normalizeOrderItems([
    { id: "board", quantity: 1 },
    { id: "sensor", quantity: 1 },
  ], products);
  const result = calculateOrder(items, [{
    id: "starter",
    name: "Starter kit",
    bundleDiscountPercent: 10,
    components: [{ productId: "board", quantity: 1 }, { productId: "sensor", quantity: 1 }],
  }], { active: true, percent: 10, minTotal: 0, usedCount: 0, maxUses: 10 }, "SAVE10");
  assert.equal(result.subtotal, 450);
  assert.equal(result.bundleDiscount, 45);
  assert.equal(result.couponDiscount, 40);
  assert.equal(result.total, 365);
  assert.equal(result.discount, 135);
});

test("a bundle cannot count duplicate components without enough units", () => {
  const items = normalizeOrderItems([{ id: "sensor", quantity: 1 }], products);
  const result = calculateOrder(items, [{
    id: "double-sensor",
    name: "Two sensors",
    bundleDiscountPercent: 50,
    components: [{ productId: "sensor", quantity: 1 }, { productId: "sensor", quantity: 1 }],
  }], null, "");
  assert.equal(result.bundleDiscount, 0);
});

test("rejects exhausted coupons and invalid delivery options", () => {
  assert.throws(() => calculateOrder([{ id: "board", quantity: 1, price: 350 }], [], {
    active: true, percent: 10, usedCount: 2, maxUses: 2,
  }, "SAVE10"), { message: "COUPON_INVALID" });
  assert.throws(() => normalizeDelivery({ phone: "+380000000000" }, {
    deliveryMethods: [], paymentMethods: [],
  }), { message: "INVALID_DELIVERY" });
});

test("only allows a return after staff accepted the return request", () => {
  assert.equal(validStatusChange("delivered", "returned", { returnRequest: { status: "requested" } }), false);
  assert.equal(validStatusChange("delivered", "returned", { returnRequest: { status: "accepted" } }), true);
});

test("legacy Firebase orders never mutate stock automatically", () => {
  assert.equal(inventoryAction({ status: "processing", verificationRequired: true }, "cancelled"), null);
  assert.equal(inventoryAction({ status: "cancelled", verificationRequired: true }, "processing"), null);
});

test("managed orders release, reserve and return inventory only once", () => {
  const order = { status: "processing", stockReservationManaged: true, stockReserved: true };
  assert.equal(inventoryAction(order, "cancelled"), "release");
  assert.equal(inventoryAction({ ...order, status: "cancelled", stockReserved: false }, "processing"), "reserve");
  assert.equal(inventoryAction({ ...order, status: "delivered" }, "returned"), "return");
  assert.equal(inventoryAction({ ...order, stockReserved: false }, "cancelled"), null);
});
