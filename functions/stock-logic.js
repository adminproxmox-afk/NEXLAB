export function stockAdjustment(currentStock, targetStock) {
  if (!Number.isInteger(currentStock) || currentStock < 0 || currentStock > 100000
    || !Number.isInteger(targetStock) || targetStock < 0 || targetStock > 100000)
    throw new Error("INVALID_STOCK");
  const quantityChange = targetStock - currentStock;
  return quantityChange === 0 ? null : { stock: targetStock, quantityChange };
}
