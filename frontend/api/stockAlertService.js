import { request } from "./client.js";
import { isFirebaseConfigured, getFirebaseServices } from "./firebaseAuth.js";

export async function subscribeToRestock(productId) {
  if (!isFirebaseConfigured())
    return request("stock-alerts", { method: "POST", body: { productId } });
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) throw new Error("UNAUTHENTICATED");
  const ref = firestoreSdk.doc(db, "users", auth.currentUser.uid, "stockAlerts", productId);
  if ((await firestoreSdk.getDoc(ref)).exists()) await firestoreSdk.deleteDoc(ref);
  await firestoreSdk.setDoc(ref, { productId, createdAt: new Date().toISOString() });
  return { subscribed: true };
}

export async function consumeAvailableStockAlerts(products) {
  if (!isFirebaseConfigured()) return (await request("stock-alerts")).alerts;
  const { auth, db, firestoreSdk } = await getFirebaseServices();
  if (!auth.currentUser) return [];
  const snapshot = await firestoreSdk.getDocs(
    firestoreSdk.collection(db, "users", auth.currentUser.uid, "stockAlerts"),
  );
  const alerts = [];
  for (const doc of snapshot.docs) {
    const subscription = doc.data();
    const product = products.find((item) => item.id === subscription.productId);
    if (product?.stock > 0 && !subscription.notifiedAt) {
      await firestoreSdk.updateDoc(doc.ref, { notifiedAt: new Date().toISOString() });
      alerts.push({ productId: product.id, name: product.name });
    }
  }
  return alerts;
}
