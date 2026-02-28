import { basename, extname } from "node:path";

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".conf",
  ".css",
  ".cts",
  ".env",
  ".gitignore",
  ".html",
  ".ini",
  ".js",
  ".json",
  ".jsonc",
  ".jsx",
  ".md",
  ".mdx",
  ".mjs",
  ".mts",
  ".scss",
  ".sh",
  ".sql",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".xml",
  ".yaml",
  ".yml",
]);

const BINARY_EXTENSIONS = new Set([
  ".avif",
  ".bmp",
  ".cur",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const TEXT_FILE_NAMES = new Set([
  ".dockerignore",
  ".editorconfig",
  ".env",
  ".env.example",
  ".gitattributes",
  ".gitignore",
  ".npmrc",
  "Dockerfile",
  "LICENSE",
  "Makefile",
  "README",
]);

const TEXT_ANALYSIS_SAMPLE_BYTES = 8_000;

type ContentClassification = "text" | "binary" | "unknown";

/**
 * Classifies file content with a path-first strategy and byte-level fallback.
 * Unknown file types default to binary to avoid accidental corruption.
 */
export function isBinaryFileContent(
  relativePath: string,
  buffer: Buffer
): boolean {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const filename = basename(normalizedPath);
  const extension = extname(filename).toLowerCase();

  if (TEXT_FILE_NAMES.has(filename) || TEXT_FILE_NAMES.has(normalizedPath)) {
    return false;
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    return false;
  }

  if (BINARY_EXTENSIONS.has(extension)) {
    return true;
  }

  const fallback = classifyByBytes(buffer);
  if (fallback === "text") {
    return false;
  }
  if (fallback === "binary") {
    return true;
  }

  return true;
}

function classifyByBytes(buffer: Buffer): ContentClassification {
  if (buffer.length === 0) {
    return "text";
  }

  const sampleLength = Math.min(buffer.length, TEXT_ANALYSIS_SAMPLE_BYTES);
  let suspiciousBytes = 0;

  for (let index = 0; index < sampleLength; index += 1) {
    const byte = buffer[index];

    if (byte === 0) {
      return "binary";
    }

    const isAllowedControl =
      byte === 9 || byte === 10 || byte === 13 || byte === 12;
    const isControlCharacter =
      (byte >= 0 && byte <= 8) ||
      (byte >= 11 && byte <= 12) ||
      (byte >= 14 && byte <= 31) ||
      byte === 127;

    if (isControlCharacter && !isAllowedControl) {
      suspiciousBytes += 1;
    }
  }

  const suspiciousRatio = suspiciousBytes / sampleLength;
  if (suspiciousRatio > 0.1) {
    return "binary";
  }
  if (suspiciousRatio < 0.02) {
    return "text";
  }

  return "unknown";
}
