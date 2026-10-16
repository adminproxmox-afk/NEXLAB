import test from "node:test";
import assert from "node:assert/strict";

const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, String(value)),
};
globalThis.location = { hostname: "localhost", search: "" };
const { firebaseConfigured } = await import("../frontend/js/firebase-config.js");

test("local development uses the local API unless Firebase is explicitly requested", () => {
  assert.equal(firebaseConfigured(), false);
  location.search = "?backend=firebase";
  assert.equal(firebaseConfigured(), true);
  assert.equal(localStorage.getItem("nexlab-backend-mode"), "firebase");
  location.search = "?backend=local";
  assert.equal(firebaseConfigured(), false);
});

test("hosted pages default to Firebase when the public config is present", () => {
  localStorage.setItem("nexlab-backend-mode", "");
  location.hostname = "adminproxmox-afk.github.io";
  location.search = "";
  assert.equal(firebaseConfigured(), true);
});
