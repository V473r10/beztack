/**
 * The same plan shows the same amount on every surface (ADR 0007): Basic at
 * 900 USD reads "US$ 9,00" on the pricing page, in the Plan change dialog, in
 * the billing page's Pending Plan change notice and on the Failed plan changes
 * page. Nothing is stubbed on the way: the real `fetchPricingTiers` builds the
 * tier, and the real `formatPrice` formats every amount in the active language.
 */
import i18n from "i18next";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  preview: undefined as unknown,
}));

vi.mock("@/env", () => ({
  env: {
    VITE_DEFAULT_CURRENCY: "UYU",
    VITE_DEFAULT_LOCALE: "es-UY",
    VITE_SUBSCRIPTION_MODE: "user",
  },
}));
vi.mock("@/hooks/use-organizations", () => ({ useActiveOrganization: () => ({ data: null }) }));
vi.mock("@/hooks/use-pending-plan-change", () => ({
  usePendingPlanChange: () => ({ data: null }),
  useCancelPendingPlanChange: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/use-plan-change-preview", () => ({
  usePlanChangePreview: () => ({ data: mocks.preview, isLoading: false, error: null }),
}));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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
// Keys and interpolation values are what the surfaces decide; translations are data.
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

import { fetchPricingTiers } from "@beztack/payments/react";
import { PendingPlanChangeNoticeView } from "@/components/payments/pending-plan-change-notice";
import { PlanChangeDialog } from "@/components/payments/plan-change-dialog";
import { PricingCard } from "@/components/payments/pricing-card";
import { FailedPlanChangesView } from "@/app/admin/plan-changes";
import type { PlanChangePreview } from "@/hooks/use-plan-change-preview";
import { formatPrice } from "./format";

const BASIC_USD = 900; // US$ 9,00
const PRO_USD = 2900; // US$ 29,00

/** What `GET /api/subscriptions/products` returns for a Polar catalog. */
function stubProducts() {
  const product = (id: string, tier: string, amount: number) => ({
    id,
    name: tier,
    type: "plan",
    price: { amount, currency: "USD" },
    interval: "month",
    intervalCount: 1,
    metadata: { tier },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            provider: "polar",
            products: [
              product("prod_basic", "basic", BASIC_USD),
              product("prod_pro", "pro", PRO_USD),
            ],
          }),
      }),
    ),
  );
}

const DOWNGRADE_TO_BASIC: PlanChangePreview = {
  direction: "downgrade",
  currentPlan: {
    id: "plan_pro",
    canonicalTierId: "pro",
    billingCadence: "monthly",
    price: { amount: PRO_USD, currency: "USD" },
  },
  targetPlan: {
    id: "plan_basic",
    canonicalTierId: "basic",
    billingCadence: "monthly",
    price: { amount: BASIC_USD, currency: "USD" },
  },
  effectiveAt: "2026-12-01T00:00:00.000Z",
  effectiveTiming: "next_renewal",
  currentPeriod: { daysRemaining: 10, totalDays: 30 },
  firstPayment: { amount: BASIC_USD, credit: 0, currency: "USD", fullAmount: BASIC_USD },
};

function pricingCardFor(tierId: string, tiers: Awaited<ReturnType<typeof fetchPricingTiers>>) {
  const tier = tiers.find((candidate) => candidate.id === tierId);
  if (!tier) {
    throw new Error(`No tier ${tierId}`);
  }
  return renderToStaticMarkup(
    <PricingCard billingPeriod="monthly" currentTier="free" tier={tier} />,
  );
}

function dialogMarkup(tiers: Awaited<ReturnType<typeof fetchPricingTiers>>) {
  mocks.preview = DOWNGRADE_TO_BASIC;
  const targetTier = tiers.find((tier) => tier.id === "basic");
  return renderToStaticMarkup(
    <PlanChangeDialog
      billingPeriod="monthly"
      changeType="downgrade"
      onBillingPeriodChange={vi.fn()}
      onConfirm={vi.fn()}
      onOpenChange={vi.fn()}
      open
      subscriptionId="sub_1"
      targetTier={targetTier as never}
    />,
  );
}

function pendingNoticeMarkup() {
  return renderToStaticMarkup(
    <PendingPlanChangeNoticeView
      isCanceling={false}
      onCancel={vi.fn()}
      pendingPlanChange={{
        id: "ppc_1",
        direction: "downgrade",
        effectiveAt: "2026-12-01T00:00:00.000Z",
        subscriptionId: "sub_1",
        targetPlan: {
          id: "plan_basic",
          tierId: "basic",
          billingCadence: "monthly",
          price: { amount: BASIC_USD, currency: "USD" },
        },
      }}
    />,
  );
}

function failedPlanChangesMarkup() {
  return renderToStaticMarkup(
    <FailedPlanChangesView
      changes={[
        {
          id: "ppc_1",
          subscriptionId: "sub_1",
          direction: "downgrade",
          membershipTarget: { type: "user", id: "user_1" },
          membershipTargetName: "Buyer",
          acceptedByEmail: "buyer@example.com",
          retriedByEmail: null,
          retriedAt: null,
          reason: "provider kept charging 2900",
          activationAttempts: 5,
          effectiveAt: "2026-12-01T00:00:00.000Z",
          createdAt: "2026-11-01T00:00:00.000Z",
          failedAt: "2026-11-08T00:00:00.000Z",
          targetPlanSnapshot: {
            canonicalTierId: "basic",
            billingCadence: "monthly",
            paymentProvider: "polar",
            price: { amount: BASIC_USD, currency: "USD" },
          },
        },
      ]}
      error={null}
      isLoading={false}
    />,
  );
}

/** Intl separates symbol and number with no-break spaces; compare on plain spaces. */
function plain(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, " ");
}

describe("The same plan shows the same amount everywhere", () => {
  beforeAll(async () => {
    await i18n.init({ lng: "es", resources: {}, showSupportNotice: false });
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await i18n.changeLanguage("es");
  });

  it("shows Basic at US$ 9,00 on pricing, Plan change, billing and Failed plan changes", async () => {
    stubProducts();
    const tiers = await fetchPricingTiers("http://api.test");

    const surfaces = {
      pricing: pricingCardFor("basic", tiers),
      planChangeDialog: dialogMarkup(tiers),
      billing: pendingNoticeMarkup(),
      failedPlanChanges: failedPlanChangesMarkup(),
    };

    for (const [surface, html] of Object.entries(surfaces)) {
      expect(plain(html), surface).toContain("US$ 9,00");
      // 900 read as whole dollars (the 100x bug) never shows up.
      expect(plain(html), surface).not.toContain("US$ 900");
    }
  });

  it("shows the amount of a higher plan the same way on pricing and in the dialog", async () => {
    stubProducts();
    const tiers = await fetchPricingTiers("http://api.test");

    expect(plain(pricingCardFor("pro", tiers))).toContain("US$ 29,00");
    expect(plain(dialogMarkup(tiers))).toContain("US$ 29,00");
  });

  it("formats in the language the user chose", async () => {
    stubProducts();
    const tiers = await fetchPricingTiers("http://api.test");

    await i18n.changeLanguage("en");

    expect(plain(pricingCardFor("basic", tiers))).toContain("$9.00");
    expect(plain(failedPlanChangesMarkup())).toContain("$9.00");
    expect(formatPrice(BASIC_USD, "USD")).toBe("$9.00");
  });

  it.each([
    { currency: "UYU", amount: 39_000, text: "$ 390,00" },
    { currency: "JPY", amount: 900, text: "900" },
    { currency: "KWD", amount: 9000, text: "9,000" },
  ])("reads $amount $currency by that currency's decimals", ({ currency, amount, text }) => {
    expect(plain(formatPrice(amount, currency))).toContain(text);
  });
});
