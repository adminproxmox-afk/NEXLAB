import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogPhotoMap } from "../frontend/js/catalog-photo-map.js";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const sources = JSON.parse(
  await readFile(resolve(root, "scripts/catalog-photo-sources.json"), "utf8"),
);
const output = resolve(root, "frontend/assets/images/products");
await mkdir(output, { recursive: true });
const selectedIds = new Set(process.argv.slice(2));
const pending = selectedIds.size ? sources.filter(({ id }) => selectedIds.has(id)) : sources;
const downloaded = [];
const failures = [];
let next = 0;

async function worker() {
  while (next < pending.length) {
    const source = pending[next++];
    try {
      const response = await fetch(source.image, {
        headers: { "User-Agent": "NEXLAB college demo image fetcher/1.0" },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = (response.headers.get("content-type") || "").split(";")[0];
      const extensions = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
      };
      const extension = extensions[type];
      if (!extension) throw new Error(`Unsupported content type: ${type || "unknown"}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length < 2048 || bytes.length > 6_000_000)
        throw new Error(`Unexpected image size: ${bytes.length} bytes`);
      const file = `${source.id}${extension}`;
      await writeFile(resolve(output, file), bytes);
      downloaded.push({ ...source, path: `assets/images/products/${file}` });
    } catch (error) {
      failures.push({ id: source.id, reason: error.message, source: source.image });
    }
  }
}

await Promise.all(Array.from({ length: 5 }, worker));
const photoMap = { ...catalogPhotoMap };
downloaded.forEach(({ id, path }) => (photoMap[id] = path));
for (const source of sources) {
  if (photoMap[source.id]) continue;
  for (const extension of ["jpg", "png", "webp"]) {
    const path = `assets/images/products/${source.id}.${extension}`;
    try {
      await access(resolve(root, "frontend", path));
      photoMap[source.id] = path;
      break;
    } catch {}
  }
}
const mappedSources = sources
  .filter(({ id }) => photoMap[id])
  .sort((a, b) => a.id.localeCompare(b.id));
const sourceDocPath = resolve(root, "frontend/assets/images/SOURCES.md");
const previousDoc = await readFile(sourceDocPath, "utf8").catch(() => "");
const baseDoc = previousDoc.split("\n## Додатковий каталог")[0].trimEnd();
await writeFile(
  resolve(root, "frontend/js/catalog-photo-map.js"),
  `// Фотографії товарів для демонстраційного каталогу. Джерела наведені в assets/images/SOURCES.md.\nexport const catalogPhotoMap = ${JSON.stringify(photoMap, null, 2)};\n`,
);
const rows = mappedSources
  .map(({ id, title, page }) => `| \`${photoMap[id]}\` | \`${id}\` — ${title.replaceAll("|", "\\|")} | [Сторінка товару](${page}) |`)
  .join("\n");
await writeFile(
  sourceDocPath,
  `${baseDoc}\n\n## Додатковий каталог\n\nФотографії каталогу завантажені локально зі сторінок магазинів і виробників. Це зображення для ознайомлення: вони не підтверджують, що NEXLAB продає саме цю марку, ревізію чи комплектацію. Перед реальним продажем потрібно звірити фотографії та права на комерційне використання.\n\n| Локальний файл | Товар і підпис джерела | Сторінка джерела |\n| --- | --- | --- |\n${rows}\n`,
);
console.log(JSON.stringify({ downloaded: downloaded.length, mapped: mappedSources.length, failures }, null, 2));
