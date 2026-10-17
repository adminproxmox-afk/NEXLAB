import test from "node:test";
import assert from "node:assert/strict";
import { requestedAuthDestination, safeAuthDestination } from "../frontend/js/auth-redirect.js";

const loginUrl = "https://shop.example/NEXLAB/login.html?redirect=checkout.html";

test("auth redirects preserve same-site path, query and hash", () => {
  assert.equal(
    requestedAuthDestination("?redirect=checkout.html%3Fcoupon%3DSTART%23summary", loginUrl),
    "https://shop.example/NEXLAB/checkout.html?coupon=START#summary",
  );
});

test("auth redirects reject external and out-of-site destinations", () => {
  for (const target of [
    "https://attacker.example/checkout.html",
    "../../outside/checkout.html",
    "javascript:alert(1)",
  ]) {
    assert.equal(
      safeAuthDestination(target, loginUrl),
      "https://shop.example/NEXLAB/profile.html",
    );
  }
});

test("auth pages use the profile when there is no requested redirect", () => {
  assert.equal(requestedAuthDestination("", loginUrl), null);
  assert.equal(safeAuthDestination("", loginUrl), "https://shop.example/NEXLAB/profile.html");
});
