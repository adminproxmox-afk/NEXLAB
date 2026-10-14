import { products, categories } from "../js/products.js";
import { shopConfig } from "../js/shop-config.js";
import { request } from "./client.js";
import { isFirebaseConfigured } from "./firebaseAuth.js";
import {
  getFirebaseDocument,
  listFirebaseDocuments,
} from "./firebaseStore.js";
export { products, categories };
let pending;
let currentCategories = categories;
let storeSettings = shopConfig;
let firebaseCatalogWarning = "";
let firebaseSettingsWarning = "";
export function getFirebaseCatalogWarning() {
  return [firebaseSettingsWarning, firebaseCatalogWarning]
    .filter(Boolean)
    .join(" ");
}
export function setShopSettings(settings) {
  storeSettings = settings;
}
export async function loadShopSettings() {
  if (isFirebaseConfigured()) {
    try {
      storeSettings =
        (await getFirebaseDocument("settings", "store")) || shopConfig;
      firebaseSettingsWarning = "";
    } catch (error) {
      storeSettings = shopConfig;
      firebaseSettingsWarning = `Використовуються базові налаштування магазину: Firebase повернув ${error.code || "помилку доступу"}. Перевір, чи створено Firestore та опубліковано правила.`;
    }
    return storeSettings;
  }
  try {
    storeSettings = (await request("store")).settings;
  } catch (error) {
    if (error.message !== "BACKEND_UNAVAILABLE") throw error;
  }
  return storeSettings;
}
export async function refreshProducts() {
  if (!pending)
    pending = (isFirebaseConfigured()
    ? Promise.all([
        listFirebaseDocuments("products"),
        listFirebaseDocuments("reviews"),
      ]).then(([records, reviews]) => {
          const overrides = new Map(records.map((record) => [record.id, record]));
          const merged = products
            .map((product) => overrides.get(product.id) || product)
            .filter((product) => !product.deleted);
          const known = new Set(products.map((product) => product.id));
          for (const record of records)
            if (!known.has(record.id) && !record.deleted) merged.push(record);
          const ratings = new Map();
          for (const review of reviews) {
            const rating = ratings.get(review.productId) || {
              count: 0,
              total: 0,
            };
            rating.count += 1;
            rating.total += review.rating;
            ratings.set(review.productId, rating);
          }
          products.splice(
            0,
            products.length,
            ...merged.map((product) => {
              const rating = ratings.get(product.id);
              return rating
                ? {
                    ...product,
                    reviewsCount: rating.count,
                    rating: Math.round((rating.total / rating.count) * 10) / 10,
                  }
                : { ...product, reviewsCount: 0, rating: 0 };
            }),
          );
          currentCategories = categories;
          firebaseCatalogWarning = "";
          return products;
        })
      : request("products"))
      .then((result) => {
        if (isFirebaseConfigured()) return result;
        products.splice(0, products.length, ...result.products);
        currentCategories = result.categories || categories;
        storeSettings = result.settings || storeSettings;
        return products;
      })
      .catch((error) => {
        if (error.message === "BACKEND_UNAVAILABLE") return products;
        if (isFirebaseConfigured()) {
          currentCategories = categories;
          firebaseCatalogWarning = `Показуємо базовий каталог: Firebase повернув ${error.code || "помилку доступу"}. Перевір, чи створено Firestore та опубліковано правила.`;
          return products;
        }
        throw error;
      })
      .finally(() => (pending = null));
  return pending;
}
export async function getProducts() {
  return refreshProducts();
}
export async function getProductById(id) {
  return (await getProducts()).find((product) => product.id === id) || null;
}
export async function getCategories() {
  return currentCategories;
}
