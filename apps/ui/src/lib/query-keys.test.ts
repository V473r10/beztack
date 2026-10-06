import { describe, expect, it } from "vitest";
import { partialMatchKey } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

/** Same prefix rule TanStack applies in `invalidateQueries({ queryKey })`. */
function isInvalidatedBy(prefix: readonly unknown[], key: readonly unknown[]): boolean {
  return partialMatchKey(key, prefix);
}

describe("queryKeys", () => {
  it("keys billing queries by organization", () => {
    expect(queryKeys.subscriptions.list("org_1")).not.toEqual(
      queryKeys.subscriptions.list("org_2"),
    );
    expect(queryKeys.subscriptions.membership("org_1")).not.toEqual(
      queryKeys.subscriptions.membership("org_2"),
    );
  });

  it("keys the Plan change preview by Subscription, target and cadence", () => {
    const preview = queryKeys.subscriptions.planChangePreview("sub_1", "pro", "monthly");

    expect(preview).not.toEqual(
      queryKeys.subscriptions.planChangePreview("sub_2", "pro", "monthly"),
    );
    expect(preview).not.toEqual(
      queryKeys.subscriptions.planChangePreview("sub_1", "team", "monthly"),
    );
    expect(preview).not.toEqual(
      queryKeys.subscriptions.planChangePreview("sub_1", "pro", "yearly"),
    );
  });

  it("invalidates every billing query from the subscriptions family prefix", () => {
    const prefix = queryKeys.subscriptions.all();

    expect(isInvalidatedBy(prefix, queryKeys.subscriptions.list("org_1"))).toBe(true);
    expect(isInvalidatedBy(prefix, queryKeys.subscriptions.membership("org_1"))).toBe(true);
    expect(isInvalidatedBy(prefix, queryKeys.subscriptions.products())).toBe(true);
    expect(isInvalidatedBy(prefix, queryKeys.subscriptions.productTiers())).toBe(true);
    expect(
      isInvalidatedBy(prefix, queryKeys.subscriptions.planChangePreview("sub_1", "pro", "monthly")),
    ).toBe(true);
  });

  it("invalidates every admin query from the admin family prefix", () => {
    const prefix = queryKeys.admin.all();

    expect(isInvalidatedBy(prefix, queryKeys.admin.stats())).toBe(true);
    expect(isInvalidatedBy(prefix, queryKeys.admin.users({ limit: 10 }))).toBe(true);
    expect(isInvalidatedBy(prefix, queryKeys.admin.userSessions("user_1"))).toBe(true);
  });

  it("does not let one organization's key prefix match another organization's", () => {
    expect(
      isInvalidatedBy(
        queryKeys.organizations.members("org_1"),
        queryKeys.organizations.members("org_2"),
      ),
    ).toBe(false);
  });
});
