import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCommunityActivity } from "../frontend/api/communityProjectService.js";

test("community activity uses exact Firestore aggregates when available", () => {
  assert.deepEqual(summarizeCommunityActivity(
    [{ rating: 5 }],
    [{ id: "cached-question" }],
    { count: 8, rating: 4.25 },
    { count: 6 },
  ), {
    commentCount: 8,
    commentCountApproximate: false,
    questionCount: 6,
    questionCountApproximate: false,
    rating: 4.25,
    ratingApproximate: false,
  });
});

test("community activity shows an approximate rating and counts when aggregates are offline", () => {
  assert.deepEqual(summarizeCommunityActivity(
    [{ rating: 5 }, { rating: 3 }],
    [{ id: "one" }, { id: "two" }],
    null,
    null,
  ), {
    commentCount: 2,
    commentCountApproximate: true,
    questionCount: 2,
    questionCountApproximate: true,
    rating: 4,
    ratingApproximate: true,
  });
});
