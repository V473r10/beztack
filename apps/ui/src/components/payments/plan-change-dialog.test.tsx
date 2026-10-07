import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanChangePreview } from "@/hooks/use-plan-change-preview";

const mocks = vi.hoisted(() => ({
  preview: {
    data: undefined as unknown,
    isLoading: false,
    error: null as Error | null,
  },
  previewInput: undefined as unknown,
  // Catalog prices that would give a different answer if the dialog did the math.
  tiers: [
    { id: "basic", price: { monthly: 2900, yearly: 0 }, yearlySavingsPercent: 0 },
    { id: "pro", price: { monthly: 6000, yearly: 0 }, yearlySavingsPercent: 0 },
  ],
}));

vi.mock("@/env", () => ({ env: { VITE_SUBSCRIPTION_MODE: "organization" } }));
vi.mock("@/hooks/use-plan-change-preview", () => ({
  usePlanChangePreview: (input: unknown) => {
    mocks.previewInput = input;
    return mocks.preview;
  },
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mocks.tiers }),
}));
// Radix renders dialogs into a portal; inline them so static markup shows the content.
vi.mock("@/components/ui/dialog", () => {
  const Pass = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Dialog: Pass,
    DialogContent: Pass,
    DialogDescription: Pass,
    DialogFooter: Pass,
    DialogHeader: Pass,
    DialogTitle: Pass,
  };
});
vi.mock("@/lib/format", () => ({
  formatDate: () => "July 1, 2026",
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: unknown) =>
      values && typeof values === "object"
        ? `${key}(${Object.entries(values)
            .filter(([name]) => name !== "defaultValue")
            .map(([, value]) => value)
            .join(",")})`
        : key,
  }),
}));

import { PlanChangeDialog } from "./plan-change-dialog";

const UPGRADE: PlanChangePreview = {
  direction: "upgrade",
  currentPlan: {
    id: "plan_basic_month",
    canonicalTierId: "basic",
    billingCadence: "monthly",
    price: { amount: 2900, currency: "UYU" },
  },
  targetPlan: {
    id: "plan_pro_month",
    canonicalTierId: "pro",
    billingCadence: "monthly",
    price: { amount: 6000, currency: "UYU" },
  },
  effectiveAt: "2026-07-01T00:00:00.000Z",
  effectiveTiming: "after_first_payment",
  currentPeriod: { daysRemaining: 15, totalDays: 30 },
  // Credited from the 1500 actually charged, not the 2900 catalog price.
  firstPayment: { amount: 5250, credit: 750, currency: "UYU", fullAmount: 6000 },
};

function renderDialog() {
  return renderToStaticMarkup(
    <PlanChangeDialog
      billingPeriod="monthly"
      changeType="upgrade"
      onBillingPeriodChange={vi.fn()}
      onConfirm={vi.fn()}
      onOpenChange={vi.fn()}
      open
      subscriptionId="sub_1"
      targetTier={
        {
          id: "pro",
          name: "Pro",
          price: { monthly: 6000, yearly: 0 },
          monthly: { id: "prod_pro_month" },
          features: [],
        } as never
      }
    />,
  );
}

describe("Plan change dialog", () => {
  beforeEach(() => {
    mocks.preview = { data: undefined, isLoading: false, error: null };
  });

  it("asks the server to price the selected change", () => {
    mocks.preview = { data: UPGRADE, isLoading: false, error: null };

    renderDialog();

    expect(mocks.previewInput).toEqual({
      billingPeriod: "monthly",
      enabled: true,
      subscriptionId: "sub_1",
      targetTierId: "pro",
    });
  });

  it("renders the server's credit and first Payment as they come", () => {
    mocks.preview = { data: UPGRADE, isLoading: false, error: null };

    const html = renderDialog();

    expect(html).toContain("billing.planChange.credit(15)");
    expect(html).toContain("-UYU 750");
    expect(html).toContain("UYU 5250");
    expect(html).toContain("billing.planChange.thenFullAmount(UYU 6000)");
    // A client-side diff of catalog prices (6000 - 2900) never shows up.
    expect(html).not.toContain("3100");
    expect(html).not.toContain("billing.planChange.priceChange");
  });

  it("shows when a Downgrade takes effect, from the server", () => {
    mocks.preview = {
      data: {
        ...UPGRADE,
        direction: "downgrade",
        effectiveTiming: "next_renewal",
        firstPayment: { amount: 2900, credit: 0, currency: "UYU", fullAmount: 2900 },
      },
      isLoading: false,
      error: null,
    };

    const html = renderDialog();

    expect(html).toContain("billing.planChange.startsOn(July 1, 2026,UYU 2900)");
    expect(html).not.toContain("billing.planChange.credit");
  });

  it("shows the server's error and offers no way to accept", () => {
    mocks.preview = {
      data: undefined,
      isLoading: false,
      error: new Error("Cadence change is not supported"),
    };

    const html = renderDialog();

    expect(html).toContain("billing.planChange.previewError");
    expect(html).toContain("Cadence change is not supported");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>billing\.planChange\.confirmUpgrade/);
  });

  it("does not offer to accept while the preview is loading", () => {
    mocks.preview = { data: undefined, isLoading: true, error: null };

    const html = renderDialog();

    expect(html).toContain("billing.planChange.previewLoading");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>billing\.planChange\.confirmUpgrade/);
  });
});
