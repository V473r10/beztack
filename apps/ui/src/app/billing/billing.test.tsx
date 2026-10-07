import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pendingPlanChange: { data: null as unknown },
  cancel: { mutate: vi.fn(), isPending: false },
}));

vi.mock("@/env", () => ({ env: { VITE_SUBSCRIPTION_MODE: "organization" } }));
vi.mock("@/hooks/use-organizations", () => ({
  useActiveOrganization: () => ({ data: { id: "org_1" } }),
}));
vi.mock("@/hooks/use-pending-plan-change", () => ({
  usePendingPlanChange: () => mocks.pendingPlanChange,
  useCancelPendingPlanChange: () => mocks.cancel,
}));
vi.mock("@/contexts/membership-context", () => ({
  useMembership: () => ({
    subscriptions: [],
    orders: [],
    meters: [],
    currentTier: "pro",
    tierConfig: {},
    isLoading: false,
    error: null,
    upgradeToTier: vi.fn(),
    openBillingPortal: vi.fn(),
  }),
}));
// The dashboard has its own concerns; this page test is about the notice.
vi.mock("@/components/payments/billing-dashboard", () => ({
  BillingDashboard: () => <div data-testid="billing-dashboard" />,
}));
vi.mock("@/lib/format", () => ({
  formatDate: () => "November 1, 2026",
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Keys and interpolation values are what the page decides; translations are data.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}(${Object.values(values).join(",")})` : key,
  }),
}));

import { PendingPlanChangeNoticeView } from "@/components/payments/pending-plan-change-notice";
import Billing from "./billing";

const DOWNGRADE = {
  id: "ppc_1",
  direction: "downgrade",
  effectiveAt: "2026-11-01T00:00:00.000Z",
  subscriptionId: "sub_1",
  targetPlan: {
    id: "plan_basic_month",
    tierId: "basic",
    billingCadence: "monthly",
    price: { amount: 29, currency: "UYU" },
  },
} as const;

describe("Billing page Pending Plan change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pendingPlanChange = { data: null };
    mocks.cancel.isPending = false;
  });

  it("shows the pending change, its effective date and a cancel action", () => {
    mocks.pendingPlanChange = { data: DOWNGRADE };

    const html = renderToStaticMarkup(<Billing />);

    expect(html).toContain("billing.pendingPlanChange.title");
    expect(html).toContain(
      "billing.pendingPlanChange.downgradeOn(Basic,billing.monthly,UYU 29,November 1, 2026)",
    );
    expect(html).toContain("billing.pendingPlanChange.cancel");
  });

  it("shows nothing when no change is pending", () => {
    const html = renderToStaticMarkup(<Billing />);

    expect(html).not.toContain("billing.pendingPlanChange");
    expect(html).toContain("billing-dashboard");
  });

  it("says it applies at the next renewal when the date is unknown", () => {
    mocks.pendingPlanChange = { data: { ...DOWNGRADE, effectiveAt: null } };

    expect(renderToStaticMarkup(<Billing />)).toContain(
      "billing.pendingPlanChange.downgradeAtRenewal(Basic,billing.monthly,UYU 29)",
    );
  });

  it("cancels through the cancel action and disables it while canceling", () => {
    const onCancel = vi.fn();
    const view = PendingPlanChangeNoticeView({
      isCanceling: true,
      onCancel,
      pendingPlanChange: DOWNGRADE,
    });
    const button = findButton(view);

    expect(button?.props.disabled).toBe(true);
    button?.props.onClick();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

type Element = { props: { children?: unknown; disabled?: boolean; onClick: () => void } };

function findButton(node: unknown): Element | undefined {
  if (!node || typeof node !== "object") {
    return;
  }
  const element = node as Element & { type?: unknown };
  if (typeof element.props?.onClick === "function") {
    return element;
  }
  const children = element.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findButton(child);
    if (found) {
      return found;
    }
  }
  return;
}
