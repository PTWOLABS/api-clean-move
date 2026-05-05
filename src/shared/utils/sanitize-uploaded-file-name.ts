/**
 * Produces a single path segment safe for S3 keys (no slashes, limited charset).
 */
export function sanitizeUploadedFileName(originalName: string): string {
  const segments = originalName.replace(/\\/g, "/").split("/");
  const base = segments[segments.length - 1]?.trim() || "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_");
  const limited = cleaned.slice(0, 200);

  return limited.length > 0 ? limited : "file";
}
