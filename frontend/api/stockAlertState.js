export function selectAvailableStockAlerts(subscriptions, products) {
  const byId = new Map((products || []).map((product) => [product.id, product]));
  return (subscriptions || []).flatMap((subscription) => {
    const product = byId.get(subscription.productId);
    return product?.stock > 0 && !subscription.notifiedAt
      ? [{ productId: product.id, name: product.name, ref: subscription.ref }]
      : [];
  });
}

export async function claimAvailableStockAlerts(alerts, claim) {
  const claimed = [];
  for (const alert of alerts || []) {
    const claimId = await claim(alert);
    if (claimId) claimed.push({ ...alert, claimId: typeof claimId === "string" ? claimId : "" });
  }
  return claimed;
}
