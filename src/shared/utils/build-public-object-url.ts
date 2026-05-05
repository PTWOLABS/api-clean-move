export function buildPublicObjectUrl(
  publicBaseUrl: string,
  objectKey: string,
): string {
  const base = publicBaseUrl.replace(/\/$/, "");
  const key = objectKey.startsWith("/") ? objectKey.slice(1) : objectKey;

  return `${base}/${key}`;
}
