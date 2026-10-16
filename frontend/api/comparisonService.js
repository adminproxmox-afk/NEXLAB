const KEY = "nexlab_product_comparison";
const LIMIT = 4;

export function getComparisonIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(ids) ? [...new Set(ids.filter((id) => typeof id === "string"))].slice(0, LIMIT) : [];
  } catch {
    return [];
  }
}

export function toggleComparison(id) {
  const ids = getComparisonIds();
  if (ids.includes(id)) {
    localStorage.setItem(KEY, JSON.stringify(ids.filter((item) => item !== id)));
  } else {
    if (ids.length >= LIMIT) throw new Error("COMPARISON_LIMIT");
    localStorage.setItem(KEY, JSON.stringify([...ids, id]));
  }
  window.dispatchEvent(new Event("nexlab:comparison-updated"));
  return getComparisonIds();
}

export function clearComparison() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("nexlab:comparison-updated"));
}
