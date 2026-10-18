import assert from "node:assert/strict";
import test from "node:test";
import { ensureFirebaseProject } from "../frontend/api/userProjectsService.js";

function mockFirestore(record = null) {
  const state = { record, writes: 0 };
  return {
    state,
    sdk: {
      async runTransaction(_db, callback) {
        return callback({
          async get() {
            return { exists: () => state.record !== null };
          },
          set(_reference, value) {
            state.record = value;
            state.writes += 1;
          },
        });
      },
    },
  };
}

test("retrying a Firebase project save preserves its learning progress", async () => {
  const saved = {
    projectId: "weather-station",
    checklist: [true, false],
    stepChecklist: [true, true, false],
    updatedAt: "2026-10-01T12:00:00.000Z",
  };
  const { sdk, state } = mockFirestore(saved);

  await ensureFirebaseProject(sdk, {}, {}, saved.projectId);

  assert.deepEqual(state.record, saved);
  assert.equal(state.writes, 0);
});

test("a new Firebase project starts with valid empty checklists", async () => {
  const { sdk, state } = mockFirestore();

  await ensureFirebaseProject(sdk, {}, {}, "weather-station");

  const { updatedAt, ...record } = state.record;
  assert.deepEqual(record, {
    projectId: "weather-station",
    checklist: [],
    stepChecklist: [],
  });
  assert.equal(Number.isNaN(Date.parse(updatedAt)), false);
  assert.equal(state.writes, 1);
});
