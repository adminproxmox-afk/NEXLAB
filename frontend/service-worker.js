const CACHE_NAME = "nexlab-shell-v1";
const OFFLINE_PAGE = new URL("offline.html", self.registration.scope).href;
const MANIFEST_URL = new URL("offline-assets.json", self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(MANIFEST_URL, { cache: "reload" });
      if (response.ok) {
        const assets = await response.json();
        const urls = [...new Set(["offline.html", "offline-assets.json", ...assets])]
          .map((asset) => new URL(asset, self.registration.scope).href);
        await Promise.allSettled(urls.map((url) => cache.add(url)));
      }
    } catch {
      await cache.add(OFFLINE_PAGE).catch(() => {});
    }
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith("nexlab-shell-") && key !== CACHE_NAME)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function fetchWithTimeout(request, timeout = 2800) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function saveImageResponse(request, response) {
  if (!response.ok || response.type === "opaque") return response;
  const cache = await caches.open("nexlab-images-v1");
  await cache.put(request, response.clone());
  const entries = await cache.keys();
  if (entries.length > 80) await cache.delete(entries[0]);
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes("/api/")) return;
  if (request.headers.has("authorization")) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetchWithTimeout(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const scopeUrl = new URL(self.registration.scope);
        const relativePath = url.pathname.startsWith(scopeUrl.pathname)
          ? url.pathname.slice(scopeUrl.pathname.length)
          : "";
        const fallbackPath = relativePath
          ? (relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath)
          : "index.html";
        return (await cache.match(request, { ignoreSearch: true }))
          || (await cache.match(new URL(fallbackPath, self.registration.scope).href, { ignoreSearch: true }))
          || (await cache.match(new URL("index.html", self.registration.scope).href))
          || (await cache.match(OFFLINE_PAGE))
          || Response.error();
      }
    })());
    return;
  }

  if (request.destination === "image") {
    event.respondWith((async () => {
      const cache = await caches.open("nexlab-images-v1");
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        return await saveImageResponse(request, await fetchWithTimeout(request, 5000));
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (["style", "script", "font", "worker"].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      const network = fetchWithTimeout(request, 5000).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      if (cached) {
        event.waitUntil(network.catch(() => {}));
        return cached;
      }
      try { return await network; } catch { return Response.error(); }
    })());
  }
});
