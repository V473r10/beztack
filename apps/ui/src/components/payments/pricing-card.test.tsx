import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/format", () => ({
  formatNumber: (value: number) => String(value),
  formatPrice: (amount: number) => `$${amount}`,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) =>
      typeof options === "object" && options !== null && "amount" in options
        ? `${key}:${String((options as { amount: unknown }).amount)}`
        : key,
  }),
}));

import { PricingCard } from "./pricing-card";
import type { PricingTier } from "@/types/pricing";

const PRO: PricingTier = {
  id: "pro",
  name: "Pro",
  description: "For teams",
  price: { monthly: 20, yearly: 200 },
  monthly: { id: "prod_pro_month" } as PricingTier["monthly"],
  yearly: { id: "prod_pro_year" } as PricingTier["yearly"],
  features: [],
};

function renderCurrentProCard(changeType: "same" | "period_change") {
  return renderToStaticMarkup(
    <PricingCard
      billingPeriod="yearly"
      changeType={changeType}
      currentTier="pro"
      hasActiveSubscription
      onPlanChange={vi.fn()}
      tier={PRO}
    />,
  );
}

function buttonFor(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}`));
  if (!match) {
    throw new Error(`No button labelled ${label}`);
  }
  return match[0];
}

describe("Pricing card for a coming-soon plan", () => {
  it("shows the plan with no way to buy it", () => {
    const onSelect = vi.fn();
    const html = renderToStaticMarkup(
      <PricingCard
        billingPeriod="monthly"
        currentTier="free"
        onSelect={onSelect}
        tier={{ ...PRO, soon: true }}
      />,
    );

    expect(html).toContain("Pro");
    expect(buttonFor(html, "pricing.soon")).toContain('disabled=""');
    expect(html).not.toContain("pricing.subscribe");
  });

  it("keeps the checkout action for a plan on sale", () => {
    const html = renderToStaticMarkup(
      <PricingCard billingPeriod="monthly" currentTier="free" onSelect={vi.fn()} tier={PRO} />,
    );

    expect(html).not.toContain("pricing.soon");
    expect(buttonFor(html, "pricing.subscribe")).not.toContain('disabled=""');
  });
});

describe("Pricing card for the current tier on another Billing cadence", () => {
  it("offers Switch billing when it is a Cadence change the provider supports", () => {
    const html = renderCurrentProCard("period_change");

    expect(html).not.toContain("pricing.currentPlan");
    expect(buttonFor(html, "pricing.switchBilling")).not.toContain('disabled=""');
  });

  it("hides Switch billing when the provider cannot change cadence", () => {
    // Without the capability the Membership context never answers `period_change`.
    const html = renderCurrentProCard("same");

    expect(html).not.toContain("pricing.switchBilling");
    expect(buttonFor(html, "pricing.currentPlan")).toContain('disabled=""');
  });
});

const FREE: PricingTier = {
  id: "free",
  name: "Free",
  description: "For evaluation",
  price: { monthly: 0, yearly: 0 },
  currency: "USD",
  features: ["basic_dashboard"],
  catalogOnly: true,
};

function renderFreeCard(props: { isSignedIn: boolean; currentTier?: string }) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PricingCard
        billingPeriod="monthly"
        currentTier={props.currentTier ?? "free"}
        isSignedIn={props.isSignedIn}
        onPlanChange={vi.fn()}
        onSelect={vi.fn()}
        tier={FREE}
      />
    </MemoryRouter>,
  );
}

describe("Pricing card for the Free plan", () => {
  it("sends a visitor without an account to sign-up, not to checkout", () => {
    const html = renderFreeCard({ isSignedIn: false });

    expect(html).toContain('href="/auth/sign-up"');
    expect(html).toContain("pricing.startFree");
    expect(html).not.toContain("pricing.currentPlan");
    expect(html).not.toContain("pricing.subscribe");
  });

  it("sends a signed-in subscriber to the app, not to checkout or a plan change", () => {
    const html = renderFreeCard({ isSignedIn: true, currentTier: "pro" });

    expect(html).toContain('href="/"');
    expect(html).toContain("pricing.goToApp");
    expect(html).not.toContain("pricing.downgrade");
  });

  it("shows Current Plan to the member who is on Free", () => {
    const html = renderFreeCard({ isSignedIn: true, currentTier: "free" });

    expect(buttonFor(html, "pricing.currentPlan")).toContain('disabled=""');
  });

  it("shows the price as Free", () => {
    expect(renderFreeCard({ isSignedIn: false })).toContain("pricing.card.free");
  });
});

describe("Pricing card features", () => {
  it("lists the plan features under Includes", () => {
    const html = renderToStaticMarkup(
      <PricingCard
        billingPeriod="monthly"
        tier={{ ...PRO, features: ["advanced_analytics", "priority_support"] }}
      />,
    );

    expect(html).toContain("pricing.card.includes");
    expect(html).toContain("pricing.features.advanced_analytics");
    expect(html).toContain("pricing.features.priority_support");
  });

  it("hides Includes when the plan has no features", () => {
    const html = renderToStaticMarkup(
      <PricingCard billingPeriod="monthly" tier={{ ...PRO, features: [] }} />,
    );

    expect(html).not.toContain("pricing.card.includes");
  });

  it("hides Includes when the plan carries no features field at all", () => {
    const { features: _features, ...withoutFeatures } = PRO;
    const html = renderToStaticMarkup(
      <PricingCard billingPeriod="monthly" tier={withoutFeatures} />,
    );

    expect(html).not.toContain("pricing.card.includes");
  });

  it("labels each limit with its key", () => {
    const html = renderToStaticMarkup(
      <PricingCard
        billingPeriod="monthly"
        tier={{ ...PRO, limits: { users: 50, apiCalls: 100_000 } }}
      />,
    );

    expect(html).toContain("pricing.card.limits");
    expect(html).toContain("pricing.limits.users");
    expect(html).toContain("pricing.limits.apiCalls");
  });
});

describe("Pricing card Contact Sales", () => {
  const ULTIMATE: PricingTier = { ...PRO, id: "ultimate", name: "Ultimate" };

  it("offers checkout, not Contact Sales, for an Ultimate plan that can be bought", () => {
    const html = renderToStaticMarkup(
      <PricingCard billingPeriod="monthly" currentTier="free" onSelect={vi.fn()} tier={ULTIMATE} />,
    );

    expect(html).toContain("pricing.subscribe");
    expect(html).not.toContain("pricing.contactSales");
  });

  it("offers Contact Sales for a plan the provider does not sell", () => {
    const html = renderToStaticMarkup(
      <PricingCard
        billingPeriod="monthly"
        currentTier="free"
        tier={{ ...ULTIMATE, monthly: undefined, yearly: undefined }}
      />,
    );

    expect(buttonFor(html, "pricing.contactSales")).toContain('disabled=""');
  });

  it("does not offer Contact Sales for a plan that is bought for the other cadence", () => {
    const html = renderToStaticMarkup(
      <PricingCard
        billingPeriod="monthly"
        currentTier="free"
        onSelect={vi.fn()}
        tier={{ ...PRO, yearly: undefined }}
      />,
    );

    expect(html).not.toContain("pricing.contactSales");
  });
});
