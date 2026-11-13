import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({
  env: { VITE_DEFAULT_CURRENCY: "USD", VITE_DEFAULT_LOCALE: "en-US" },
}));
// The upgrade dialog loads the catalog; this test is about the dashboard's own text.
vi.mock("./upgrade-dialog", () => ({ UpgradeDialog: () => null }));

import type { Subscription } from "@/contexts/membership-context";
import { renderInLanguage } from "@/test/render-in-language";
import type { MembershipTierConfig } from "@/types/membership";
import { BillingDashboard } from "./billing-dashboard";
import { MembershipStatus } from "./membership-badge";
import { UsageMetrics } from "./usage-metrics";

const TIER_CONFIG = {
  id: "pro",
  name: "Pro",
  limits: { users: 10, storage: 100 },
} as unknown as MembershipTierConfig;

function dashboard(language: "en" | "es", subscriptions: Subscription[] = []) {
  return renderInLanguage(
    language,
    <BillingDashboard
      currentTier="pro"
      orders={[]}
      subscriptions={subscriptions}
      tierConfig={TIER_CONFIG}
    />,
  );
}

describe("BillingDashboard in Spanish", () => {
  it("shows the plan card and the tabs in Spanish", () => {
    const html = dashboard("es");

    expect(html).toContain("Plan actual");
    expect(html).toContain("Sin suscripción activa");
    expect(html).toContain("Administrar facturación");
    expect(html).toContain("Cambiar de plan");
    expect(html).toContain("Uso y límites");
    expect(html).toContain("Historial de pedidos");
  });

  it("keeps English text for English", () => {
    const html = dashboard("en");

    expect(html).toContain("Current Plan");
    expect(html).toContain("No active subscription");
    expect(html).toContain("Usage &amp; Limits");
  });

  it("writes the tier and the usage metrics in Spanish", () => {
    const html = renderInLanguage(
      "es",
      <UsageMetrics meters={[]} onUpgrade={() => undefined} tierConfig={TIER_CONFIG} />,
    );

    expect(html).toContain("Métricas de uso");
    expect(html).toContain("Uso actual de tu plan Pro");
    expect(html).toContain("Miembros del equipo");
    expect(html).toContain("Almacenamiento");
    expect(html).toContain("0% usado");
  });

  it("writes the membership status and its dates in Spanish", () => {
    const html = renderInLanguage(
      "es",
      <MembershipStatus expiresAt={new Date("2099-03-05T12:00:00Z")} isActive tier="basic" />,
    );

    expect(html).toContain("Básico");
    expect(html).toContain("Activa");
    expect(html).toContain("Se renueva el");
    expect(html).not.toContain("Renews");
  });
});
