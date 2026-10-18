import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../frontend/service-worker.js", import.meta.url), "utf8");
const offlineAssets = JSON.parse(readFileSync(new URL("../frontend/offline-assets.json", import.meta.url), "utf8"));

test("offline manifest includes every new browser feature module", () => {
  for (const path of [
    "api/orderNotificationState.js",
    "api/stockAlertState.js",
    "api/imageUpload.js",
    "faq.html",
    "js/i18n.js",
    "js/offline-page.js",
    "js/admin-analytics.js",
    "js/auth-redirect.js",
    "js/order-notifications.js",
    "js/stock-alert-notifications.js",
  ]) assert.ok(offlineAssets.includes(path), `${path} must be cached for offline use`);
});

function createOfflineWorker(fetcher = async () => { throw new TypeError("offline"); }) {
  const handlers = new Map();
  const stores = new Map();
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { return store.get(new URL(request.url || request, "https://nexlab.test/").href) || null; },
        async put(request, response) { store.set(new URL(request.url || request, "https://nexlab.test/").href, response.clone()); },
        async keys() { return [...store.keys()].map((url) => new Request(url)); },
        async delete(request) { return store.delete(new URL(request.url || request, "https://nexlab.test/").href); },
        async add() {},
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: new URL("https://nexlab.test/NEXLAB/service-worker.js"),
    registration: { scope: "https://nexlab.test/NEXLAB/" },
    addEventListener(name, handler) { handlers.set(name, handler); },
    async skipWaiting() {},
    clients: { async claim() {} },
  };
  vm.runInNewContext(source, {
    self,
    caches,
    fetch: fetcher,
    URL,
    Response,
    Request,
    AbortController,
    Promise,
    JSON,
    setTimeout,
    clearTimeout,
  });
  return {
    caches,
    async request(url, { destination = "", method = "GET", mode = "cors", waitForBackground = true } = {}) {
      let responsePromise;
      const background = [];
      handlers.get("fetch")({
        request: { url, method, destination, mode, headers: { has: () => false } },
        respondWith(value) { responsePromise = Promise.resolve(value); },
        waitUntil(value) { background.push(value); },
      });
      const response = await responsePromise;
      if (waitForBackground) await Promise.allSettled(background);
      return response;
    },
  };
}

test("offline worker serves cached API modules and firmware while reporting API outages as JSON", async () => {
  const worker = createOfflineWorker();
  const cache = await worker.caches.open("nexlab-shell-v18");
  await cache.put("https://nexlab.test/NEXLAB/api/firebaseAuth.js", new Response("cached auth module"));
  await cache.put("https://nexlab.test/NEXLAB/guides/weather-station.ino", new Response("cached firmware"));

  const module = await worker.request("https://nexlab.test/NEXLAB/api/firebaseAuth.js", { destination: "script" });
  const firmware = await worker.request("https://nexlab.test/NEXLAB/guides/weather-station.ino");
  const api = await worker.request("https://nexlab.test/NEXLAB/api/products");

  assert.equal(await module.text(), "cached auth module");
  assert.equal(await firmware.text(), "cached firmware");
  assert.equal(api.status, 503);
  assert.deepEqual(await api.json(), { error: "BACKEND_UNAVAILABLE" });
});

test("offline worker returns a NEXLAB placeholder for uncached product images", async () => {
  const worker = createOfflineWorker();
  const image = await worker.request("https://nexlab.test/NEXLAB/assets/images/products/board.jpg", { destination: "image" });

  assert.equal(image.status, 200);
  assert.match(image.headers.get("content-type"), /image\/svg\+xml/);
  assert.match(await image.text(), /NEXLAB · OFFLINE/);
});

test("offline navigation uses cached pages and redirects unknown routes to the offline page", async () => {
  const worker = createOfflineWorker();
  const cache = await worker.caches.open("nexlab-shell-v18");
  await cache.put("https://nexlab.test/NEXLAB/index.html", new Response("cached home"));
  await cache.put("https://nexlab.test/NEXLAB/offline.html", new Response("offline page"));

  const response = await worker.request("https://nexlab.test/NEXLAB/project-not-cached.html", { mode: "navigate" });

  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://nexlab.test/NEXLAB/offline.html");
});

test("offline navigation returns a cached page before a slow background refresh", async () => {
  let finishNetwork;
  const worker = createOfflineWorker(() => new Promise((resolve) => { finishNetwork = resolve; }));
  const cache = await worker.caches.open("nexlab-shell-v18");
  await cache.put("https://nexlab.test/NEXLAB/catalog.html", new Response("cached catalog"));

  const response = await worker.request("https://nexlab.test/NEXLAB/catalog.html", {
    mode: "navigate",
    waitForBackground: false,
  });

  assert.equal(await response.text(), "cached catalog");
  assert.equal(typeof finishNetwork, "function");
  finishNetwork(new Response("fresh catalog", { status: 200 }));
});
