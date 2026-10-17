import { isFirebaseConfigured } from "./firebaseAuth.js";
let csrfToken = "";
let backendUnavailable = false;
let retryAt = 0;
let failures = 0;
const retryBaseMs = 1_000;
const retryMaxMs = 30_000;

function markBackendUnavailable() {
  const changed = !backendUnavailable;
  backendUnavailable = true;
  failures += 1;
  retryAt = Date.now() + Math.min(retryBaseMs * 2 ** (failures - 1), retryMaxMs);
  if (changed && typeof window !== "undefined" && typeof window.dispatchEvent === "function")
    window.dispatchEvent(new CustomEvent("nexlab:backend-connection", { detail: { available: false } }));
}

function markBackendAvailable() {
  const changed = backendUnavailable;
  backendUnavailable = false;
  failures = 0;
  retryAt = 0;
  if (changed && typeof window !== "undefined" && typeof window.dispatchEvent === "function")
    window.dispatchEvent(new CustomEvent("nexlab:backend-connection", { detail: { available: true } }));
}

function resetRetryOnOnline() {
  backendUnavailable = false;
  failures = 0;
  retryAt = 0;
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function")
  window.addEventListener("online", resetRetryOnOnline);
export function setCsrfToken(token) {
  csrfToken = token || "";
}
export const hasBackend = () => isFirebaseConfigured() || (
  (typeof navigator === "undefined" || navigator.onLine)
  && (!backendUnavailable || Date.now() >= retryAt)
);
export async function request(path, options = {}) {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    markBackendUnavailable();
    throw new Error("BACKEND_UNAVAILABLE");
  }
  if (backendUnavailable && Date.now() < retryAt)
    throw new Error("BACKEND_UNAVAILABLE");
  const { body, timeoutMs = 20_000, signal, ...rest } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      credentials: "same-origin",
      ...rest,
      signal: signal ? AbortSignal.any([signal, controller.signal]) : controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...options.headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    markBackendUnavailable();
    throw new Error("BACKEND_UNAVAILABLE");
  } finally {
    clearTimeout(timeout);
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    markBackendUnavailable();
    throw new Error("BACKEND_UNAVAILABLE");
  }
  markBackendAvailable();
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("INVALID_SERVER_RESPONSE");
  }
  if (!response.ok) {
    if (response.status === 404 && path === "session") {
      markBackendUnavailable();
      throw new Error("BACKEND_UNAVAILABLE");
    }
    const error = new Error(result.error || "REQUEST_FAILED");
    error.status = response.status;
    if (response.status >= 500 || result.error === "BACKEND_UNAVAILABLE") {
      markBackendUnavailable();
      if (result.error === "BACKEND_UNAVAILABLE") error.message = "BACKEND_UNAVAILABLE";
    }
    throw error;
  }
  return result;
}
