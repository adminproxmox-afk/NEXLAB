import test from "node:test";
import assert from "node:assert/strict";
import { allocateNetItemRevenue } from "../frontend/js/admin-analytics.js";

test("product revenue allocations add up to the order total after discounts", () => {
  const rows = allocateNetItemRevenue({
    total: 903,
    items: [
      { id: "board", name: "Board", price: 700, quantity: 1 },
      { id: "sensor", name: "Sensor", price: 100, quantity: 3 },
    ],
  });
  assert.deepEqual(rows.map(({ revenue }) => revenue), [632, 271]);
  assert.equal(rows.reduce((sum, row) => sum + row.revenue, 0), 903);
});

test("single-item revenue matches the net order total and invalid rows are ignored", () => {
  const rows = allocateNetItemRevenue({
    total: 1260,
    items: [
      { id: "board", name: "Board", price: 350, quantity: 4 },
      { id: "broken", name: "Broken", price: 1, quantity: 0 },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].revenue, 1260);
});
