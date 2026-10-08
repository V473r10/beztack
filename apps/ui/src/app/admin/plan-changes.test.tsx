import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/lib/format", () => ({
  formatDate: () => "Oct 8, 2026, 1:00 AM",
  formatPrice: (amount: number, currency: string) => `${currency} ${amount}`,
}));

import type { FailedPlanChange } from "@/hooks/use-failed-plan-changes";
import { FailedPlanChangesView } from "./plan-changes";

const FAILED: FailedPlanChange = {
  id: "ppc_1",
  subscriptionId: "sub_1",
  direction: "downgrade",
  membershipTarget: { type: "organization", id: "org_1" },
  membershipTargetName: "Acme",
  acceptedByEmail: "owner@example.com",
  retriedByEmail: null,
  retriedAt: null,
  reason: "provider kept charging 1000",
  activationAttempts: 5,
  effectiveAt: "2026-11-01T00:00:00.000Z",
  createdAt: "2026-10-01T00:00:00.000Z",
  failedAt: "2026-10-08T04:00:00.000Z",
  targetPlanSnapshot: {
    canonicalTierId: "basic",
    billingCadence: "monthly",
    paymentProvider: "mercadopago",
    price: { amount: 500, currency: "UYU" },
  },
};

function render(props: Partial<Parameters<typeof FailedPlanChangesView>[0]>) {
  return renderToStaticMarkup(
    <FailedPlanChangesView changes={undefined} error={null} isLoading={false} {...props} />,
  );
}

describe("Failed plan changes page", () => {
  it("shows who it belongs to, the target plan, the last error and the attempts", () => {
    const html = render({ changes: [FAILED] });

    expect(html).toContain("Acme");
    expect(html).toContain("organization · subscription sub_1");
    expect(html).toContain("Downgrade");
    expect(html).toContain("basic · monthly · UYU 500");
    expect(html).toContain("provider kept charging 1000");
    expect(html).toContain(">5<");
    expect(html).toContain("Oct 8, 2026, 1:00 AM");
    expect(html).toContain("owner@example.com");
  });

  it("falls back to the target id and marks a reconciled change", () => {
    const html = render({
      changes: [{ ...FAILED, membershipTargetName: null, acceptedByEmail: null }],
    });

    expect(html).toContain("org_1");
    expect(html).toContain("Reconciled from the provider");
  });

  it("offers a retry per row, and shows which one is in flight", () => {
    const second = { ...FAILED, id: "ppc_2" };
    const idle = render({ changes: [FAILED, second], onRetry: () => undefined });
    expect(idle.match(/Retry now/g)).toHaveLength(2);
    expect(idle).not.toContain('disabled=""');

    const busy = render({
      changes: [FAILED, second],
      onRetry: () => undefined,
      retryingId: "ppc_1",
    });
    expect(busy).toContain("Retrying…");
    // One retry at a time: every button is disabled while one runs.
    expect(busy.match(/disabled=""/g)).toHaveLength(2);
  });

  it("shows who retried it last, only once someone did", () => {
    expect(render({ changes: [FAILED] })).not.toContain("Last retried");

    const html = render({
      changes: [
        { ...FAILED, retriedByEmail: "admin@example.com", retriedAt: "2026-10-08T05:00:00.000Z" },
      ],
    });
    expect(html).toContain("Last retried by admin@example.com on Oct 8, 2026, 1:00 AM");
  });

  it("says when there is nothing to resolve", () => {
    expect(render({ changes: [] })).toContain("No failed plan changes");
  });

  it("shows the server error", () => {
    const html = render({ error: new Error("Forbidden") });

    expect(html).toContain('role="alert"');
    expect(html).toContain("Forbidden");
  });
});
