import type { PricingTier } from "@beztack/payments";

/** What one tier gets for one row of the comparison table. */
export type ComparisonValue =
  | boolean
  | { kind: "unlimited" }
  | { kind: "missing" }
  | { kind: "number"; text: string };

export type ComparisonRow = {
  id: string;
  name: string;
  values: Record<string, ComparisonValue>;
};

export type ComparisonGroup = {
  id: "core" | "usageLimits" | "permissions";
  rows: ComparisonRow[];
};

export type Comparison = {
  columns: Array<{ id: string; name: string }>;
  groups: ComparisonGroup[];
};

type Translate = (key: string, fallback: string) => string;

const UNLIMITED = -1;

function unionInOrder(lists: Array<Iterable<string>>): string[] {
  const seen = new Set<string>();
  for (const list of lists) {
    for (const item of list) {
      seen.add(item);
    }
  }
  return [...seen];
}

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").trim();
}

function limitValue(key: string, value: number | undefined): ComparisonValue {
  if (value === undefined) {
    return { kind: "missing" };
  }
  if (value === UNLIMITED) {
    return { kind: "unlimited" };
  }
  return { kind: "number", text: `${value.toLocaleString()}${key === "storage" ? "GB" : ""}` };
}

function rowsFor(
  tiers: PricingTier[],
  keys: string[],
  prefix: string,
  t: Translate,
  valueOf: (tier: PricingTier, key: string) => ComparisonValue,
): ComparisonRow[] {
  return keys.map((key) => ({
    id: `${prefix}.${key}`,
    name: t(`pricing.${prefix}.${key}`, humanize(key)),
    values: Object.fromEntries(tiers.map((tier) => [tier.id, valueOf(tier, key)])),
  }));
}

/**
 * The "Compare all features" table, built from the catalog tiers: a column per
 * tier and a row per feature, limit and permission any tier has. Labels come
 * from i18n by the catalog's stable keys.
 */
export function buildComparison(tiers: PricingTier[], t: Translate): Comparison {
  const features = unionInOrder(tiers.map((tier) => tier.features ?? []));
  const limits = unionInOrder(tiers.map((tier) => Object.keys(tier.limits ?? {})));
  const permissions = unionInOrder(tiers.map((tier) => Object.keys(tier.permissions ?? {})));

  const groups: ComparisonGroup[] = [
    {
      id: "core",
      rows: rowsFor(tiers, features, "features", t, (tier, key) =>
        (tier.features ?? []).includes(key),
      ),
    },
    {
      id: "usageLimits",
      rows: rowsFor(tiers, limits, "limits", t, (tier, key) => limitValue(key, tier.limits?.[key])),
    },
    {
      id: "permissions",
      rows: rowsFor(
        tiers,
        permissions,
        "permissions",
        t,
        (tier, key) => tier.permissions?.[key] ?? false,
      ),
    },
  ];

  return {
    columns: tiers.map((tier) => ({ id: tier.id, name: tier.name })),
    groups: groups.filter((group) => group.rows.length > 0),
  };
}
