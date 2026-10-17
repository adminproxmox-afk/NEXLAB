export function safeAuthDestination(target, currentHref) {
  const current = new URL(currentHref);
  const base = new URL(".", current);
  const fallback = new URL("profile.html", base).href;
  if (!target) return fallback;
  try {
    const destination = new URL(target, current);
    return destination.protocol === base.protocol
      && destination.origin === base.origin
      && destination.pathname.startsWith(base.pathname)
      && destination.pathname.endsWith(".html")
      ? destination.href
      : fallback;
  } catch {
    return fallback;
  }
}

export function requestedAuthDestination(search, currentHref) {
  const target = new URLSearchParams(search).get("redirect");
  return target ? safeAuthDestination(target, currentHref) : null;
}
