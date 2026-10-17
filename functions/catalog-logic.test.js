import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCatalogImport } from "./catalog-logic.js";
import { products } from "../frontend/js/products.js";

const product = (overrides = {}) => ({
  id: "sample-board",
  name: "Sample board",
  category: "Мікроконтролери",
  description: "A demo board.",
  brand: "Generic",
  subcategory: "Dev board",
  sku: "SAMPLE-1",
  image: "board",
  price: 500,
  oldPrice: null,
  stock: 4,
  tags: ["demo"],
  featured: false,
  isNew: false,
  specifications: { MCU: "ESP32" },
  images: ["assets/images/products/board.jpg"],
  ...overrides,
});

test("catalog import accepts and normalizes valid product records", () => {
  const [normalized] = normalizeCatalogImport([product({ name: "  Sample board  " })]);
  assert.equal(normalized.name, "Sample board");
  assert.equal(normalized.shortDescription, "A demo board");
  assert.equal(normalized.stock, 4);
});

test("catalog import accepts every product in the current store export", () => {
  assert.equal(normalizeCatalogImport(products).length, products.length);
});

test("catalog import rejects duplicate IDs, invalid fields, and batches over 200", () => {
  assert.throws(() => normalizeCatalogImport([product(), product()]), { message: "INVALID_CATALOG_PRODUCT" });
  assert.throws(() => normalizeCatalogImport([product({ stock: -1 })]), { message: "INVALID_CATALOG_PRODUCT" });
  assert.throws(() => normalizeCatalogImport([product({ category: "Unknown category" })]), { message: "INVALID_CATALOG_PRODUCT" });
  assert.throws(() => normalizeCatalogImport([product({ images: ["https://"] })]), { message: "INVALID_CATALOG_PRODUCT" });
  assert.throws(() => normalizeCatalogImport(Array.from({ length: 201 }, (_, index) => product({ id: `board-${index}` }))), { message: "INVALID_CATALOG_IMPORT" });
});
