import test from "node:test";
import assert from "node:assert/strict";

test("API client retries a recovered server without waiting for browser online event", async () => {
  const handlers = {};
  const connectionChanges = [];
  globalThis.window = {
    addEventListener: (name, callback) => { handlers[name] = callback; },
    dispatchEvent: (event) => connectionChanges.push(event.detail.available),
  };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("http://127.0.0.1/"),
  });
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("connection refused");
    return {
      headers: { get: () => "application/json" },
      ok: true,
      json: async () => ({ ok: true }),
    };
  };
  const client = await import(`../frontend/api/client.js?recovery-test=${Date.now()}`);

  await assert.rejects(client.request("products"), { message: "BACKEND_UNAVAILABLE" });
  assert.equal(client.hasBackend(), false);
  assert.deepEqual(connectionChanges, [false]);
  await assert.rejects(client.request("products"), { message: "BACKEND_UNAVAILABLE" });
  assert.equal(attempts, 1);

  await new Promise((resolve) => setTimeout(resolve, 1_025));
  assert.deepEqual(await client.request("products"), { ok: true });
  assert.equal(client.hasBackend(), true);
  assert.equal(attempts, 2);
  assert.deepEqual(connectionChanges, [false, true]);

  delete globalThis.window;
  delete globalThis.fetch;
  delete globalThis.navigator;
  delete globalThis.location;
});

test("API client fails fast while offline and retries immediately after connectivity returns", async () => {
  const handlers = {};
  globalThis.window = {
    addEventListener: (name, callback) => { handlers[name] = callback; },
    dispatchEvent: () => true,
  };
  const network = { onLine: false };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: network });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("http://127.0.0.1/"),
  });
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return {
      headers: { get: () => "application/json" },
      ok: true,
      json: async () => ({ ok: true }),
    };
  };
  const client = await import(`../frontend/api/client.js?offline-test=${Date.now()}`);

  await assert.rejects(client.request("products"), { message: "BACKEND_UNAVAILABLE" });
  assert.equal(attempts, 0);
  network.onLine = true;
  handlers.online();
  assert.deepEqual(await client.request("products"), { ok: true });
  assert.equal(attempts, 1);

  delete globalThis.window;
  delete globalThis.fetch;
  delete globalThis.navigator;
  delete globalThis.location;
});

test("API client times out a stalled request and reports the backend as unavailable", async () => {
  globalThis.window = { addEventListener: () => {}, dispatchEvent: () => true };
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { onLine: true },
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("http://127.0.0.1/"),
  });
  globalThis.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  const client = await import(`../frontend/api/client.js?timeout-test=${Date.now()}`);

  await assert.rejects(client.request("orders", { timeoutMs: 5 }), { message: "BACKEND_UNAVAILABLE" });
  assert.equal(client.hasBackend(), false);

  delete globalThis.window;
  delete globalThis.fetch;
  delete globalThis.navigator;
  delete globalThis.location;
});
