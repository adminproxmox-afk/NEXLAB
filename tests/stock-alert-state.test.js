import test from "node:test";
import assert from "node:assert/strict";
import { claimAvailableStockAlerts, selectAvailableStockAlerts } from "../frontend/api/stockAlertState.js";

test("restock alerts select only subscribed, available and not yet notified products", () => {
  const subscriptions = [
    { productId: "available", ref: "a" },
    { productId: "already-notified", notifiedAt: "2026-01-01", ref: "b" },
    { productId: "out-of-stock", ref: "c" },
    { productId: "removed", ref: "d" },
  ];
  const products = [
    { id: "available", name: "ESP32", stock: 1 },
    { id: "already-notified", name: "DHT22", stock: 4 },
    { id: "out-of-stock", name: "Relay", stock: 0 },
  ];
  assert.deepEqual(selectAvailableStockAlerts(subscriptions, products), [
    { productId: "available", name: "ESP32", ref: "a" },
  ]);
});

test("restock alert claims only notify the tab that atomically claims the alert", async () => {
  const alerts = [{ productId: "sensor", name: "Sensor" }];
  let notifiedAt = null;
  const claim = async () => {
    if (notifiedAt) return null;
    notifiedAt = "2026-10-17T12:00:00.000Z";
    return "claim-1";
  };
  const [first, second] = await Promise.all([
    claimAvailableStockAlerts(alerts, claim),
    claimAvailableStockAlerts(alerts, claim),
  ]);
  assert.equal(first.length + second.length, 1);
});
