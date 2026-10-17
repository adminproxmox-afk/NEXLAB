import assert from "node:assert/strict";
import test from "node:test";
import { projects } from "../frontend/js/products.js";
import { getProjectSteps, projectGuides } from "../frontend/js/project-guides.js";
import { projectCover } from "../frontend/js/project-ui.js";

test("every curated DIY project exposes the same lesson steps as its guide", () => {
  for (const project of projects) {
    const steps = getProjectSteps(project);

    assert.ok(steps.length >= 4, `${project.id} should have trackable build steps`);
    if (projectGuides[project.id])
      assert.deepEqual(steps, projectGuides[project.id].steps, project.id);
  }
});

test("custom projects use their own steps or a shared beginner checklist", () => {
  const customSteps = ["Wire the board", "Upload the code"];

  assert.deepEqual(getProjectSteps({ id: "custom", steps: customSteps }), customSteps);
  assert.equal(getProjectSteps({ id: "custom" }).length, 4);
});

test("project covers have a real illustration fallback when component photos are missing", () => {
  const cover = projectCover(
    { id: "custom-kit", components: [{ productId: "sensor", quantity: 1 }] },
    [{ id: "sensor", name: "Sensor", image: "sensor", images: [] }],
  );

  assert.match(cover, /project-cover-placeholder/);
  assert.match(cover, /<svg/);
  assert.doesNotMatch(cover, /src=""/);
});
