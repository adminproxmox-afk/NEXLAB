export const ORDER_STATUSES = [
  "processing",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

export function normalizeOrderItems(input, productsById) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50)
    throw new Error("EMPTY_CART");
  const quantities = new Map();
  for (const item of input) {
    if (!item || typeof item.id !== "string" || !/^[a-zA-Z0-9_-]{1,120}$/.test(item.id)
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000)
      throw new Error("INVALID_ITEMS");
    const product = productsById.get(item.id);
    if (Number.isInteger(item.expectedPrice) && product && item.expectedPrice !== product.price)
      throw new Error("PRICE_CHANGED");
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }
  if (quantities.size > 50) throw new Error("INVALID_ITEMS");
  return [...quantities].map(([id, quantity]) => {
    const product = productsById.get(id);
    if (!product || product.deleted || !Number.isInteger(product.price) || product.price < 0)
      throw new Error("PRODUCT_NOT_FOUND");
    const stock = Number.isInteger(product.stock) ? product.stock : 0;
    if (stock < quantity) throw new Error("OUT_OF_STOCK");
    return {
      id,
      name: String(product.name || "Товар").slice(0, 200),
      quantity,
      price: product.price,
      oldPrice: Number.isInteger(product.oldPrice) && product.oldPrice > product.price
        ? product.oldPrice
        : null,
      stock,
    };
  });
}

export function calculateOrder(items, projects, coupon, couponCode, now = Date.now()) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const remaining = new Map(items.map((item) => [item.id, item.quantity]));
  const prices = new Map(items.map((item) => [item.id, item.price]));
  const bundlePromotions = [];
  for (const project of projects
    .filter((item) => !item.deleted && Number.isInteger(item.bundleDiscountPercent)
      && item.bundleDiscountPercent > 0 && item.bundleDiscountPercent <= 50
      && Array.isArray(item.components) && item.components.length > 0)
    .sort((a, b) => b.bundleDiscountPercent - a.bundleDiscountPercent)) {
    const components = new Map();
    let validComponents = true;
    for (const part of project.components) {
      if (!/^[a-zA-Z0-9_-]{1,120}$/.test(part?.productId || "")
        || !Number.isInteger(part.quantity) || part.quantity < 1 || part.quantity > 1000) {
        validComponents = false;
        break;
      }
      components.set(part.productId, (components.get(part.productId) || 0) + part.quantity);
    }
    if (!validComponents || !components.size) continue;
    while ([...components].every(([id, quantity]) => (remaining.get(id) || 0) >= quantity)) {
      let kitSubtotal = 0;
      for (const [id, quantity] of components) {
        remaining.set(id, remaining.get(id) - quantity);
        kitSubtotal += (prices.get(id) || 0) * quantity;
      }
      bundlePromotions.push({
        projectId: String(project.id || ""),
        name: String(project.name || "Комплект").slice(0, 160),
        percent: project.bundleDiscountPercent,
        discount: Math.floor(kitSubtotal * project.bundleDiscountPercent / 100),
      });
    }
  }
  const bundleDiscount = bundlePromotions.reduce((sum, item) => sum + item.discount, 0);
  let couponDiscount = 0;
  if (couponCode) {
    const expiry = coupon?.validUntil ? Date.parse(coupon.validUntil) : null;
    if (!coupon || !coupon.active || (expiry !== null && (!Number.isFinite(expiry) || expiry < now))
      || !Number.isInteger(coupon.minTotal) || coupon.minTotal < 0
      || !Number.isInteger(coupon.usedCount) || coupon.usedCount < 0
      || (coupon.maxUses !== null && coupon.maxUses !== undefined
        && (!Number.isInteger(coupon.maxUses) || coupon.maxUses < 0 || coupon.usedCount >= coupon.maxUses)))
      throw new Error("COUPON_INVALID");
    if (subtotal < coupon.minTotal) throw new Error("COUPON_MINIMUM_NOT_MET");
    if (!Number.isInteger(coupon.percent) || coupon.percent < 1 || coupon.percent > 80)
      throw new Error("COUPON_INVALID");
    couponDiscount = Math.floor(Math.max(0, subtotal - bundleDiscount) * coupon.percent / 100);
  }
  const saleDiscount = items.reduce((sum, item) =>
    sum + Math.max(0, (item.oldPrice || item.price) - item.price) * item.quantity, 0);
  return {
    subtotal,
    total: Math.max(0, subtotal - bundleDiscount - couponDiscount),
    discount: saleDiscount + bundleDiscount + couponDiscount,
    bundleDiscount,
    bundlePromotions,
    couponDiscount,
  };
}

export function normalizeDelivery(input, settings) {
  const delivery = input && typeof input === "object" ? input : {};
  const result = {
    name: String(delivery.name || "").trim().slice(0, 80),
    phone: String(delivery.phone || "").replace(/[\s()-]/g, ""),
    city: String(delivery.city || "").trim().slice(0, 100),
    address: String(delivery.address || "").trim().slice(0, 200),
    carrier: String(delivery.carrier || ""),
    payment: String(delivery.payment || ""),
  };
  if (!result.name || !result.city || !result.address || !/^\+?380\d{9}$/.test(result.phone))
    throw new Error("INVALID_DELIVERY");
  if (!settings?.deliveryMethods?.some((item) => item.id === result.carrier)
    || !settings?.paymentMethods?.some((item) => item.id === result.payment))
    throw new Error("INVALID_DELIVERY");
  return result;
}

export function validStatusChange(from, to, order) {
  const transitions = {
    processing: ["processing", "confirmed", "cancelled"],
    confirmed: ["confirmed", "shipped", "cancelled"],
    shipped: ["shipped", "delivered"],
    delivered: ["delivered", "returned"],
    cancelled: ["cancelled", "processing"],
    returned: ["returned"],
  };
  return ORDER_STATUSES.includes(to) && transitions[from]?.includes(to)
    && (to !== "returned" || order.returnRequest?.status === "accepted");
}

export function inventoryAction(order, nextStatus) {
  if (order.stockReservationManaged !== true) return null;
  if (nextStatus === "cancelled" && order.stockReserved === true) return "release";
  if (order.status === "cancelled" && nextStatus === "processing" && order.stockReserved === false)
    return "reserve";
  if (nextStatus === "returned" && order.stockReserved === true) return "return";
  return null;
}
