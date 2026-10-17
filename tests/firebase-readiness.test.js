import test from "node:test";
import assert from "node:assert/strict";
import { checkFirebaseReadiness } from "../scripts/firebase-readiness.mjs";

test("Firebase readiness detects empty catalog and missing store settings", async () => {
  const checks = await checkFirebaseReadiness("demo-project", async (url) =>
    url.endsWith("/settings/store") || url.endsWith("/coupons/NEXLAB10")
      ? { status: 404, ok: false }
      : url.includes("cloudfunctions.net") ? { status: 404, ok: false }
      : { status: 200, ok: true, json: async () => ({ documents: [] }) },
  );
  assert.deepEqual(checks.map(({ name, ready, detail }) => ({ name, ready, detail })), [
    { name: "products", ready: false, detail: "empty" },
    { name: "projects", ready: false, detail: "empty" },
    { name: "store settings", ready: false, detail: "missing" },
    { name: "demo coupon NEXLAB10", ready: false, detail: "missing" },
    { name: "createOrder function", ready: false, detail: "not deployed" },
  ]);
});

test("Firebase readiness validates catalog, settings fields, and the checkout demo coupon", async () => {
  let callableOptions;
  const checks = await checkFirebaseReadiness("demo-project", async (url, options) => {
    if (url.includes("cloudfunctions.net")) {
      callableOptions = options;
      return { status: 401, ok: false };
    }
    if (url.endsWith("/settings/store"))
      return { status: 200, ok: true, json: async () => ({ fields: { name: { stringValue: "NEXLAB" } } }) };
    if (url.endsWith("/coupons/NEXLAB10"))
      return { status: 200, ok: true, json: async () => ({ fields: {
        code: { stringValue: "NEXLAB10" }, percent: { integerValue: "10" },
        minTotal: { integerValue: "1000" }, active: { booleanValue: true },
      } }) };
    return { status: 200, ok: true, json: async () => ({ documents: [{ name: "record" }] }) };
  });
  assert.ok(checks.every((check) => check.ready));
  assert.equal(callableOptions.method, "POST");
  assert.deepEqual(JSON.parse(callableOptions.body), { data: {} });
  assert.match(checks.at(-1).detail, /authentication required/);
});

test("Firebase readiness rejects a settings document without its store name", async () => {
  const checks = await checkFirebaseReadiness("demo-project", async (url) => ({
    status: 200,
    ok: true,
    json: async () => url.endsWith("/settings/store") ? { fields: {} }
      : url.endsWith("/coupons/NEXLAB10") ? { fields: {} }
      : { documents: [{ name: "record" }] },
  }));
  assert.equal(checks.find((check) => check.name === "store settings").detail, "incomplete");
  assert.equal(checks.find((check) => check.name === "demo coupon NEXLAB10").ready, false);
});
