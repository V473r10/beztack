import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  env: { VITE_SUBSCRIPTION_MODE: "organization" as "organization" | "user" },
  organization: { data: undefined as unknown, isLoading: false },
  members: { data: [] as unknown[], isLoading: false },
  pendingPlanChange: { data: null as unknown },
  membership: {} as Record<string, unknown>,
}));

vi.mock("@/env", () => ({ env: mocks.env }));
vi.mock("@/hooks/use-organizations", () => ({
  useActiveOrganization: () => mocks.organization,
  useOrganizationMembers: () => mocks.members,
}));
vi.mock("@/hooks/use-pending-plan-change", () => ({
  usePendingPlanChange: () => mocks.pendingPlanChange,
}));
vi.mock("@/contexts/membership-context", () => ({
  useMembership: () => mocks.membership,
}));
vi.mock("@/components/organizations/create-organization-dialog", () => ({
  CreateOrganizationDialog: () => null,
}));
vi.mock("@/components/tour", () => ({
  TourAlertDialog: () => null,
  useTour: () => ({ setSteps: vi.fn(), isTourCompleted: true }),
}));
vi.mock("@/lib/format", () => ({
  formatDate: () => "November 1, 2026",
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
}));
// Keys and interpolation values are what the page decides; translations are data.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}(${Object.values(values).join(",")})` : key,
  }),
}));

import Home from "./home";

const ORGANIZATION = { id: "org_1", name: "Acme" };

const MEMBERS = [
  {
    id: "m1",
    userId: "u1",
    role: "owner",
    user: { id: "u1", name: "Ada Lovelace", email: "ada@example.com" },
  },
  {
    id: "m2",
    userId: "u2",
    role: "member",
    user: { id: "u2", name: "Grace Hopper", email: "grace@example.com" },
  },
];

const PRO_MEMBERSHIP = {
  isLoading: false,
  isAccessLoading: false,
  currentTier: "pro",
  tierConfig: {
    id: "pro",
    name: "Pro",
    currency: "USD",
    price: { monthly: 2900, yearly: 29_000 },
    limits: { users: 5 },
  },
  activeSubscription: {
    id: "sub_1",
    status: "active",
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    cancelAtPeriodEnd: false,
  },
  billingCadence: "monthly",
  canManageBilling: true,
  organizationRole: "owner",
  adminTierOverride: null,
};

const DOWNGRADE = {
  id: "ppc_1",
  direction: "downgrade",
  effectiveAt: "2026-12-01T00:00:00.000Z",
  subscriptionId: "sub_1",
  targetPlan: {
    id: "plan_basic_month",
    tierId: "basic",
    billingCadence: "monthly",
    price: { amount: 900, currency: "USD" },
  },
} as const;

function renderHome(): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
}

describe("Home", () => {
  beforeEach(() => {
    mocks.env.VITE_SUBSCRIPTION_MODE = "organization";
    mocks.organization = { data: ORGANIZATION, isLoading: false };
    mocks.members = { data: MEMBERS, isLoading: false };
    mocks.pendingPlanChange = { data: null };
    mocks.membership = { ...PRO_MEMBERSHIP };
  });

  describe("with a plan", () => {
    it("shows the current plan, its status, its price and when it renews", () => {
      const html = renderHome();

      expect(html).toContain("Pro");
      expect(html).toContain("home.plan.status.active");
      expect(html).toContain("home.plan.price(USD 2900,billing.monthly)");
      expect(html).toContain("home.plan.renews(November 1, 2026)");
    });

    it("shows seats used against the plan limit", () => {
      const html = renderHome();

      expect(html).toContain("home.seats.usedOfLimit(2,5)");
    });

    it("lists the members with their name and role", () => {
      const html = renderHome();

      expect(html).toContain("Ada Lovelace");
      expect(html).toContain("ada@example.com");
      expect(html).toContain("Grace Hopper");
      expect(html).toContain("invitation.roles.owner");
      expect(html).toContain("invitation.roles.member");
    });

    it("says seats are unlimited when the plan has no user limit", () => {
      mocks.membership = {
        ...PRO_MEMBERSHIP,
        tierConfig: { ...PRO_MEMBERSHIP.tierConfig, limits: { users: -1 } },
      };

      const html = renderHome();

      expect(html).toContain("home.seats.usedUnlimited(2)");
      expect(html).not.toContain("home.seats.usedOfLimit");
    });

    it("warns when the members exceed the plan limit", () => {
      mocks.membership = {
        ...PRO_MEMBERSHIP,
        tierConfig: { ...PRO_MEMBERSHIP.tierConfig, limits: { users: 1 } },
      };

      const html = renderHome();

      expect(html).toContain("home.seats.overLimit");
    });

    it("suggests inviting teammates and changing plan, not paying", () => {
      const html = renderHome();

      expect(html).toContain("home.nextSteps.invite");
      expect(html).toContain('href="/organizations"');
      expect(html).toContain("home.nextSteps.changePlan");
      expect(html).toContain('href="/pricing"');
      expect(html).not.toContain("home.nextSteps.pay");
    });

    it("shows no usage metrics, charts or sample data", () => {
      const html = renderHome();

      expect(html).not.toContain("Total Revenue");
      expect(html).not.toContain("dashboard.");
      expect(html).not.toContain("dataTable.");
    });
  });

  describe("on the free plan", () => {
    beforeEach(() => {
      mocks.membership = {
        ...PRO_MEMBERSHIP,
        currentTier: "free",
        tierConfig: { id: "free", name: "Free", price: { monthly: 0, yearly: 0 }, limits: {} },
        activeSubscription: null,
        billingCadence: null,
      };
    });

    it("shows the free status and no price", () => {
      const html = renderHome();

      expect(html).toContain("home.plan.status.free");
      expect(html).not.toContain("home.plan.price");
      expect(html).not.toContain("home.plan.renews");
    });

    it("suggests paying for a plan", () => {
      const html = renderHome();

      expect(html).toContain("home.nextSteps.pay");
      expect(html).not.toContain("home.nextSteps.changePlan");
    });
  });

  describe("with a Pending Plan change", () => {
    it("shows the destination and the date it applies", () => {
      mocks.pendingPlanChange = { data: DOWNGRADE };

      const html = renderHome();

      expect(html).toContain("home.pendingPlanChange.title");
      expect(html).toContain(
        "billing.pendingPlanChange.downgradeOn(Basic,billing.monthly,USD 900,November 1, 2026)",
      );
    });

    it("shows nothing about it when there is none", () => {
      const html = renderHome();

      expect(html).not.toContain("home.pendingPlanChange.title");
    });
  });

  describe("without an organization", () => {
    beforeEach(() => {
      mocks.organization = { data: null, isLoading: false };
      mocks.members = { data: [], isLoading: false };
    });

    it("explains how to create one instead of showing an empty dashboard", () => {
      const html = renderHome();

      expect(html).toContain("home.noOrganization.title");
      expect(html).toContain("home.noOrganization.description");
      expect(html).toContain("home.noOrganization.create");
      expect(html).not.toContain("home.seats");
      expect(html).not.toContain("home.plan.status");
    });

    it("still shows the plan when subscriptions belong to the user", () => {
      mocks.env.VITE_SUBSCRIPTION_MODE = "user";

      const html = renderHome();

      expect(html).not.toContain("home.noOrganization.title");
      expect(html).toContain("home.plan.status.active");
      expect(html).not.toContain("home.seats");
    });
  });

  it("shows a placeholder while the organization loads", () => {
    mocks.organization = { data: undefined, isLoading: true };

    const html = renderHome();

    expect(html).not.toContain("home.noOrganization.title");
    expect(html).toContain('data-slot="skeleton"');
  });
});
