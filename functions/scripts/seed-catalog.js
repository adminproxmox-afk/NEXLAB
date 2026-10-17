import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { products, projects } from "../../frontend/js/products.js";
import { shopConfig } from "../../frontend/js/shop-config.js";

initializeApp({
  credential: applicationDefault(),
  projectId: process.env.GOOGLE_CLOUD_PROJECT || "nexlab-e2df4",
});
const db = getFirestore();
const batch = db.batch();
let created = 0;
const withoutUndefined = (value) => {
  if (Array.isArray(value)) return value.map(withoutUndefined);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined)
    .map(([key, child]) => [key, withoutUndefined(child)]));
};

for (const [collection, records] of [["products", products], ["projects", projects]]) {
  for (const record of records) {
    const { id, ...data } = record;
    const ref = db.doc(`${collection}/${id}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      batch.create(ref, withoutUndefined(data));
      created++;
      if (collection === "products" && record.stock > 0) {
        batch.create(db.collection("inventory_movements").doc(), {
          productId: id,
          quantityChange: record.stock,
          reason: "initial_stock",
          date: new Date().toISOString(),
        });
      }
    }
  }
}
const settingsRef = db.doc("settings/store");
if (!(await settingsRef.get()).exists) {
  batch.create(settingsRef, withoutUndefined(shopConfig));
  created++;
}
const couponRef = db.doc("coupons/NEXLAB10");
if (!(await couponRef.get()).exists) {
  batch.create(couponRef, {
    code: "NEXLAB10",
    percent: 10,
    minTotal: 1000,
    maxUses: null,
    usedCount: 0,
    validUntil: null,
    active: true,
  });
  created++;
}
if (created) await batch.commit();
console.log(`Catalog seed complete. New records: ${created}; existing records were kept.`);
