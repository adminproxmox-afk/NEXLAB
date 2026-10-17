export const MAX_IMAGE_DATA_URL_LENGTH = 320_000;

export async function prepareCommunityImage(file) {
  if (!(file instanceof Blob) || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("INVALID_IMAGE_TYPE");
  if (file.size > 12 * 1024 * 1024) throw new Error("IMAGE_TOO_LARGE");

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("INVALID_IMAGE_FILE");
  }
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let blob;
    for (const quality of [0.82, 0.68, 0.54, 0.4]) {
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) throw new Error("IMAGE_CONVERSION_FAILED");
      if (blob.type !== "image/webp") throw new Error("IMAGE_CONVERSION_FAILED");
      if (blob.size <= 220_000) break;
    }
    if (!blob || blob.size > 220_000) throw new Error("IMAGE_TOO_LARGE");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    const dataUrl = `data:image/webp;base64,${btoa(binary)}`;
    if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) throw new Error("IMAGE_TOO_LARGE");
    return dataUrl;
  } finally {
    bitmap.close();
  }
}
