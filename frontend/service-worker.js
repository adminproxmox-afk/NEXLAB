const CACHE_NAME = "nexlab-shell-v19";
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

function offlineImageResponse() {
  return new Response(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320"><rect width="480" height="320" fill="#151c17"/><rect x="134" y="82" width="212" height="156" rx="16" fill="#20352c" stroke="#56bfa6" stroke-width="4"/><rect x="193" y="125" width="94" height="70" rx="9" fill="#111a15" stroke="#8be4d0" stroke-width="3"/><path d="M155 62v20m34-20v20m34-20v20m34-20v20m34-20v20m34-20v20M155 238v20m34-20v20m34-20v20m34-20v20m34-20v20m34-20v20" stroke="#8be4d0" stroke-width="5" stroke-linecap="round"/><text x="240" y="286" text-anchor="middle" fill="#b9d8ca" font-family="system-ui,sans-serif" font-size="16" letter-spacing="4">NEXLAB · OFFLINE</text></svg>',
    { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  const isStaticApiModule = request.destination === "script" && url.pathname.endsWith(".js");
  const isApiEndpoint = url.pathname.includes("/api/") && !isStaticApiModule;
  if (url.origin !== self.location.origin) return;
  if (request.headers.has("authorization")) return;

  if (isApiEndpoint) {
    event.respondWith((async () => {
      try {
        return await fetchWithTimeout(request);
      } catch {
        return new Response(JSON.stringify({ error: "BACKEND_UNAVAILABLE" }), {
          status: 503,
          headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        });
      }
    })());
    return;
  }
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) {
        const update = fetchWithTimeout(request, 8000).then(async (response) => {
          if (response.ok) await cache.put(request, response.clone());
          return response;
        });
        event.waitUntil(update.catch(() => {}));
        return cached;
      }
      try {
        const response = await fetchWithTimeout(request, 8000);
        if (response.ok) {
          await cache.put(request, response.clone());
        }
        return response;
      } catch {
        const scopeUrl = new URL(self.registration.scope);
        const relativePath = url.pathname.startsWith(scopeUrl.pathname)
          ? url.pathname.slice(scopeUrl.pathname.length)
          : "";
        const fallbackPath = relativePath
          ? (relativePath.endsWith("/") ? `${relativePath}index.html` : relativePath)
          : "index.html";
        return (await cache.match(request, { ignoreSearch: true }))
          || (await cache.match(new URL(fallbackPath, self.registration.scope).href, { ignoreSearch: true }))
          || Response.redirect(OFFLINE_PAGE, 302);
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
        const response = await fetchWithTimeout(request, 5000);
        return response.ok ? await saveImageResponse(request, response) : offlineImageResponse();
      } catch {
        return (await cache.match(request)) || offlineImageResponse();
      }
    })());
    return;
  }

  if (["style", "script", "font", "worker"].includes(request.destination) || url.pathname.endsWith(".ino")) {
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
