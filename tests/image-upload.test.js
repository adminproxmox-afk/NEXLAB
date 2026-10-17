import assert from "node:assert/strict";
import test from "node:test";
import { MAX_IMAGE_DATA_URL_LENGTH, prepareCommunityImage } from "../frontend/api/imageUpload.js";

test("community photos are resized to a bounded WebP data URL", async () => {
  const previous = {
    createImageBitmap: globalThis.createImageBitmap,
    document: globalThis.document,
  };
  globalThis.createImageBitmap = async () => ({ width: 2800, height: 1400, close() {} });
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({ drawImage() {} }),
      toBlob: (callback, type) => callback(new Blob(["small webp image"], { type })),
    }),
  };
  try {
    const result = await prepareCommunityImage(new Blob(["source"], { type: "image/jpeg" }));
    assert.match(result, /^data:image\/webp;base64,/);
    assert.ok(result.length <= MAX_IMAGE_DATA_URL_LENGTH);
  } finally {
    if (previous.createImageBitmap === undefined) delete globalThis.createImageBitmap;
    else globalThis.createImageBitmap = previous.createImageBitmap;
    if (previous.document === undefined) delete globalThis.document;
    else globalThis.document = previous.document;
  }
});

test("community photo upload rejects unsupported and oversized source files", async () => {
  await assert.rejects(
    prepareCommunityImage(new Blob(["not an image"], { type: "image/svg+xml" })),
    { message: "INVALID_IMAGE_TYPE" },
  );
  await assert.rejects(
    prepareCommunityImage(new Blob([new Uint8Array(13 * 1024 * 1024)], { type: "image/jpeg" })),
    { message: "IMAGE_TOO_LARGE" },
  );
});
