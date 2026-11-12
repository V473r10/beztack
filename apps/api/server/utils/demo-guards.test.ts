import { describe, expect, it, vi } from "vitest";
import { guardEmailSender, isDemoBlockedPath } from "./demo-guards";

const EMAIL = {
  type: "welcome",
  to: "visitor@example.com",
  data: { username: "Visitor", loginUrl: "https://demo.example.test" },
} as const;

describe("guardEmailSender", () => {
  it("returns the real sender outside demo mode", () => {
    const send = vi.fn();

    expect(guardEmailSender(send, false)).toBe(send);
  });

  it("never calls the real sender in demo mode", async () => {
    const send = vi.fn();

    const guarded = guardEmailSender(send, true);
    await expect(guarded(EMAIL)).resolves.toMatchObject({ skipped: "demo-mode" });

    expect(send).not.toHaveBeenCalled();
  });
});

describe("isDemoBlockedPath", () => {
  it.each(["/api/email", "/api/email/welcome", "/api/email/password-reset"])(
    "blocks %s",
    (path) => {
      expect(isDemoBlockedPath(path)).toBe(true);
    },
  );

  it.each(["/api/emailing", "/api/auth/sign-up/email", "/api/subscriptions/checkout", "/"])(
    "allows %s",
    (path) => {
      expect(isDemoBlockedPath(path)).toBe(false);
    },
  );
});
