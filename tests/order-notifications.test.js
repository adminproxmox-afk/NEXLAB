import test from "node:test";
import assert from "node:assert/strict";
import { collectOrderNotificationUpdates } from "../frontend/api/orderNotificationState.js";

test("the first order check stores a baseline without false notifications", () => {
  const result = collectOrderNotificationUpdates([
    { id: "order-1", status: "shipped", statusHistory: [{ status: "shipped", date: "2026-10-17" }] },
  ], null);
  assert.deepEqual(result.updates, []);
  assert.equal(result.state.initialized, true);
});

test("new statuses and tracking changes notify across later checks", () => {
  const initial = collectOrderNotificationUpdates([
    { id: "order-1", status: "processing", statusHistory: [{ status: "processing", date: "2026-10-17" }] },
  ], null);
  const changed = collectOrderNotificationUpdates([
    { id: "order-1", status: "shipped", trackingNumber: "NP123", statusHistory: [
      { status: "processing", date: "2026-10-17" },
      { status: "shipped", date: "2026-10-18", note: "Номер відстеження додано" },
    ] },
  ], initial.state);
  assert.equal(changed.updates.length, 1);
  assert.equal(changed.updates[0].trackingNumber, "NP123");
});

test("return decisions create a notification even when order status stays delivered", () => {
  const before = collectOrderNotificationUpdates([
    { id: "order-1", status: "delivered", statusHistory: [{ status: "delivered", date: "2026-10-18" }] },
  ], null);
  const after = collectOrderNotificationUpdates([{
    id: "order-1",
    status: "delivered",
    statusHistory: [{ status: "delivered", date: "2026-10-18" }],
    returnRequest: { status: "rejected", reviewedAt: "2026-10-19", decisionNote: "Не отримано" },
  }], before.state);
  assert.equal(after.updates.length, 1);
  assert.equal(after.updates[0].returnRequest.status, "rejected");
  const resubmitted = collectOrderNotificationUpdates([{
    id: "order-1",
    status: "delivered",
    statusHistory: [{ status: "delivered", date: "2026-10-18" }],
    returnRequest: { status: "requested", requestedAt: "2026-10-20" },
  }], after.state);
  assert.deepEqual(resubmitted.updates, []);
});

test("unchanged orders do not notify repeatedly and state is bounded", () => {
  const orders = Array.from({ length: 120 }, (_, index) => ({ id: `order-${index}`, status: "processing" }));
  const initial = collectOrderNotificationUpdates(orders, null);
  const repeated = collectOrderNotificationUpdates(orders, initial.state);
  assert.deepEqual(repeated.updates, []);
  assert.equal(Object.keys(initial.state.orders).length, 100);
});
