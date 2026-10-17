import test from "node:test";
import assert from "node:assert/strict";
import { stockAdjustment } from "./stock-logic.js";

test("stock adjustments return a signed movement and avoid zero-value entries", () => {
  assert.deepEqual(stockAdjustment(4, 9), { stock: 9, quantityChange: 5 });
  assert.deepEqual(stockAdjustment(9, 4), { stock: 4, quantityChange: -5 });
  assert.equal(stockAdjustment(4, 4), null);
});

test("stock adjustments reject invalid or unreasonable quantities", () => {
  for (const [current, target] of [[-1, 1], [1, -1], [1, 100001], [1.5, 2], ["2", 3]])
    assert.throws(() => stockAdjustment(current, target), { message: "INVALID_STOCK" });
});
