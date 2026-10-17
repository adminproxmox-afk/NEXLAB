import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../frontend");
function htmlFiles(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? htmlFiles(path)
      : path.endsWith(".html")
        ? [path]
        : [];
  });
}

test("HTML pages do not link to missing local pages or assets", async () => {
  const broken = [];
  for (const source of htmlFiles()) {
    const html = await readFile(source, "utf8");
    for (const match of html.matchAll(/\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi)) {
      const value = match[2].trim();
      if (!value || /^(?:#|[a-z][a-z\d+.-]*:|\/\/)/i.test(value)) continue;
      const path = decodeURIComponent(value.split(/[?#]/, 1)[0]);
      if (!path) continue;
      const target = resolve(dirname(source), path);
      if (!target.startsWith(root + sep) && target !== root) {
        broken.push(`${source}: link escapes the frontend: ${value}`);
      } else if (!existsSync(target)) {
        broken.push(`${source}: missing ${value}`);
      }
    }
  }
  assert.deepEqual(broken, []);
});
