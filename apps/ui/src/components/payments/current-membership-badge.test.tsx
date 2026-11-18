import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membership: { currentTier: "pro", isTierUnknown: false } as Record<string, unknown>,
}));

vi.mock("@/env", () => ({ env: {} }));
vi.mock("@/contexts/membership-context", () => ({
  useMembership: () => mocks.membership,
}));
// Keys are what the badge decides; translations are data.
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { CurrentMembershipBadge } from "./current-membership-badge";

describe("CurrentMembershipBadge", () => {
  beforeEach(() => {
    mocks.membership = { currentTier: "pro", isTierUnknown: false };
  });

  it("shows the tier of the Membership", () => {
    const html = renderToStaticMarkup(<CurrentMembershipBadge size="sm" />);

    expect(html).toContain("membership.tiers.pro");
  });

  it("shows an unavailable badge, never Free, when the tier is unknown", () => {
    mocks.membership = { currentTier: "free", isTierUnknown: true };

    const html = renderToStaticMarkup(<CurrentMembershipBadge size="sm" />);

    expect(html).toContain("billing.membershipUnavailable.badge");
    expect(html).not.toContain("membership.tiers.free");
  });
});
