import assert from "node:assert/strict";
import test from "node:test";
import { buildCommunityOffers, collectCommunityQuestions, communityIdeas } from "../frontend/js/community-feed.js";

test("questions flatten with project context and sort newest first", () => {
  const result = collectCommunityQuestions([
    { id: "p1", title: "Plant monitor", questions: [
      { id: "q1", userName: "Ada", text: "How wire?", date: "2026-01-01", answer: "Use A0", answeredBy: "Sam", answeredAt: "2026-01-02" },
      { id: "shared", date: "2026-01-04" },
    ] },
    { id: "p2", name: "Lamp", questions: [{ id: "shared", date: "2026-01-03" }] },
  ]);
  assert.deepEqual(result.map(({ projectId, id }) => [projectId, id]), [["p1", "p1:shared"], ["p2", "p2:shared"], ["p1", "p1:q1"]]);
  assert.equal(result[2].projectTitle, "Plant monitor");
  assert.equal(result[2].userName, "Ada");
});

test("invalid and missing question dates sort last without throwing", () => {
  const result = collectCommunityQuestions([{ id: "p", title: "P", questions: [
    { id: "bad", date: "nope" }, { id: "new", date: "2026-01-01" }, { id: "missing" },
  ] }]);
  assert.deepEqual(result.map((question) => question.id), ["p:new", "p:bad", "p:missing"]);
});

test("curated ideas point to existing NEXLAB pages", () => {
  assert.ok(communityIdeas.length > 0);
  assert.ok(communityIdeas.every((idea) => idea.id && idea.title && idea.summary && Array.isArray(idea.components) && idea.difficulty && idea.href));
  assert.ok(communityIdeas.every(({ href }) => ["projects.html", "catalog.html", "project.html"].some((page) => href.startsWith(page))));
});

test("offers use discounted products, configured bundles, and supplied validated coupon", () => {
  const offers = buildCommunityOffers({
    products: [{ id: "sale", name: "Sale item", price: 80, oldPrice: 100 }, { id: "normal", name: "Normal", price: 50, oldPrice: null }],
    projects: [{ id: "kit", name: "Kit", bundleDiscountPercent: 12, components: [{ productId: "sale", quantity: 1 }] }],
    coupon: { code: "NEXLAB10", percent: 10, minTotal: 100 },
  });
  assert.deepEqual(offers.map(({ kind }) => kind), ["product", "kit", "coupon"]);
  assert.deepEqual(offers[0], { id: "product:sale", kind: "product", title: "Sale item", href: "product.html?id=sale", price: 80, oldPrice: 100 });
  assert.equal(offers[1].percent, 12);
  assert.equal(offers[1].projectId, "kit");
  assert.equal(offers[1].oldPrice, 80);
  assert.equal(offers[1].price, 71);
  assert.equal(offers[2].code, "NEXLAB10");
  assert.equal(offers[2].minTotal, 100);
});

test("offers omit coupon and discounts when unavailable", () => {
  assert.deepEqual(buildCommunityOffers({ products: [{ id: "plain", name: "Plain", price: 50, oldPrice: null }], projects: [{ id: "kit", name: "Kit", bundleDiscountPercent: 0 }] }), []);
});
