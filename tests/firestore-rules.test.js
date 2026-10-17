import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const rules = await readFile(new URL("../firebase/firestore.rules", import.meta.url), "utf8");

test("orders can only be created and have status changed by trusted server functions", () => {
  const block = rules.match(/match \/orders\/{orderId} \{([\s\S]*?)\n    \}/)?.[1] || "";
  const updateRule = block.match(/allow update: if ([\s\S]*?);/)?.[1] || "";
  assert.match(block, /allow create: if false;/);
  assert.match(block, /allow delete: if false;/);
  assert.doesNotMatch(updateRule, /hasPermission\('orders'\)/);
});

test("inventory movement history is append-only and written only by trusted server functions", () => {
  const block = rules.match(/match \/inventory_movements\/{movementId} \{([\s\S]*?)\n    \}/)?.[1] || "";
  assert.match(block, /allow create: if false;/);
  assert.match(block, /allow update, delete: if false;/);
});

test("catalog products use soft deletion so inventory and order history keep their references", () => {
  const block = rules.match(/match \/products\/{productId} \{([\s\S]*?)\n    \}/)?.[1] || "";
  assert.match(block, /allow create: if hasPermission\('catalog'\)[\s\S]*?request\.resource\.data\.stock == 0;/);
  assert.match(block, /request\.resource\.data\.stock == resource\.data\.stock;/);
  assert.match(block, /allow delete: if false;/);
});

test("restock claim updates stay within the signed-in user's notification fields", () => {
  const block = rules.match(/match \/users\/{userId}\/stockAlerts\/{productId} \{([\s\S]*?)\n    \}/)?.[1] || "";
  const updateRule = block.match(/allow update: if ([\s\S]*?);/)?.[1] || "";
  assert.match(updateRule, /request\.auth\.uid == userId/);
  assert.match(updateRule, /hasOnly\(\['notifiedAt', 'claimId', 'claimExpiresAt'\]\)/);
  assert.doesNotMatch(updateRule, /productId|createdAt/);
});

test("Firestore reviews allow only one immutable canonical review per user and product", () => {
  const block = rules.match(/match \/reviews\/{reviewId} \{([\s\S]*?)\n    \}/)?.[1] || "";
  const createRule = block.match(/allow create: if ([\s\S]*?);/)?.[1] || "";
  assert.match(createRule, /reviewId == request\.resource\.data\.productId \+ '__' \+ request\.auth\.uid/);
  assert.match(block, /allow update: if false;/);
  const communityBlock = rules.match(/match \/community_projects\/{projectId} \{([\s\S]*?)\n      match \/comments/)?.[1] || "";
  assert.match(communityBlock, /allow create: if signedIn\(\)[\s\S]*?request\.resource\.data\.userId == request\.auth\.uid/);
  assert.doesNotMatch(communityBlock, /reviewId|request\.resource\.data\.productId/);
});

test("reviews and community projects accept bounded WebP photo uploads", () => {
  const reviews = rules.match(/match \/reviews\/{reviewId} \{([\s\S]*?)\n    \}/)?.[1] || "";
  const community = rules.match(/match \/community_projects\/{projectId} \{([\s\S]*?)\n      match \/comments/)?.[1] || "";
  assert.match(reviews, /imageUrl\.size\(\) <= 320000/);
  assert.match(reviews, /data:image\/webp;base64/);
  assert.match(community, /photoUrl\.size\(\) <= 320000/);
  assert.match(community, /data:image\/webp;base64/);
});

test("community project ratings use one immutable comment document per user", () => {
  const block = rules.match(/match \/comments\/{commentId} \{([\s\S]*?)\n      \}/)?.[1] || "";
  const createRule = block.match(/allow create: if ([\s\S]*?);/)?.[1] || "";
  assert.match(createRule, /commentId == request\.auth\.uid/);
  assert.match(block, /allow update: if false;/);
});
