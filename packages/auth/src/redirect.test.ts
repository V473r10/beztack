import { describe, expect, it } from "vitest";
import { getSafeRedirectTarget } from "./redirect.js";

describe("getSafeRedirectTarget", () => {
  const fallback = "/";

  it("returns an in-app path", () => {
    expect(getSafeRedirectTarget("/billing", fallback)).toBe("/billing");
  });

  it("keeps the query string and hash of an in-app path", () => {
    expect(getSafeRedirectTarget("/billing?plan=pro#top", fallback)).toBe("/billing?plan=pro#top");
  });

  it("falls back when next is missing or empty", () => {
    expect(getSafeRedirectTarget(null, fallback)).toBe(fallback);
    expect(getSafeRedirectTarget(undefined, fallback)).toBe(fallback);
    expect(getSafeRedirectTarget("", fallback)).toBe(fallback);
  });

  it("rejects an external absolute URL", () => {
    expect(getSafeRedirectTarget("https://evil.example/steal", fallback)).toBe(fallback);
    expect(getSafeRedirectTarget("javascript:alert(1)", fallback)).toBe(fallback);
  });

  it("rejects a protocol-relative URL", () => {
    expect(getSafeRedirectTarget("//evil.example/path", fallback)).toBe(fallback);
  });

  it("rejects a backslash that browsers read as a protocol-relative URL", () => {
    expect(getSafeRedirectTarget("/\\evil.example", fallback)).toBe(fallback);
    expect(getSafeRedirectTarget("\\\\evil.example", fallback)).toBe(fallback);
  });

  it("rejects control characters browsers strip before resolving", () => {
    expect(getSafeRedirectTarget("/\t/evil.example", fallback)).toBe(fallback);
    expect(getSafeRedirectTarget("/\n/evil.example", fallback)).toBe(fallback);
  });

  it("rejects a target back into the auth pages", () => {
    expect(getSafeRedirectTarget("/auth/sign-in", fallback)).toBe(fallback);
    expect(getSafeRedirectTarget("/auth", fallback)).toBe(fallback);
  });

  it("does not mistake a path that only starts with /auth for the auth pages", () => {
    expect(getSafeRedirectTarget("/authors", fallback)).toBe("/authors");
  });
});
