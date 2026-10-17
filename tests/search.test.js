import assert from "node:assert/strict";
import test from "node:test";
import { matchesSearch, searchProducts } from "../frontend/js/search.js";
import { products as catalog } from "../frontend/js/products.js";

test("catalog search matches names, tags and descriptions without case sensitivity", () => {
  const products = [
    { id: "sensor", name: "Digital sensor", tags: ["DHT22"], description: "Humidity" },
    { id: "board", name: "ESP32 DevKit", tags: ["Wi-Fi"], description: "Controller" },
  ];

  assert.deepEqual(searchProducts(products, "dht22"), [products[0]]);
  assert.deepEqual(searchProducts(products, "WIFI"), [products[1]]);
  assert.deepEqual(searchProducts(products, "controller"), [products[1]]);
});

test("catalog search normalizes Unicode and returns all results for an empty query", () => {
  const products = [{ id: "board", name: "ＥＳＰ３２ DevKit", tags: [] }];

  assert.deepEqual(searchProducts(products, "esp32"), products);
  assert.equal(searchProducts(products, "  "), products);
});

test("catalog search also matches translated product names and descriptions", () => {
  assert.deepEqual(
    searchProducts(catalog, "temperature sensor", "en").map((product) => product.id),
    ["dht22"],
  );
  assert.deepEqual(
    searchProducts(catalog, "датчик вологості ґрунту").map((product) => product.id),
    ["soil-moisture"],
  );
});

test("project search can match the visitor language as well as the source copy", () => {
  assert.equal(
    matchesSearch("smart weather", [
      "Розумна метеостанція",
      "Вимірюй температуру й вологість у кімнаті та виводь показники на компактний екран.",
    ], "en"),
    true,
  );
});
