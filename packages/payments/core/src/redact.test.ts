import { describe, expect, it } from "vitest";
import { redactEmails } from "./redact.js";

describe("redactEmails", () => {
  it("replaces an address wherever it appears", () => {
    expect(redactEmails("Customer ana@example.com rejected; retry ana@example.com")).toBe(
      "Customer [email] rejected; retry [email]",
    );
  });

  it("replaces a percent-encoded address", () => {
    expect(redactEmails("GET /customers?email=ana%40example.com failed")).toBe(
      "GET /customers?email=[email] failed",
    );
  });

  it("leaves text without an address alone", () => {
    expect(redactEmails("connect ECONNREFUSED 10.0.0.1:443")).toBe(
      "connect ECONNREFUSED 10.0.0.1:443",
    );
  });

  it("caps the length so a huge provider body does not fill the log", () => {
    const redacted = redactEmails("x".repeat(1000));

    expect(redacted).toHaveLength(301);
    expect(redacted.endsWith("…")).toBe(true);
    expect(redactEmails("x".repeat(1000), 10)).toBe(`${"x".repeat(10)}…`);
  });
});
