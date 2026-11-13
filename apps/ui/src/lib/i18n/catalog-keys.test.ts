import { describe, expect, it } from "vitest";
import { BASE_TIERS } from "../../../../../packages/db/src/plan-catalog";
import en from "./locales/en.json";
import es from "./locales/es.json";

/**
 * The Pricing catalog stores stable keys for features, limits and permissions
 * and the UI owns their labels (`pricing.features.*`, `pricing.limits.*`,
 * `pricing.permissions.*`). A key the seed ships without a label would show up
 * raw on a pricing card, so the two sides must agree.
 */

function labelOf(locale: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, part) => {
    return node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined;
  }, locale);
}

function seededKeys(group: "features" | "limits" | "permissions"): string[] {
  const keys = BASE_TIERS.flatMap((tier) =>
    group === "limits" ? Object.keys(tier.limits) : tier[group],
  );
  return [...new Set(keys)].sort();
}

describe.each([
  ["features", "pricing.features"],
  ["limits", "pricing.limits"],
  ["permissions", "pricing.permissions"],
] as const)("seeded catalog %s", (group, prefix) => {
  it.each([
    ["en", en],
    ["es", es],
  ])(`have a label in %s.json under ${prefix}`, (_name, locale) => {
    const unlabelled = seededKeys(group).filter((key) => {
      const label = labelOf(locale, `${prefix}.${key}`);
      return typeof label !== "string" || label.trim() === "";
    });

    expect(unlabelled).toEqual([]);
  });
});
