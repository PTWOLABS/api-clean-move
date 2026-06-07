export function extractObjectKeyFromPublicUrl(
  publicBaseUrl: string,
  url: string,
): string | null {
  const base = publicBaseUrl.replace(/\/$/, "");
  const normalizedUrl = url.trim();

  if (!normalizedUrl.startsWith(`${base}/`)) {
    return null;
  }

  const key = normalizedUrl.slice(base.length + 1);

  return key.length > 0 ? key : null;
}
