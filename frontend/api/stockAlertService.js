import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";
import { claimAvailableStockAlerts, selectAvailableStockAlerts } from "./stockAlertState.js";

export async function subscribeToRestock(productId) {
  if (!isFirebaseConfigured())
    return request("stock-alerts", { method: "POST", body: { productId } });
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const product = await firestoreSdk.getDoc(
    firestoreSdk.doc(db, "products", productId),
  );
  if (product.exists() && product.data().stock > 0) {
    const error = new Error("PRODUCT_ALREADY_AVAILABLE");
    error.stock = product.data().stock;
    throw error;
  }
  const ref = firestoreSdk.doc(db, "users", auth.currentUser.uid, "stockAlerts", productId);
  if ((await firestoreSdk.getDoc(ref)).exists()) await firestoreSdk.deleteDoc(ref);
  await firestoreSdk.setDoc(ref, { productId, createdAt: new Date().toISOString() });
  return { subscribed: true };
}

export async function consumeAvailableStockAlerts(products) {
  if (!isFirebaseConfigured())
    return (await request("stock-alerts/claim", { method: "POST", body: {} })).alerts;
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) return [];
  const snapshot = await firestoreSdk.getDocs(
    firestoreSdk.collection(db, "users", auth.currentUser.uid, "stockAlerts"),
  );
  const subscriptions = snapshot.docs.map((doc) => ({ ...doc.data(), ref: doc.ref }));
  const alerts = selectAvailableStockAlerts(subscriptions, products);
  const claimed = await claimAvailableStockAlerts(alerts, (alert) =>
    firestoreSdk.runTransaction(db, async (transaction) => {
      const current = await transaction.get(alert.ref);
      if (!current.exists()) return null;
      const data = current.data();
      const now = Date.now();
      if (data.notifiedAt || (data.claimId && Date.parse(data.claimExpiresAt) > now)) return null;
      const claimId = crypto.randomUUID();
      transaction.update(alert.ref, {
        claimId,
        claimExpiresAt: new Date(now + 2 * 60_000).toISOString(),
      });
      return claimId;
    }),
  );
  return claimed.flatMap(({ productId, name, claimId }) =>
    claimId ? [{ productId, name, claimId }] : [],
  );
}

export async function acknowledgeStockAlerts(alerts) {
  if (!alerts?.length) return;
  if (!isFirebaseConfigured()) {
    await request("stock-alerts/acknowledge", {
      method: "POST",
      body: { alerts: alerts.map(({ productId, claimId }) => ({ productId, claimId })) },
    });
    return;
  }
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  for (const alert of alerts) {
    const ref = firestoreSdk.doc(db, "users", uid, "stockAlerts", alert.productId);
    await firestoreSdk.runTransaction(db, async (transaction) => {
      const current = await transaction.get(ref);
      if (!current.exists() || current.data().claimId !== alert.claimId || current.data().notifiedAt) return;
      transaction.update(ref, {
        notifiedAt: new Date().toISOString(),
        claimId: firestoreSdk.deleteField(),
        claimExpiresAt: firestoreSdk.deleteField(),
      });
    });
  }
}
