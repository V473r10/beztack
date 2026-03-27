import { describe, expect, it } from "vitest";
import {
  decodeExternalReference,
  encodeExternalReference,
} from "./external-reference.js";

const PRO_PLAN_AMOUNT = 6000;

describe("encodeExternalReference / decodeExternalReference", () => {
  it("should roundtrip basic fields", () => {
    const encoded = encodeExternalReference({
      customerId: "user_123",
      metadata: {
        userId: "user_123",
        organizationId: "org_456",
        tier: "pro",
      },
    });

    const decoded = decodeExternalReference(encoded);
    expect(decoded?.userId).toBe("user_123");
    expect(decoded?.organizationId).toBe("org_456");
    expect(decoded?.tier).toBe("pro");
  });

  it("should roundtrip proratedUpgrade fields", () => {
    const encoded = encodeExternalReference({
      customerId: "user_1",
      metadata: {
        userId: "user_1",
        proratedUpgrade: true,
        fullAmount: PRO_PLAN_AMOUNT,
        previousSubscriptionId: "sub_old",
        targetPlanId: "plan_pro",
      },
    });

    const decoded = decodeExternalReference(encoded);
    expect(decoded?.proratedUpgrade).toBe(true);
    expect(decoded?.fullAmount).toBe(PRO_PLAN_AMOUNT);
    expect(decoded?.previousSubscriptionId).toBe("sub_old");
    expect(decoded?.targetPlanId).toBe("plan_pro");
  });

  it("should roundtrip proratedDowngrade and previousTier fields", () => {
    const encoded = encodeExternalReference({
      customerId: "user_1",
      metadata: {
        userId: "user_1",
        tier: "basic",
        proratedDowngrade: true,
        previousTier: "pro",
        previousSubscriptionId: "sub_old",
        targetPlanId: "plan_basic",
      },
    });

    const decoded = decodeExternalReference(encoded);
    expect(decoded?.proratedDowngrade).toBe(true);
    expect(decoded?.previousTier).toBe("pro");
    expect(decoded?.tier).toBe("basic");
    expect(decoded?.previousSubscriptionId).toBe("sub_old");
    expect(decoded?.targetPlanId).toBe("plan_basic");
    expect(decoded?.proratedUpgrade).toBeUndefined();
  });

  it("should not set downgrade fields when not provided", () => {
    const encoded = encodeExternalReference({
      customerId: "user_1",
      metadata: {
        userId: "user_1",
        tier: "pro",
      },
    });

    const decoded = decodeExternalReference(encoded);
    expect(decoded?.proratedDowngrade).toBeUndefined();
    expect(decoded?.previousTier).toBeUndefined();
  });

  it("should return undefined for empty input", () => {
    expect(decodeExternalReference(undefined)).toBeUndefined();
    expect(decodeExternalReference("")).toBeUndefined();
  });

  it("should handle non-prefixed external reference as userId", () => {
    const decoded = decodeExternalReference("raw_user_id");
    expect(decoded?.userId).toBe("raw_user_id");
    expect(decoded?.referenceId).toBe("raw_user_id");
  });
});
