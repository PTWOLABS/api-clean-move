const LOGO_DOWNLOAD_TIMEOUT_IN_MS = 4_000;
const MAX_LOGO_SIZE_IN_BYTES = 5 * 1024 * 1024;
const SUPPORTED_LOGO_CONTENT_TYPES = new Set(["image/jpeg", "image/png"]);

export async function loadQuoteLogo(
  imageUrl: string | null,
): Promise<Buffer | null> {
  if (!imageUrl) return null;

  try {
    const url = new URL(imageUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    const response = await fetch(url, {
      signal: AbortSignal.timeout(LOGO_DOWNLOAD_TIMEOUT_IN_MS),
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type")?.split(";")[0];
    const contentLength = Number(response.headers.get("content-length"));

    if (
      !contentType ||
      !SUPPORTED_LOGO_CONTENT_TYPES.has(contentType.toLowerCase()) ||
      (Number.isFinite(contentLength) && contentLength > MAX_LOGO_SIZE_IN_BYTES)
    ) {
      return null;
    }

    const logo = await readBoundedBody(response);

    if (!logo || logo.length === 0) {
      return null;
    }

    return logo;
  } catch {
    return null;
  }
}

async function readBoundedBody(response: Response) {
  if (!response.body) return null;

  const reader =
    response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;
    if (!value) continue;

    size += value.byteLength;

    if (size > MAX_LOGO_SIZE_IN_BYTES) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk)),
    size,
  );
}
