import { afterEach, beforeEach, expect, it, vi } from "vitest";

const { deliver } = vi.hoisted(() => ({ deliver: vi.fn() }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: deliver };
  },
}));

import { sendEmail } from "../index";

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubEnv("RESEND_FROM_EMAIL", "hello@example.test");
  deliver.mockReset().mockResolvedValue({ data: { id: "mail-1" }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

it("sends an English magic link email with the exact verification URL", async () => {
  const result = await sendEmail({
    type: "magic-link",
    to: "visitor@example.test",
    data: {
      loginUrl: "https://app.example.test/api/auth/magic-link/verify?token=abc&callbackURL=%2F",
    },
  });
  expect(result.success).toBe(true);
  expect(deliver).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "visitor@example.test",
      subject: "Sign in to beztack",
      html: expect.stringContaining(
        'href="https://app.example.test/api/auth/magic-link/verify?token=abc&amp;callbackURL=%2F"',
      ),
    }),
  );
  const html = deliver.mock.calls[0][0].html;
  expect(html).toContain("15 minutes");
  expect(html).toContain("only be used once");
});
