import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "./app.js";

const port = Number(process.env.PORT || 8767);
const dataDir = resolve(process.env.DATA_DIR || "data");
mkdirSync(dataDir, { recursive: true });
const { server } = await createApp({
  dbPath: resolve(dataDir, "nexlab.sqlite"),
  publicOrigin: process.env.PUBLIC_ORIGIN,
  secureCookies: process.env.SECURE_COOKIES === "true",
  adminEmail: process.env.ADMIN_EMAIL,
  adminPassword: process.env.ADMIN_PASSWORD,
});
server.listen(port, process.env.HOST || "127.0.0.1", () =>
  console.log(`NEXLAB: http://127.0.0.1:${port}`),
);
