export function orderNotificationSignature(order) {
  const history = Array.isArray(order?.statusHistory) && order.statusHistory.length
    ? order.statusHistory
    : [{ status: order?.status || "processing", date: order?.date || "" }];
  const latest = history.at(-1);
  return JSON.stringify([
    latest?.status || order?.status || "processing",
    latest?.date || order?.date || "",
    latest?.note || "",
    order?.trackingNumber || "",
    ["accepted", "rejected"].includes(order?.returnRequest?.status)
      ? [order.returnRequest.status, order.returnRequest.reviewedAt || "", order.returnRequest.decisionNote || ""]
      : [],
  ]);
}

export function collectOrderNotificationUpdates(orders, previousState) {
  const previous = previousState?.orders && typeof previousState.orders === "object"
    ? previousState.orders
    : {};
  const initialized = previousState?.initialized === true;
  const current = {};
  const updates = [];
  for (const order of (orders || []).slice(0, 100)) {
    if (!order?.id) continue;
    const signature = orderNotificationSignature(order);
    current[order.id] = signature;
    if (initialized && previous[order.id] !== signature) {
      let oldParts = [];
      let newParts = [];
      try { oldParts = JSON.parse(previous[order.id] || "[]"); } catch {}
      try { newParts = JSON.parse(signature); } catch {}
      const orderChanged = JSON.stringify(oldParts.slice(0, 4)) !== JSON.stringify(newParts.slice(0, 4));
      const returnChanged = ["accepted", "rejected"].includes(newParts[4]?.[0])
        && JSON.stringify(oldParts[4]) !== JSON.stringify(newParts[4]);
      if (orderChanged || returnChanged) updates.push(order);
    }
  }
  return {
    updates,
    state: {
      initialized: true,
      orders: Object.fromEntries(Object.entries(current).slice(0, 100)),
    },
  };
}
