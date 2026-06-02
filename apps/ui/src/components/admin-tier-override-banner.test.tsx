import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  activeOrganization: { id: "org_1", name: "Acme Inc." },
  clearAdminTierOverride: vi.fn(),
  isAppAdmin: true,
  membership: {
    adminTierOverride: {
      billingCadence: "monthly",
      realSubscriptionsUnchanged: true,
      target: {
        id: "org_1",
        type: "organization",
      },
      tier: "pro",
    },
    isAppAdmin: true,
    isClearingAdminTierOverride: false,
  } as {
    adminTierOverride: null | {
      billingCadence: "monthly" | "yearly" | null;
      realSubscriptionsUnchanged: boolean;
      target: {
        id: string;
        type: "user" | "organization";
      };
      tier: "free" | "basic" | "pro" | "ultimate";
    };
    isAppAdmin: boolean;
    isClearingAdminTierOverride: boolean;
  },
}));

vi.mock("@/contexts/membership-context", () => ({
  useMembership: () => ({
    ...mocks.membership,
    clearAdminTierOverride: mocks.clearAdminTierOverride,
  }),
}));

vi.mock("@/hooks/use-organizations", () => ({
  useActiveOrganization: () => ({ data: mocks.activeOrganization }),
}));

import { AdminTierOverrideBanner } from "./admin-tier-override-banner";

describe("AdminTierOverrideBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeOrganization = { id: "org_1", name: "Acme Inc." };
    mocks.isAppAdmin = true;
    mocks.membership = {
      adminTierOverride: {
        billingCadence: "monthly",
        realSubscriptionsUnchanged: true,
        target: {
          id: "org_1",
          type: "organization",
        },
        tier: "pro",
      },
      isAppAdmin: true,
      isClearingAdminTierOverride: false,
    };
  });

  it("shows tier, cadence, target, boundary copy, and clear action", () => {
    const html = renderToStaticMarkup(<AdminTierOverrideBanner />);

    expect(html).toContain("Admin tier override active:");
    expect(html).toContain("Pro monthly for Acme Inc.");
    expect(html).toContain("Real subscriptions are unchanged.");
    expect(html).toContain("Clear override");
  });

  it("stays hidden when the server reports the caller is not an App admin", () => {
    mocks.membership = {
      adminTierOverride: {
        billingCadence: "monthly",
        realSubscriptionsUnchanged: true,
        target: {
          id: "org_1",
          type: "organization",
        },
        tier: "pro",
      },
      isAppAdmin: false,
      isClearingAdminTierOverride: false,
    };

    const html = renderToStaticMarkup(<AdminTierOverrideBanner />);

    expect(html).toBe("");
  });

  it("stays hidden without active override details", () => {
    mocks.membership = {
      adminTierOverride: null,
      isAppAdmin: true,
      isClearingAdminTierOverride: false,
    };

    const html = renderToStaticMarkup(<AdminTierOverrideBanner />);

    expect(html).toBe("");
  });
});
