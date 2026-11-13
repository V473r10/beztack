import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: { VITE_DEFAULT_CURRENCY: "USD" } }));
vi.mock("@/lib/format", () => ({
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
}));

import { DiffTable } from "./components/diff-table";
import { SyncedPlanCard } from "./components/synced-plan-card";
import { PlanSyncScreen } from "./plan-sync-screen";
import type { DbPlan, SyncedPlanView } from "./types";

const PLAN: DbPlan = {
  id: "plan_1",
  provider: "polar",
  providerPlanId: null,
  canonicalTierId: "pro",
  displayName: "Pro",
  description: null,
  features: [],
  limits: {},
  permissions: [],
  price: "2900",
  currency: "USD",
  interval: "month",
  intervalCount: 1,
  displayOrder: 2,
  highlighted: false,
  soon: false,
  visible: true,
  status: "active",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-01T00:00:00.000Z",
};

/** Rendered attribute of a disabled button; the class list also holds the `disabled:` variant. */
const DISABLED = 'disabled=""';

function withQueryClient(node: React.ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>,
  );
}

/** The opening tag of the first button whose label contains `label`. */
function buttonTag(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*>(?:(?!</button>).)*${label}`, "s"));
  if (!match) {
    throw new Error(`No button labelled "${label}" in: ${html}`);
  }
  return match[0].slice(0, match[0].indexOf(">") + 1);
}

describe("Plan Sync while prices cannot be pushed safely", () => {
  it("disables Push to Provider on a local-only plan", () => {
    const view: SyncedPlanView = {
      localPlan: PLAN,
      remoteProduct: null,
      syncStatus: "local-only",
      diffs: [],
    };

    const html = withQueryClient(
      <SyncedPlanCard
        isEditing={false}
        onCancelEdit={() => {}}
        onStartEdit={() => {}}
        view={view}
      />,
    );

    expect(buttonTag(html, "Push to Provider")).toContain(DISABLED);
  });

  it("disables Keep Local, which pushes, and leaves Keep Remote, which pulls, enabled", () => {
    const html = withQueryClient(
      <DiffTable diffs={[{ field: "price", localValue: 2900, remoteValue: 29 }]} planId="plan_1" />,
    );

    expect(buttonTag(html, "Keep Local")).toContain(DISABLED);
    expect(buttonTag(html, "Keep Remote")).not.toContain(DISABLED);
  });

  it("warns the App admin on the page and disables Create Plan, which also sends a price", () => {
    const html = withQueryClient(<PlanSyncScreen />);

    expect(html).toContain("Pushing prices to the payment provider is disabled");
    expect(buttonTag(html, "Create Plan")).toContain(DISABLED);
  });
});
