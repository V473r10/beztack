import { isCurrentSubscription } from "@beztack/payments/subscription";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-06-15T00:00:00.000Z");
const LATER = new Date("2026-07-01T00:00:00.000Z");
const EARLIER = new Date("2026-06-01T00:00:00.000Z");

describe("isCurrentSubscription", () => {
  it("counts active and trialing Subscriptions", () => {
    expect(isCurrentSubscription({ status: "active" }, NOW)).toBe(true);
    expect(isCurrentSubscription({ status: "trialing" }, NOW)).toBe(true);
  });

  it("keeps a canceled Subscription only until its paid period ends", () => {
    expect(isCurrentSubscription({ status: "canceled", currentPeriodEnd: LATER }, NOW)).toBe(true);
    expect(
      isCurrentSubscription({ status: "canceled", currentPeriodEnd: LATER.toISOString() }, NOW),
    ).toBe(true);
    expect(isCurrentSubscription({ status: "canceled", currentPeriodEnd: EARLIER }, NOW)).toBe(
      false,
    );
    expect(isCurrentSubscription({ status: "canceled" }, NOW)).toBe(false);
  });

  it("does not count other statuses", () => {
    for (const status of ["past_due", "unpaid", "pending", "inactive", "paused", null]) {
      expect(isCurrentSubscription({ status, currentPeriodEnd: LATER }, NOW)).toBe(false);
    }
  });
});
