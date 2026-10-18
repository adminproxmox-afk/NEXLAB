import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { firebaseConfig } from "../frontend/js/firebase-config.js";

export async function checkFirebaseReadiness(projectId, fetcher = fetch) {
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
  const checks = [
    ["products", `${base}/products?pageSize=1`, (data) => data.documents?.length > 0],
    ["projects", `${base}/projects?pageSize=1`, (data) => data.documents?.length > 0],
    ["store settings", `${base}/settings/store`, (data) => Boolean(data.fields?.name?.stringValue?.trim())],
    ["demo coupon NEXLAB10", `${base}/coupons/NEXLAB10`, (data) => {
      const fields = data.fields || {};
      return fields.code?.stringValue === "NEXLAB10"
        && Number(fields.percent?.integerValue) === 10
        && Number(fields.minTotal?.integerValue) === 1000
        && fields.active?.booleanValue === true;
    }],
    ["createOrder function", `https://europe-west1-${encodeURIComponent(projectId)}.cloudfunctions.net/createOrder`, null, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: {} }),
    }],
  ];
  return Promise.all(checks.map(async ([name, url, hasData, options]) => {
    try {
      const response = await fetcher(url, options);
      if (name === "createOrder function" && response.status === 401)
        return { name, ready: true, detail: "deployed; authentication required" };
      if (name === "createOrder function" && response.status === 404)
        return { name, ready: false, detail: "not deployed" };
      if (response.status === 404 && ["store settings", "demo coupon NEXLAB10"].includes(name))
        return { name, ready: false, detail: "missing" };
      if (!response.ok)
        return { name, ready: false, detail: `HTTP ${response.status}` };
      const data = await response.json();
      const ready = hasData?.(data) || false;
      return {
        name,
        ready,
        detail: ready ? "ready" : name.startsWith("store settings") ? "incomplete" : "empty",
      };
    } catch (error) {
      return { name, ready: false, detail: error.message || "request failed" };
    }
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const checks = await checkFirebaseReadiness(firebaseConfig.projectId);
  console.log(`Firebase project: ${firebaseConfig.projectId}`);
  for (const check of checks)
    console.log(`${check.ready ? "OK" : "MISSING"} ${check.name}: ${check.detail}`);
  if (checks.some((check) => !check.ready)) {
    console.error("To finish Firebase setup, deploy Cloud Functions (requires the Blaze billing plan):");
    console.error(`  npx --yes firebase-tools@latest deploy --project ${firebaseConfig.projectId} --only functions`);
    console.error("Then seed the demo catalog and settings with Google Cloud CLI credentials:");
    console.error("  gcloud auth application-default login");
    console.error("  npm run seed --prefix functions");
    console.error("Finally run npm run check:firebase again.");
    process.exitCode = 1;
  }
}
