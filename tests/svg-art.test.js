import assert from "node:assert/strict";
import test from "node:test";
import { productArt, resolveProductImage } from "../frontend/js/products.js";

test("legacy catalog image extensions resolve to optimized WebP assets", () => {
  assert.equal(
    resolveProductImage("assets/images/products/esp32-devkit.jpg"),
    "assets/images/products/esp32-devkit.webp",
  );
  assert.equal(
    resolveProductImage("https://example.com/custom-photo.jpg"),
    "https://example.com/custom-photo.jpg",
  );
});

test("large schematic product art uses SVG transform syntax", () => {
  const product = { id: "test-board", name: "Test board", image: "board", stock: 1, images: [] };
  const first = productArt(product, true, 0);
  const second = productArt(product, true, 1);

  assert.match(first, /transform="scale\(1\.13\) rotate\(0\)"/);
  assert.match(second, /transform="scale\(1\.07\) rotate\(3\)"/);
  assert.doesNotMatch(first, /rotate\([^)]*deg/);
});
