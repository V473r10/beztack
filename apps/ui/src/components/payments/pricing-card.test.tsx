import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/format", () => ({
  formatPrice: (amount: number) => `$${amount}`,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
