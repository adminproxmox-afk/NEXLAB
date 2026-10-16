import { request } from "./client.js";
import { isFirebaseConfigured } from "./firebaseAuth.js";
import { getFirebaseDocument } from "./firebaseStore.js";
import { getProducts } from "./productService.js";
import { getProjects } from "./projectService.js";

export async function getCoupon(code, subtotal, bundleDiscount = 0) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{2,23}$/.test(normalized))
    throw new Error("COUPON_INVALID");
  if (!isFirebaseConfigured())
    return (await request("coupons/validate", {
      method: "POST",
      body: { code: normalized, subtotal, bundleDiscount },
    })).coupon;
  const coupon = await getFirebaseDocument("coupons", normalized);
  if (!coupon || !coupon.active || (coupon.validUntil && Date.parse(coupon.validUntil) < Date.now())
    || (coupon.maxUses && coupon.usedCount >= coupon.maxUses)) throw new Error("COUPON_INVALID");
  if (subtotal < coupon.minTotal) throw new Error("COUPON_MINIMUM_NOT_MET");
  return { ...coupon, discount: Math.floor(Math.max(0, subtotal - bundleDiscount) * coupon.percent / 100) };
}

export async function getBundlePromotion(items) {
  if (!items?.length) return { discount: 0, promotions: [] };
  const [projects, products] = await Promise.all([getProjects(), getProducts()]);
  const remaining = new Map(items.map((item) => [item.id, item.quantity]));
  const prices = new Map(products.map((product) => [product.id, product.price]));
  const promotions = [];
  for (const project of projects
    .filter((item) => Number.isInteger(item.bundleDiscountPercent) && item.bundleDiscountPercent > 0)
    .sort((a, b) => b.bundleDiscountPercent - a.bundleDiscountPercent)) {
    while (project.components?.length && project.components.every((part) => (remaining.get(part.productId) || 0) >= part.quantity)) {
      let subtotal = 0;
      for (const part of project.components) {
        remaining.set(part.productId, remaining.get(part.productId) - part.quantity);
        subtotal += (prices.get(part.productId) || 0) * part.quantity;
      }
      promotions.push({
        projectId: project.id,
        name: project.name,
        percent: project.bundleDiscountPercent,
        discount: Math.floor(subtotal * project.bundleDiscountPercent / 100),
      });
    }
  }
  return { discount: promotions.reduce((sum, item) => sum + item.discount, 0), promotions };
}
