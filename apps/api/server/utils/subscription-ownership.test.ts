import type { Subscription } from "@beztack/payments";
import { describe, expect, it } from "vitest";
import type { AuthenticatedUser } from "./membership";
import { isSubscriptionOwnedByUser } from "./subscription-ownership";

function auth(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: "user_1",
    name: "User",
    email: "billing@example.com",
    emailVerified: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    session: {
      id: "session_1",
      userId: "user_1",
      token: "token",
      activeOrganizationId: "org_1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      expiresAt: new Date("2026-01-02T00:00:00.000Z"),
    },
    user: {
      id: "user_1",
      name: "User",
      email: "billing@example.com",
      emailVerified: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    ...overrides,
  };
}

function subscription(metadata?: Record<string, unknown>): Subscription {
  return {
    id: "sub_1",
    status: "active",
    productId: "plan_1",
    customerId: "mercado-pago-payer-id",
    customerEmail: "billing@example.com",
    metadata,
  };
}

describe("isSubscriptionOwnedByUser", () => {
  it("does not treat payer email as organization ownership", () => {
    expect(
      isSubscriptionOwnedByUser(subscription(), auth(), "organization")
    ).toBe(false);
  });

  it("accepts organization identity evidence in organization mode", () => {
    expect(
      isSubscriptionOwnedByUser(
        subscription({ organizationId: "org_1" }),
        auth(),
        "organization"
      )
    ).toBe(true);
  });

  it("keeps payer email ownership available in user mode", () => {
    expect(isSubscriptionOwnedByUser(subscription(), auth(), "user")).toBe(
      true
    );
  });
});
