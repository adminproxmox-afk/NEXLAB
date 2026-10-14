import { isFirebaseConfigured } from "./firebaseAuth.js";
let csrfToken = "";
let backendUnavailable = false;
export function setCsrfToken(token) {
  csrfToken = token || "";
}
export const hasBackend = () => isFirebaseConfigured() || !backendUnavailable;
export async function request(path, options = {}) {
  if (backendUnavailable) throw new Error("BACKEND_UNAVAILABLE");
  const { body, ...rest } = options;
  let response;
  try {
    response = await fetch(`/api/${path}`, {
      credentials: "same-origin",
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...options.headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    backendUnavailable = true;
    throw new Error("BACKEND_UNAVAILABLE");
  }
  if (!response.headers.get("content-type")?.includes("application/json")) {
    backendUnavailable = true;
    throw new Error("BACKEND_UNAVAILABLE");
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("INVALID_SERVER_RESPONSE");
  }
  if (!response.ok) {
    if (response.status === 404 && path === "session") {
      backendUnavailable = true;
      throw new Error("BACKEND_UNAVAILABLE");
    }
    const error = new Error(result.error || "REQUEST_FAILED");
    error.status = response.status;
    throw error;
  }
  return result;
}
