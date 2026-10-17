export function allocateNetItemRevenue(order) {
  const items = (Array.isArray(order?.items) ? order.items : []).filter(
    (item) => item?.id && Number.isFinite(item.price) && Number.isInteger(item.quantity) && item.quantity > 0,
  );
  const grossTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const netTotal = Math.min(
    grossTotal,
    Math.max(0, Number.isFinite(order?.total) ? Math.round(order.total) : grossTotal),
  );
  let allocated = 0;
  return items.map((item, index) => {
    const revenue = index === items.length - 1
      ? netTotal - allocated
      : grossTotal > 0
        ? Math.floor(netTotal * item.price * item.quantity / grossTotal)
        : 0;
    allocated += revenue;
    return { ...item, revenue };
  });
}
